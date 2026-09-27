import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { AgentGatewayError, callAgentGateway } from "./gateway.mjs";

const U = Deno.env.get("SUPABASE_URL")!;
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(U, S, { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { "content-type": "application/json", "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error ?? "unknown_error");

const HML_EVIDENCE_RULES = `Regras obrigatórias de evidência no HML:
- Metadados de um documento (id, nome, storage path, status available) NÃO significam que o conteúdo do PDF foi lido. Se documentAccess.mode for metadata_only, não atribua ao edital/TR cláusulas, prazos, endereços ou requisitos que não estejam textualmente presentes em outro campo do contexto; marque-os como não lidos/pendentes.
- estimated_unit_value e estimated_total_value são valores estimados da contratação/órgão. NUNCA os trate como custo de aquisição, cotação de fornecedor ou custo da Luvi.
- O agente econômico só pode calcular preço/custo quando houver custo de aquisição/cotação de fornecedor explicitamente verificado. Na ausência, informe os parâmetros/fórmulas aplicáveis e bloqueie o cálculo numérico, sem inventar custo.
- humanFinalDecision=true significa que a decisão final permanece humana; não é, por si só, prova de autorização específica para contato externo. externalWritesAllowed=false proíbe executar ações externas neste fluxo, mas não impede análise consultiva nem a indicação de próximos passos.
- Preserve a distinção entre evidência fornecida, resultado de agente anterior e inferência. Não promova hipótese ou saída anterior a fato documental.`;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if ((Deno.env.get("VEENCE_AI_ENABLED") ?? "false").toLowerCase() !== "true") return json({ error: "ai_disabled" }, 503);

  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "unauthorized" }, 401);

  const input = await request.json().catch(() => ({}));
  const authorizationId = input.authorization_id;
  const invocationKey = input.invocation_key;
  const agentCode = typeof input.agent_code === "string" ? input.agent_code : "";
  const queueId = typeof input.queue_id === "string" ? input.queue_id : "";
  if (!isUuid(authorizationId) || !isUuid(invocationKey) || !isUuid(queueId) || !/^[a-z_]+$/.test(agentCode)) {
    return json({ error: "invalid_request" }, 400);
  }
  const approvedQueue = Deno.env.get("VEENCE_HML_QUEUE_ID") ?? "";
  if (!approvedQueue || queueId !== approvedQueue) return json({ error: "hml_queue_not_configured" }, 503);

  const serializedContent = JSON.stringify(input.content ?? {});
  if (serializedContent.length > 200_000) return json({ error: "content_too_large" }, 413);

  const [{ data: queue, error: queueError }, { data: config, error: configError }] = await Promise.all([
    db.from("opportunity_ai_analysis_queue").select("id,client_id,status").eq("id", queueId).maybeSingle(),
    db.rpc("hml_agent_config_service", { p_agent_code: agentCode }),
  ]);
  if (queueError || !queue) return json({ error: "queue_not_found" }, 404);
  if (configError || !config) return json({ error: "agent_not_found" }, 404);
  const [{ data: membership }, { data: owner }] = await Promise.all([
    db.from("client_members").select("client_id").eq("client_id", queue.client_id).eq("user_id", auth.user.id).maybeSingle(),
    db.from("platform_user_roles").select("user_id").eq("user_id", auth.user.id).eq("role", "platform_owner").eq("active", true).maybeSingle(),
  ]);
  if (!membership && !owner) return json({ error: "forbidden" }, 403);
  if (config.enabled !== true) return json({ error: "agent_disabled" }, 409);
  if (config.provider !== "gateway" || !config.model || !String(config.instructions ?? "").trim()) return json({ error: "agent_not_configured" }, 409);

  const estimatedCost = Number(config.max_cost_usd);
  if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) return json({ error: "agent_budget_invalid" }, 409);
  const { data: reservation, error: reservationError } = await db.rpc("hml_reserve_authorized_agent_invocation_service", {
    p_authorization: authorizationId,
    p_user: auth.user.id,
    p_invocation_key: invocationKey,
    p_agent_code: agentCode,
    p_client_id: queue.client_id,
    p_queue_id: queueId,
    p_estimated_cost: estimatedCost,
  });
  if (reservationError || !reservation) return json({ error: "agent_gate_denied" }, 409);
  if (reservation.replayed) {
    const { data: existing } = await db.rpc("hml_agent_invocation_snapshot_service", {
      p_user: auth.user.id, p_invocation: reservation.id,
    });
    return json({ replayed: true, invocation: existing ?? { id: reservation.id, status: reservation.status }, retryAllowed: false });
  }

  try {
    const response = await callAgentGateway({
      model: config.model,
      instructions: `${config.instructions}\n\n${HML_EVIDENCE_RULES}\n\nRetorne somente JSON. Preserve evidências, incertezas e limites do seu papel.`,
      content: input.content ?? {},
      maxOutputTokens: config.max_output_tokens,
      timeoutMs: config.timeout_ms,
    });
    const completedAudit = {
      agentCode, modelRequested: config.model, modelActual: response.modelActual,
      providerMetadata: response.providerMetadata, totalTokens: response.totalTokens,
    };
    const { data: persisted, error: persistError } = await db.rpc("hml_complete_agent_invocation_service", {
      p_invocation: reservation.id,
      p_provider_request_id: response.requestId,
      p_input_tokens: response.inputTokens,
      p_output_tokens: response.outputTokens,
      p_reported_cost: response.reportedCostUsd,
      p_result: response.parsed,
      p_audit: completedAudit,
    });
    if (persistError || persisted !== true) return json({ error: "persistence_unconfirmed", invocationId: reservation.id, retryAllowed: false }, 500);
    return json({ ok: true, status: "completed", invocationId: reservation.id, agentCode,
      model: response.modelActual, costUsd: response.reportedCostUsd, inputTokens: response.inputTokens,
      outputTokens: response.outputTokens, result: response.parsed, retryAllowed: false });
  } catch (error) {
    const ambiguous = error instanceof AgentGatewayError ? error.ambiguous === true : false;
    await db.rpc("hml_fail_agent_invocation_service", {
      p_invocation: reservation.id, p_error: errorText(error), p_ambiguous: ambiguous,
      p_audit: { agentCode, errorClass: error instanceof AgentGatewayError ? error.errorClass : "unknown_error" },
    });
    return json({ error: errorText(error), invocationId: reservation.id, ambiguous, retryAllowed: false }, 500);
  }
});

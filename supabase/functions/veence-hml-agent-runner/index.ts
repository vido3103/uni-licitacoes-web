import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { AgentGatewayError, callAgentGateway } from "./gateway.mjs";
import { assessDocumentRead, selectTrustedPdfRows } from "./document-guard.mjs";

const U = Deno.env.get("SUPABASE_URL")!;
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(U, S, { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { "content-type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
const isUuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error ?? "unknown_error");
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_PDF_TOTAL_BYTES = 25 * 1024 * 1024;
const PDF_URL_TTL_SECONDS = 300;

const HML_EVIDENCE_RULES = `Regras obrigatórias de evidência no HML:
- Metadados de um documento (id, nome, storage path, status available) NÃO significam que o conteúdo do PDF foi lido. Se documentAccess.mode for metadata_only, não atribua ao edital/TR cláusulas, prazos, endereços ou requisitos que não estejam textualmente presentes em outro campo do contexto; marque-os como não lidos/pendentes.
- Se documentAccess.mode for attached_pdf, os PDFs oficiais foram anexados à própria chamada. Extraia somente o que estiver efetivamente nos arquivos e registre localizador de fonte (arquivo e página/seção quando identificável). Não transforme ausência de achado em prova de inexistência.
- estimated_unit_value e estimated_total_value são valores estimados da contratação/órgão. NUNCA os trate como custo de aquisição, cotação de fornecedor ou custo da Luvi.
- O agente econômico só pode calcular preço/custo quando houver custo de aquisição/cotação de fornecedor explicitamente verificado. Na ausência, informe os parâmetros/fórmulas aplicáveis e bloqueie o cálculo numérico, sem inventar custo.
- humanFinalDecision=true significa que a decisão final permanece humana; não é, por si só, prova de autorização específica para contato externo. externalWritesAllowed=false proíbe executar ações externas neste fluxo, mas não impede análise consultiva nem a indicação de próximos passos.
- Preserve a distinção entre evidência fornecida, resultado de agente anterior e inferência. Não promova hipótese ou saída anterior a fato documental.`;
const ORCHESTRATOR_DOCUMENT_RULES = `Como primeiro agente do fluxo, os PDFs oficiais anexados são a fonte documental obrigatória. O Edital deve estar entre os anexos e precisa ser efetivamente lido antes de liberar qualquer agente seguinte.
Produza também um dossiê documental estruturado e reutilizável pelos agentes seguintes. Cubra somente o escopo selecionado e extraia, quando existirem: especificações técnicas e quantidades; marca/modelo/referência/equivalência; garantia; habilitação e qualificação; condições comerciais; locais, prazos e condições de entrega/recebimento; embalagem/transporte; datas e prazos do certame; divergências entre Edital/TR/ETP. Para cada evidência, informe arquivo e página/seção quando identificável.
Além do dossiê, retorne obrigatoriamente estes campos no JSON raiz:
- document_read_complete: true SOMENTE se todos os PDFs listados em documentAccess.filenames tiverem sido lidos sem falha de OCR, parsing, acesso ou truncamento; caso contrário false.
- document_read_manifest: array com exatamente um objeto por arquivo anexado, no formato {"filename":"nome exato","status":"complete"} ou {"filename":"nome exato","status":"incomplete","reason":"motivo"}.
- document_read_incomplete: array vazio quando document_read_complete=true; caso contrário, liste os nomes/razões dos arquivos incompletos.
Se qualquer arquivo não puder ser lido integralmente, document_read_complete DEVE ser false. Não declare leitura documental integral se houver qualquer falha. Não invente requisito ausente e não use valor estimado do órgão como custo da Luvi.`;
type GatewayFile = { url: string; filename: string; mimeType: "application/pdf" };
type TrustedPdfInputs = { files: GatewayFile[]; expectedFilenames: string[] };
async function trustedPdfInputs(queue: { client_id: string; opportunity_id: string }, agentCode: string): Promise<TrustedPdfInputs> {
  if (agentCode !== "orchestracao_veence") return { files: [], expectedFilenames: [] };
  const { data: rows, error } = await db.from("opportunity_documents").select("storage_bucket,storage_path,original_filename,mime_type,file_size_bytes,validation_status").eq("client_id", queue.client_id).eq("opportunity_id", queue.opportunity_id).eq("validation_status", "available").order("uploaded_at");
  if (error) throw new Error("document_catalog_unavailable");
  const selection = selectTrustedPdfRows(rows ?? [], { maxPdfBytes: MAX_PDF_BYTES, maxTotalBytes: MAX_PDF_TOTAL_BYTES, maxFiles: 5 });
  if (!selection.ok) throw new Error(selection.error || "mandatory_edital_attachment_unavailable");
  const files: GatewayFile[] = [];
  for (const row of selection.eligible) {
    const { data, error: signError } = await db.storage.from(String(row.storage_bucket)).createSignedUrl(String(row.storage_path), PDF_URL_TTL_SECONDS);
    if (signError || !data?.signedUrl) throw new Error("document_signing_failed");
    files.push({ url: data.signedUrl, filename: String(row.original_filename || "documento.pdf"), mimeType: "application/pdf" });
  }
  return { files, expectedFilenames: selection.expectedFilenames };
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if ((Deno.env.get("VEENCE_AI_ENABLED") ?? "false").toLowerCase() !== "true") return json({ error: "ai_disabled" }, 503);
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await db.auth.getUser(token); if (authError || !auth.user) return json({ error: "unauthorized" }, 401);
  const input = await request.json().catch(() => ({})); const authorizationId = input.authorization_id; const invocationKey = input.invocation_key; const agentCode = typeof input.agent_code === "string" ? input.agent_code : ""; const queueId = typeof input.queue_id === "string" ? input.queue_id : "";
  if (!isUuid(authorizationId) || !isUuid(invocationKey) || !isUuid(queueId) || !/^[a-z_]+$/.test(agentCode)) return json({ error: "invalid_request" }, 400);
  const approvedQueue = Deno.env.get("VEENCE_HML_QUEUE_ID") ?? ""; if (!approvedQueue || queueId !== approvedQueue) return json({ error: "hml_queue_not_configured" }, 503);
  const serializedContent = JSON.stringify(input.content ?? {}); if (serializedContent.length > 200_000) return json({ error: "content_too_large" }, 413);
  const [{ data: queue, error: queueError }, { data: config, error: configError }] = await Promise.all([db.from("opportunity_ai_analysis_queue").select("id,client_id,opportunity_id,status").eq("id", queueId).maybeSingle(), db.rpc("hml_agent_config_service", { p_agent_code: agentCode })]);
  if (queueError || !queue) return json({ error: "queue_not_found" }, 404); if (configError || !config) return json({ error: "agent_not_found" }, 404);
  const [{ data: membership }, { data: owner }] = await Promise.all([db.from("client_members").select("client_id").eq("client_id", queue.client_id).eq("user_id", auth.user.id).maybeSingle(), db.from("platform_user_roles").select("user_id").eq("user_id", auth.user.id).eq("role", "platform_owner").eq("active", true).maybeSingle()]);
  if (!membership && !owner) return json({ error: "forbidden" }, 403); if (config.enabled !== true) return json({ error: "agent_disabled" }, 409); if (config.provider !== "gateway" || !config.model || !String(config.instructions ?? "").trim()) return json({ error: "agent_not_configured" }, 409);
  const estimatedCost = Number(config.max_cost_usd); if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) return json({ error: "agent_budget_invalid" }, 409);
  let documentInputs: TrustedPdfInputs;
  try { documentInputs = await trustedPdfInputs(queue, agentCode); } catch (error) { return json({ error: errorText(error), failedAgent: agentCode, retryAllowed: false, inferenceExecuted: false }, 409); }
  const { data: reservation, error: reservationError } = await db.rpc("hml_reserve_authorized_agent_invocation_service", { p_authorization: authorizationId, p_user: auth.user.id, p_invocation_key: invocationKey, p_agent_code: agentCode, p_client_id: queue.client_id, p_queue_id: queueId, p_estimated_cost: estimatedCost });
  if (reservationError || !reservation) return json({ error: "agent_gate_denied" }, 409);
  if (reservation.replayed) { const { data: existing } = await db.rpc("hml_agent_invocation_snapshot_service", { p_user: auth.user.id, p_invocation: reservation.id }); return json({ replayed: true, invocation: existing ?? { id: reservation.id, status: reservation.status }, retryAllowed: false }); }
  try {
    const files = documentInputs.files;
    const effectiveContent = files.length > 0 ? { ...(input.content ?? {}), documentAccess: { mode: "attached_pdf", contentProvidedToModel: true, attachedPdfCount: files.length, filenames: documentInputs.expectedFilenames, mandatoryEditalAttachment: true, integralReadRequired: true, detail: "low", note: "PDFs oficiais privados anexados por URL assinada temporária. A leitura deve ser confirmada arquivo a arquivo; qualquer falha de OCR/parsing/acesso bloqueia as etapas seguintes." } } : input.content ?? {};
    const roleInstructions = agentCode === "orchestracao_veence" && files.length > 0 ? `\n\n${ORCHESTRATOR_DOCUMENT_RULES}` : "";
    const response = await callAgentGateway({ model: config.model, instructions: `${config.instructions}\n\n${HML_EVIDENCE_RULES}${roleInstructions}\n\nRetorne somente JSON. Preserve evidências, incertezas e limites do seu papel.`, content: effectiveContent, files, maxOutputTokens: config.max_output_tokens, timeoutMs: config.timeout_ms });
    let persistedResult = response.parsed;
    let documentReadAssessment: { ok: boolean; incomplete: string[] } | null = null;
    if (agentCode === "orchestracao_veence") {
      documentReadAssessment = assessDocumentRead(response.parsed, documentInputs.expectedFilenames);
      if (!documentReadAssessment.ok) persistedResult = { ...(response.parsed && typeof response.parsed === "object" ? response.parsed : {}), document_read_complete: false, document_read_incomplete: documentReadAssessment.incomplete };
    }
    const completedAudit = { agentCode, modelRequested: config.model, modelActual: response.modelActual, providerMetadata: response.providerMetadata, totalTokens: response.totalTokens, transport: response.transport, attachedPdfCount: response.attachedPdfCount, mandatoryEditalAttachment: agentCode === "orchestracao_veence", documentReadConfirmed: documentReadAssessment?.ok ?? null, expectedDocumentFilenames: documentInputs.expectedFilenames };
    const { data: persisted, error: persistError } = await db.rpc("hml_complete_agent_invocation_service", { p_invocation: reservation.id, p_provider_request_id: response.requestId, p_input_tokens: response.inputTokens, p_output_tokens: response.outputTokens, p_reported_cost: response.reportedCostUsd, p_result: persistedResult, p_audit: completedAudit });
    if (persistError || persisted !== true) return json({ error: "persistence_unconfirmed", invocationId: reservation.id, retryAllowed: false }, 500);
    if (documentReadAssessment && !documentReadAssessment.ok) return json({ error: "workflow_document_read_incomplete", invocationId: reservation.id, agentCode, documents: documentReadAssessment.incomplete, inferenceExecuted: true, retryAllowed: false }, 409);
    return json({ ok: true, status: "completed", invocationId: reservation.id, agentCode, model: response.modelActual, costUsd: response.reportedCostUsd, inputTokens: response.inputTokens, outputTokens: response.outputTokens, result: persistedResult, transport: response.transport, attachedPdfCount: response.attachedPdfCount, retryAllowed: false });
  } catch (error) { const ambiguous = error instanceof AgentGatewayError ? error.ambiguous === true : false; await db.rpc("hml_fail_agent_invocation_service", { p_invocation: reservation.id, p_error: errorText(error), p_ambiguous: ambiguous, p_audit: { agentCode, errorClass: error instanceof AgentGatewayError ? error.errorClass : "unknown_error" } }); return json({ error: errorText(error), invocationId: reservation.id, ambiguous, retryAllowed: false }, 500); }
});
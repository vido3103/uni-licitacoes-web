import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const U = Deno.env.get("SUPABASE_URL")!;
const S = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(U, S, { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { "content-type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers });
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const dependencies: Record<string, string[]> = {
  orchestracao_veence: [],
  triagem: ["orchestracao_veence"],
  habilitacao: ["orchestracao_veence", "triagem"],
  produtos: ["orchestracao_veence", "triagem"],
  suprimentos: ["produtos"],
  logistica: ["produtos", "suprimentos"],
  economico: ["produtos", "suprimentos", "logistica"],
  auditoria: ["orchestracao_veence", "triagem", "habilitacao", "produtos", "suprimentos", "logistica", "economico"],
};

type Invocation = {
  id?: string;
  agentCode?: string;
  status?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  reportedCostUsd?: number;
  result?: unknown;
  errorDetail?: string | null;
  audit?: Record<string, unknown> | null;
};

function outputFromInvocation(invocation: Invocation) {
  const audit = invocation.audit && typeof invocation.audit === "object" ? invocation.audit : {};
  return {
    agentCode: invocation.agentCode,
    invocationId: invocation.id,
    model: invocation.model,
    costUsd: Number(invocation.reportedCostUsd) || 0,
    inputTokens: Number(invocation.inputTokens) || 0,
    outputTokens: Number(invocation.outputTokens) || 0,
    transport: audit.transport ?? null,
    attachedPdfCount: audit.attached_pdf_count ?? audit.attachedPdfCount ?? null,
    result: invocation.result,
  };
}

function completedResponse(gate: Record<string, unknown>, authorizationId: string, queueId: string, agents: string[], invocations: Invocation[]) {
  const byAgent = new Map(invocations.filter((item) => item.status === "completed" && item.agentCode).map((item) => [item.agentCode as string, item]));
  const outputs = agents.map((code) => byAgent.get(code)).filter((item): item is Invocation => Boolean(item)).map(outputFromInvocation);
  const totalCostUsd = outputs.reduce((sum, item) => sum + (Number(item.costUsd) || 0), 0);
  const inputTokens = outputs.reduce((sum, item) => sum + (Number(item.inputTokens) || 0), 0);
  const outputTokens = outputs.reduce((sum, item) => sum + (Number(item.outputTokens) || 0), 0);
  return { ok: true, status: "completed", workflow: gate.workflow, authorizationId, queueId, calls: outputs.length, totalCostUsd, inputTokens, outputTokens, advisoryOnly: true, humanFinalDecision: true, externalWritesAllowed: false, agents: outputs, localReport: { status: "ready_for_human_review", source: "durable_deterministic_aggregation", agentCount: outputs.length }, retryAllowed: false };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if ((Deno.env.get("VEENCE_AI_ENABLED") ?? "false").toLowerCase() !== "true") return json({ error: "ai_disabled" }, 503);
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "unauthorized" }, 401);
  const input = await request.json().catch(() => ({}));
  const authorizationId = input.authorization_id;
  if (!uuid(authorizationId)) return json({ error: "authorization_id_required" }, 400);
  const queueId = Deno.env.get("VEENCE_HML_QUEUE_ID") ?? "";
  if (!uuid(queueId)) return json({ error: "hml_queue_not_configured" }, 503);

  const { data: gate, error: gateError } = await db.rpc("hml_agent_workflow_authorization_snapshot_service", { p_user: auth.user.id, p_queue: queueId });
  if (gateError || !gate) return json({ error: "workflow_gate_unavailable" }, 409);
  const { data: queue, error: queueError } = await db.from("opportunity_ai_analysis_queue").select("id,client_id,status,context_snapshot").eq("id", queueId).maybeSingle();
  if (queueError || !queue) return json({ error: "workflow_queue_unavailable" }, 409);
  if (gate.id !== authorizationId) return json({ error: "workflow_gate_mismatch" }, 409);
  if (gate.authorized_by !== auth.user.id || gate.client_id !== queue.client_id || gate.queue_id !== queueId) return json({ error: "forbidden" }, 403);
  if (!gate.execution_released_at || !gate.execution_released_by || !["pending", "consumed"].includes(String(gate.status))) return json({ error: "workflow_gate_not_released" }, 409);
  if (!Number.isFinite(Date.parse(gate.expires_at)) || Date.parse(gate.expires_at) <= Date.now()) return json({ error: "workflow_gate_expired" }, 409);
  const agents = Array.isArray(gate.allowed_agents) ? gate.allowed_agents.filter((x: unknown): x is string => typeof x === "string") : [];
  if (!agents.length || agents.length !== Number(gate.max_calls) || agents.length > 10) return json({ error: "workflow_gate_invalid" }, 409);
  if (Number(gate.max_cost_usd) <= 0 || Number(gate.max_cost_usd) > 0.50) return json({ error: "workflow_budget_invalid" }, 409);

  const { data: progress, error: progressError } = await db.rpc("hml_agent_workflow_progress_service", { p_user: auth.user.id, p_authorization: authorizationId });
  if (progressError || !progress) return json({ error: "workflow_progress_unavailable" }, 409);
  const invocations: Invocation[] = Array.isArray(progress.invocations) ? progress.invocations : [];
  const byAgent = new Map(invocations.filter((item) => item.agentCode).map((item) => [item.agentCode as string, item]));
  const terminalFailure = agents.map((code) => byAgent.get(code)).find((item) => item && ["failed", "ambiguous"].includes(String(item.status)));
  if (terminalFailure) return json({ error: "workflow_has_terminal_agent_state", failedAgent: terminalFailure.agentCode, failedStatus: terminalFailure.status, retryAllowed: false }, 409);
  const unresolvedReservation = agents.map((code) => byAgent.get(code)).find((item) => item?.status === "reserved");
  if (unresolvedReservation) return json({ error: "workflow_agent_state_unconfirmed", failedAgent: unresolvedReservation.agentCode, retryAllowed: false }, 409);
  const completedCodes = new Set(invocations.filter((item) => item.status === "completed" && item.agentCode).map((item) => item.agentCode as string));
  if (agents.every((code) => completedCodes.has(code))) return json(completedResponse(gate, authorizationId, queueId, agents, invocations));

  const nextAgent = agents.find((code) => !completedCodes.has(code));
  if (!nextAgent) return json({ error: "workflow_progress_inconsistent", retryAllowed: false }, 409);
  const missingDependency = (dependencies[nextAgent] ?? []).find((code) => !completedCodes.has(code));
  if (missingDependency) return json({ error: "workflow_dependency_incomplete", failedAgent: nextAgent, missingDependency, retryAllowed: false }, 409);

  const context = queue.context_snapshot && typeof queue.context_snapshot === "object" ? queue.context_snapshot as Record<string, unknown> : {};
  const baseContext = {
    homologation: true,
    advisoryOnly: true,
    externalWritesAllowed: false,
    humanFinalDecision: true,
    workflow: gate.workflow,
    queueId,
    clientId: queue.client_id,
    queueStatus: queue.status,
    method: context.method ?? null,
    profile: context.profile ?? null,
    playbook: context.playbook ?? null,
    versions: context.versions ?? null,
    opportunity: context.opportunity ?? null,
    selectedItems: context.selectedItems ?? null,
    selection: context.selection ?? null,
    documents: context.documents ?? null,
    documentAccess: {
      mode: "metadata_only",
      contentRead: false,
      note: "Os PDFs oficiais são anexados somente à orquestração. As etapas seguintes reutilizam o dossiê de evidências durável produzido na primeira etapa.",
    },
    deterministicContext: context.deterministicContext ?? null,
  };
  if (JSON.stringify(baseContext).length > 150_000) return json({ error: "workflow_context_too_large" }, 413);

  const resultByAgent: Record<string, unknown> = {};
  for (const code of agents) {
    const item = byAgent.get(code);
    if (item?.status === "completed") resultByAgent[code] = item.result;
  }
  const nextIndex = agents.indexOf(nextAgent);
  const previousCode = nextIndex > 0 ? agents[nextIndex - 1] : null;
  const upstreamAgentResults = Object.fromEntries((dependencies[nextAgent] ?? []).filter((code) => Object.prototype.hasOwnProperty.call(resultByAgent, code)).map((code) => [code, resultByAgent[code]]));
  const content = {
    ...baseContext,
    step: nextIndex + 1,
    totalSteps: agents.length,
    agentCode: nextAgent,
    previousAgentResult: previousCode ? resultByAgent[previousCode] ?? null : null,
    upstreamAgentResults,
  };
  if (JSON.stringify(content).length > 200_000) return json({ error: "workflow_step_context_too_large", failedAgent: nextAgent, retryAllowed: false }, 413);

  const invocationKey = crypto.randomUUID();
  let response: Response;
  try {
    response = await fetch(`${U}/functions/v1/veence-hml-agent-runner`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: S, "content-type": "application/json" }, body: JSON.stringify({ authorization_id: authorizationId, invocation_key: invocationKey, agent_code: nextAgent, queue_id: queueId, content }) });
  } catch {
    return json({ error: "agent_transport_unknown", failedAgent: nextAgent, retryAllowed: false }, 502);
  }
  const body = await response.json().catch(() => ({ error: "invalid_agent_response" }));
  if (!response.ok || body?.ok !== true) return json({ error: body?.error ?? "agent_execution_failed", failedAgent: nextAgent, failedStatus: response.status, invocation: body, retryAllowed: false }, 500);

  const current: Invocation = {
    id: body.invocationId,
    agentCode: nextAgent,
    status: "completed",
    model: body.model,
    inputTokens: body.inputTokens,
    outputTokens: body.outputTokens,
    reportedCostUsd: body.costUsd,
    result: body.result,
    audit: { transport: body.transport, attachedPdfCount: body.attachedPdfCount },
  };
  const updatedInvocations = [...invocations, current];
  const updatedCompleted = new Set(updatedInvocations.filter((item) => item.status === "completed" && item.agentCode).map((item) => item.agentCode as string));
  if (agents.every((code) => updatedCompleted.has(code))) return json(completedResponse(gate, authorizationId, queueId, agents, updatedInvocations));

  return json({ ok: true, status: "in_progress", workflow: gate.workflow, authorizationId, queueId, callsCompleted: updatedCompleted.size, totalCalls: agents.length, completedAgent: nextAgent, nextAgent: agents.find((code) => !updatedCompleted.has(code)) ?? null, retryAllowed: false });
});

import { currentHmlIdentity, type HmlAuth, type HmlTransport } from "./veenceHmlSession.ts";

export type HmlWorkflow =
  | "licitacao_completa"
  | "radar"
  | "triagem"
  | "habilitacao"
  | "cotacao_e_viabilidade"
  | "auditoria_relatorio";

export type HmlAgentPlanStep = {
  order: number;
  code: string;
  mode: "gateway" | "local";
  configured: boolean;
  enabled: boolean;
  model: string | null;
  maxCostUsd: number;
};

export type HmlAgentPlan = {
  workflow: HmlWorkflow;
  steps: HmlAgentPlanStep[];
  gatewayAgents: string[];
  maxCalls: number;
  maxCostUsd: number;
  gateReady: boolean;
  executionReady: boolean;
  ready: boolean;
  humanFinalDecision: boolean;
  externalWritesAllowed: boolean;
};

export type HmlAgentWorkflowAuthorization = {
  id: string;
  status: "pending" | "consumed" | "revoked";
  workflow: HmlWorkflow | null;
  allowedAgents: string[];
  maxCalls: number;
  consumedCalls: number;
  maxCostUsd: number;
  reservedCostUsd: number;
  expiresAt: string;
  authorizedBy: string | null;
  clientId: string | null;
  queueId: string | null;
  createdAt: string | null;
  reused: boolean;
};

export type HmlAgentControlStatus = {
  globalAiEnabled: boolean;
  supportedWorkflows: HmlWorkflow[];
  authorization: HmlAgentWorkflowAuthorization | null;
  agents: Array<{
    code: string;
    version: string;
    enabled: boolean;
    model: string | null;
    provider: string;
    maxCostUsd: number;
  }>;
};

type AgentControlAction = "status" | "plan" | "authorize" | "revoke";
type AgentControlTransport = Pick<HmlTransport, "invoke">;
type ErrorContext = { status?: number; clone?: () => ErrorContext; json?: () => Promise<unknown> };

async function remoteError(error: unknown): Promise<string | null> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: ErrorContext }).context;
  if (!context?.json) return null;
  try {
    const reader = context.clone?.() ?? context;
    const body = await reader.json?.();
    if (body && typeof body === "object") {
      const code = (body as Record<string, unknown>).error;
      return typeof code === "string" && code ? code : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function request(
  auth: HmlAuth,
  transport: AgentControlTransport,
  action: AgentControlAction,
  data: Record<string, string> = {},
) {
  const { token } = await currentHmlIdentity(auth);
  const response = await transport.invoke("veence-hml-agent-control", {
    body: { action, ...data },
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.error) {
    const code = await remoteError(response.error);
    if (code) throw new Error(code);
    const status = response.error.context?.status;
    throw new Error(status === 401 ? "session_expired" : status === 403 ? "forbidden" : "agent_control_request_failed");
  }
  return response.data;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAuthorization(value: unknown): HmlAgentWorkflowAuthorization | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const id = text(item.id);
  const status = text(item.status);
  const expiresAt = text(item.expiresAt ?? item.expires_at);
  if (!id || !expiresAt || !status || !["pending", "consumed", "revoked"].includes(status)) return null;
  const rawAgents = item.allowedAgents ?? item.allowed_agents;
  const allowedAgents = Array.isArray(rawAgents) ? rawAgents.filter((agent): agent is string => typeof agent === "string") : [];
  const workflow = text(item.workflow);
  return {
    id,
    status: status as HmlAgentWorkflowAuthorization["status"],
    workflow: workflow as HmlWorkflow | null,
    allowedAgents,
    maxCalls: numberValue(item.maxCalls ?? item.max_calls),
    consumedCalls: numberValue(item.consumedCalls ?? item.consumed_calls),
    maxCostUsd: numberValue(item.maxCostUsd ?? item.max_cost_usd),
    reservedCostUsd: numberValue(item.reservedCostUsd ?? item.reserved_cost_usd),
    expiresAt,
    authorizedBy: text(item.authorizedBy ?? item.authorized_by),
    clientId: text(item.clientId ?? item.client_id),
    queueId: text(item.queueId ?? item.queue_id),
    createdAt: text(item.createdAt ?? item.created_at),
    reused: item.reused === true,
  };
}

export async function hmlAgentControlStatus(auth: HmlAuth, transport: AgentControlTransport) {
  const response = await request(auth, transport, "status") as Omit<HmlAgentControlStatus, "authorization"> & { authorization?: unknown };
  return { ...response, authorization: normalizeAuthorization(response.authorization) } as HmlAgentControlStatus;
}

export async function hmlAgentPlan(
  auth: HmlAuth,
  transport: AgentControlTransport,
  workflow: HmlWorkflow,
) {
  const response = await request(auth, transport, "plan", { workflow });
  return (response as { plan: HmlAgentPlan }).plan;
}

export async function hmlAuthorizeAgentWorkflow(
  auth: HmlAuth,
  transport: AgentControlTransport,
  workflow: HmlWorkflow,
  requestKey: string,
) {
  const response = await request(auth, transport, "authorize", { workflow, request_key: requestKey }) as {
    authorization?: unknown;
    plan?: HmlAgentPlan;
    executionEnabled?: boolean;
  };
  const authorization = normalizeAuthorization(response.authorization);
  if (!authorization || !response.plan) throw new Error("authorization_not_pending");
  return { authorization, plan: response.plan, executionEnabled: response.executionEnabled === true };
}

export async function hmlRevokeAgentWorkflow(
  auth: HmlAuth,
  transport: AgentControlTransport,
  authorizationId: string,
) {
  const response = await request(auth, transport, "revoke", { authorization_id: authorizationId }) as { revoked?: boolean };
  if (response.revoked !== true) throw new Error("revoke_denied");
  return true;
}

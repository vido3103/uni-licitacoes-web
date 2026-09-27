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
  ready: boolean;
  humanFinalDecision: boolean;
  externalWritesAllowed: boolean;
};

export type HmlAgentControlStatus = {
  globalAiEnabled: boolean;
  supportedWorkflows: HmlWorkflow[];
  authorization: unknown | null;
  agents: Array<{
    code: string;
    version: string;
    enabled: boolean;
    model: string | null;
    provider: string;
    maxCostUsd: number;
  }>;
};

type AgentControlAction = "status" | "plan";
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

export async function hmlAgentControlStatus(auth: HmlAuth, transport: AgentControlTransport) {
  return await request(auth, transport, "status") as HmlAgentControlStatus;
}

export async function hmlAgentPlan(
  auth: HmlAuth,
  transport: AgentControlTransport,
  workflow: HmlWorkflow,
) {
  const response = await request(auth, transport, "plan", { workflow });
  return (response as { plan: HmlAgentPlan }).plan;
}

export type AgentConfig = {
  code: string;
  version: string;
  enabled: boolean;
  instructions: string;
  skills: string[];
  allowedTools: string[];
  permissions: Record<string, boolean>;
  provider: "gateway";
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
  maxCostUsd: number;
};

export type AgentRequest = {
  invocationKey: string;
  clientId: string;
  queueId: string;
  estimatedUpperBoundUsd: number;
  deterministicGatesPassed: boolean;
  content: unknown;
};

export type AgentResponse = {
  requestId: string | null;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  reportedCostUsd: number | null;
  result: unknown;
};

export interface AgentStore {
  reserve(key: string, agent: AgentConfig, request: AgentRequest): Promise<boolean>;
  finish(key: string, response: AgentResponse): Promise<void>;
  fail(key: string, error: unknown): Promise<void>;
}

export interface AgentProvider {
  infer(agent: AgentConfig, request: AgentRequest): Promise<AgentResponse>;
}

// The store must implement a durable, atomic unique reservation before this function calls a provider.
// Upstream timeout remains terminal: the same key never receives another provider request.
export async function runAgentOnce(
  enabled: boolean,
  agent: AgentConfig,
  request: AgentRequest,
  store: AgentStore,
  provider: AgentProvider,
): Promise<AgentResponse> {
  if (!enabled || !agent.enabled) throw new Error("ai_disabled");
  if (!request.deterministicGatesPassed) throw new Error("deterministic_gate_blocked");
  if (agent.provider !== "gateway" || !agent.model || !agent.instructions.trim()) throw new Error("agent_not_configured");
  if (!(agent.maxCostUsd > 0) || !Number.isFinite(request.estimatedUpperBoundUsd) ||
      request.estimatedUpperBoundUsd < 0 || request.estimatedUpperBoundUsd > agent.maxCostUsd) {
    throw new Error("cost_limit_exceeded");
  }
  if (!request.invocationKey || !request.clientId || !request.queueId) throw new Error("invalid_identity");
  if (!(await store.reserve(request.invocationKey, agent, request))) throw new Error("invocation_already_reserved");
  let response: AgentResponse;
  try {
    response = await provider.infer(agent, request);
  } catch (error) {
    await store.fail(request.invocationKey, error);
    throw error;
  }
  // A storage failure after a provider response is ambiguous; keep the durable
  // reservation, and never represent it as a provider failure or retry it.
  await store.finish(request.invocationKey, response);
  return response;
}

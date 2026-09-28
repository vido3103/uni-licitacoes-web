export type MockAgent = { code: string; enabled: boolean; version: string; model: string | null; provider: string; maxCostUsd: number };
export type MockInput = { executionId: string; queueId: string; clientId: string; queueStatus: string; attempts: number; maxAttempts: number; agents: MockAgent[] };
export type MockOutput = { code: string; provider: "mock"; status: "simulated"; observation: string; inputTokens: 0; outputTokens: 0; costUsd: 0 };
export type MockProvider = (agent: MockAgent, input: MockInput) => Promise<MockOutput>;

const ROLES = ["orchestracao_veence", "triagem", "habilitacao", "auditoria", "relatorios"];

export const localMockProvider: MockProvider = async (agent) => ({
  code: agent.code, provider: "mock", status: "simulated",
  observation: "Simulação de fluxo; nenhum documento foi interpretado e nenhuma conclusão técnica foi produzida.",
  inputTokens: 0, outputTokens: 0, costUsd: 0,
});

export async function dispatchMock(input: MockInput, provider: MockProvider = localMockProvider) {
  if (input.queueStatus !== "pending" || input.attempts !== 0 || input.maxAttempts !== 1) {
    throw new Error("deterministic_queue_gate_blocked");
  }
  if (!input.executionId || !input.clientId || !input.queueId) throw new Error("invalid_execution_identity");
  const byCode = new Map(input.agents.map(agent => [agent.code, agent]));
  if (byCode.size !== input.agents.length || ROLES.some(code => !byCode.has(code))) {
    throw new Error("mock_registry_incomplete");
  }
  const observations: MockOutput[] = [];
  for (const code of ROLES) {
    const observation = await provider(byCode.get(code)!, input);
    if (observation.provider !== "mock" || observation.code !== code || observation.costUsd !== 0 ||
        observation.inputTokens !== 0 || observation.outputTokens !== 0) throw new Error("mock_provider_contract_violation");
    observations.push(observation);
  }
  return {
    kind: "mock_homologation", executionId: input.executionId, queueId: input.queueId,
    recommendation: "revisao_manual", advisoryOnly: true, deterministicGatesPreserved: true,
    providerCalls: 0, costUsd: 0, inputTokens: 0, outputTokens: 0,
    selection: ROLES, agents: observations,
    summary: "Orquestração simulada. Não constitui análise do PE 18/2026; evidências e pendências devem ser avaliadas por humano ou por execução futura autorizada.",
  };
}

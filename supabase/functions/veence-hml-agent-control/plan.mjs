const WORKFLOWS = Object.freeze({
  licitacao_completa: ['orchestracao_veence','triagem','habilitacao','produtos','suprimentos','logistica','economico','auditoria','relatorios'],
  radar: ['orchestracao_veence','radar','auditoria','relatorios'],
  triagem: ['orchestracao_veence','triagem','auditoria','relatorios'],
  habilitacao: ['orchestracao_veence','habilitacao','auditoria','relatorios'],
  cotacao_e_viabilidade: ['orchestracao_veence','produtos','suprimentos','logistica','economico','auditoria','relatorios'],
  auditoria_relatorio: ['orchestracao_veence','auditoria','relatorios'],
});

const LOCAL_AGENTS = new Set(['relatorios']);

export function buildAgentPlan(workflow, catalog) {
  const sequence = WORKFLOWS[workflow];
  if (!sequence) throw new Error('unknown_workflow');
  const byCode = new Map((Array.isArray(catalog) ? catalog : []).map((agent) => [agent.code, agent]));
  const steps = sequence.map((code, index) => {
    const agent = byCode.get(code) ?? null;
    const mode = LOCAL_AGENTS.has(code) ? 'local' : 'gateway';
    const maxCostUsd = mode === 'gateway' ? Number(agent?.maxCostUsd ?? 0) : 0;
    return { order: index + 1, code, mode, configured: Boolean(agent?.model), enabled: agent?.enabled === true,
      model: agent?.model ?? null, maxCostUsd: Number.isFinite(maxCostUsd) ? maxCostUsd : 0 };
  });
  const gatewaySteps = steps.filter((step) => step.mode === 'gateway');
  const maxCostUsd = Number(gatewaySteps.reduce((sum, step) => sum + step.maxCostUsd, 0).toFixed(6));
  return {
    workflow,
    steps,
    gatewayAgents: gatewaySteps.map((step) => step.code),
    maxCalls: gatewaySteps.length,
    maxCostUsd,
    ready: gatewaySteps.every((step) => step.enabled && step.configured && step.maxCostUsd > 0),
    humanFinalDecision: true,
    externalWritesAllowed: false,
  };
}

export const supportedWorkflows = Object.freeze(Object.keys(WORKFLOWS));

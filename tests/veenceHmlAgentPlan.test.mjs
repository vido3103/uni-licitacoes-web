import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAgentPlan, supportedWorkflows } from '../supabase/functions/veence-hml-agent-control/plan.mjs';

const catalog = ['orchestracao_veence','radar','triagem','habilitacao','produtos','suprimentos','logistica','economico','auditoria','relatorios']
  .map((code) => ({ code, enabled: true, model: 'openai/gpt-5-mini', maxCostUsd: code === 'relatorios' ? 0.04 : 0.04 }));

test('full tender workflow delegates domain roles in deterministic order', () => {
  const plan = buildAgentPlan('licitacao_completa', catalog);
  assert.deepEqual(plan.steps.map((step) => step.code), [
    'orchestracao_veence','triagem','habilitacao','produtos','suprimentos','logistica','economico','auditoria','relatorios',
  ]);
  assert.equal(plan.steps.at(-1).mode, 'local');
  assert.equal(plan.maxCalls, 8);
  assert.equal(plan.maxCostUsd, 0.32);
  assert.equal(plan.ready, true);
  assert.equal(plan.humanFinalDecision, true);
  assert.equal(plan.externalWritesAllowed, false);
});

test('disabled required agent keeps workflow fail-closed', () => {
  const disabled = catalog.map((agent) => agent.code === 'auditoria' ? { ...agent, enabled: false } : agent);
  assert.equal(buildAgentPlan('triagem', disabled).ready, false);
});

test('unknown workflows are rejected and supported list is explicit', () => {
  assert.ok(supportedWorkflows.includes('radar'));
  assert.throws(() => buildAgentPlan('qualquer_coisa', catalog), /unknown_workflow/);
});

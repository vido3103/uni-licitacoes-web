import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchMock } from '../supabase/functions/veence-hml-runtime/mock-dispatcher.ts';

const codes = ['orchestracao_veence','radar','triagem','habilitacao','produtos','suprimentos',
  'logistica','economico','auditoria','relatorios'];
const input = { executionId: 'execution', queueId: 'fixture', clientId: 'luvi',
  queueStatus: 'pending', attempts: 0, maxAttempts: 1,
  agents: codes.map(code => ({ code, enabled: false, version: 'draft', model: null, provider: 'gateway', maxCostUsd: 0 })) };

test('orchestration delegates to registered agents with mock only; real agents stay inactive', async () => {
  const seen = [];
  const result = await dispatchMock(input, async agent => {
    seen.push(agent.code);
    return { code: agent.code, provider: 'mock', status: 'simulated', observation: 'not evaluated',
      inputTokens: 0, outputTokens: 0, costUsd: 0 };
  });
  assert.deepEqual(seen, ['orchestracao_veence','triagem','habilitacao','auditoria','relatorios']);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.costUsd, 0);
  assert.equal(result.recommendation, 'revisao_manual');
  assert.equal(input.agents.every(agent => !agent.enabled), true);
});

test('queue gate and incomplete registry prevent mock dispatch', async () => {
  let calls = 0; const provider = async () => { calls++; throw Error('unreachable'); };
  await assert.rejects(dispatchMock({ ...input, attempts: 1 }, provider), /deterministic_queue_gate_blocked/);
  await assert.rejects(dispatchMock({ ...input, agents: input.agents.slice(1) }, provider), /mock_registry_incomplete/);
  assert.equal(calls, 0);
});

test('mock provider cannot report paid tokens/cost or another provider', async () => {
  await assert.rejects(dispatchMock(input, async agent => ({ code: agent.code, provider: 'gateway',
    status: 'simulated', observation: '', inputTokens: 1, outputTokens: 0, costUsd: 1 })),
  /mock_provider_contract_violation/);
});

test('mock timeout propagates without an automatic retry', async () => {
  let calls = 0;
  await assert.rejects(dispatchMock(input, async () => { calls++; throw Error('timeout'); }), /timeout/);
  assert.equal(calls, 1);
});

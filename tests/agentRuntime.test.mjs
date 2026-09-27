import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgentOnce } from '../src/worker/agentRuntime.ts';

const agent = {
  code: 'triagem', version: 'v1', enabled: true, instructions: 'Use evidências.',
  skills: [], allowedTools: [], permissions: {}, provider: 'gateway', model: 'openai/gpt-5-mini',
  maxOutputTokens: 600, timeoutMs: 45000, maxCostUsd: 0.05,
};
const request = {
  invocationKey: 'one-key', clientId: 'client', queueId: 'queue',
  estimatedUpperBoundUsd: 0.01, deterministicGatesPassed: true, content: {},
};
const makeStore = () => {
  const keys = new Set();
  const events = [];
  return {
    events,
    async reserve(key) { if (keys.has(key)) return false; keys.add(key); events.push('reserved'); return true; },
    async finish() { events.push('completed'); },
    async fail() { events.push('failed'); },
  };
};

test('disabled, deterministic gates and cost ceiling block before reservation', async () => {
  const store = makeStore();
  const provider = { infer() { throw new Error('provider must never run'); } };
  await assert.rejects(runAgentOnce(false, agent, request, store, provider), /ai_disabled/);
  await assert.rejects(runAgentOnce(true, agent, { ...request, deterministicGatesPassed: false }, store, provider), /deterministic_gate_blocked/);
  await assert.rejects(runAgentOnce(true, agent, { ...request, estimatedUpperBoundUsd: 0.06 }, store, provider), /cost_limit_exceeded/);
  assert.deepEqual(store.events, []);
});

test('one reservation precedes one provider request and duplicate key is blocked', async () => {
  const store = makeStore();
  let calls = 0;
  const provider = { async infer() { assert.deepEqual(store.events, ['reserved']); calls++; return { model: agent.model }; } };
  await runAgentOnce(true, agent, request, store, provider);
  await assert.rejects(runAgentOnce(true, agent, request, store, provider), /invocation_already_reserved/);
  assert.equal(calls, 1);
  assert.deepEqual(store.events, ['reserved', 'completed']);
});

test('ambiguous timeout is terminal and never retries or falls back', async () => {
  const store = makeStore();
  let calls = 0;
  const provider = { async infer() { calls++; throw new Error('timeout_ambiguous'); } };
  await assert.rejects(runAgentOnce(true, agent, request, store, provider), /timeout_ambiguous/);
  await assert.rejects(runAgentOnce(true, agent, request, store, provider), /invocation_already_reserved/);
  assert.equal(calls, 1);
  assert.deepEqual(store.events, ['reserved', 'failed']);
});

test('provider usage and cost are handed to durable completion exactly once', async () => {
  const store = makeStore(); let persisted;
  store.finish = async (key, result) => { store.events.push('completed'); persisted = { key, result }; };
  const response = { requestId: 'provider-request', model: agent.model, inputTokens: 100,
    outputTokens: 30, reportedCostUsd: 0.001, result: { recommendation: 'revisao_manual' } };
  assert.deepEqual(await runAgentOnce(true, agent, request, store, { async infer() { return response; } }), response);
  assert.deepEqual(persisted, { key: request.invocationKey, result: response });
  assert.deepEqual(store.events, ['reserved', 'completed']);
});

test('persist failure cannot cause a second provider request', async () => {
  const store = makeStore(); let calls = 0;
  store.finish = async () => { throw new Error('storage_unavailable'); };
  const provider = { async infer() { calls++; return { model: agent.model }; } };
  await assert.rejects(runAgentOnce(true, agent, request, store, provider), /storage_unavailable/);
  await assert.rejects(runAgentOnce(true, agent, request, store, provider), /invocation_already_reserved/);
  assert.equal(calls, 1);
  assert.deepEqual(store.events, ['reserved']);
});

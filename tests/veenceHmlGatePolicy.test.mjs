import assert from 'node:assert/strict';
import test from 'node:test';
import { mockGateDecision } from '../supabase/functions/veence-hml-runtime/gate-policy.ts';

const context = { userId: 'member', clientId: 'luvi', queueId: 'fixture',
  queue: { status: 'pending', attempts: 0, maxAttempts: 1 } };
const gate = { id: 'auth', authorized_by: 'member', client_id: 'luvi', queue_id: 'fixture',
  status: 'pending', expires_at: '2030-01-01T00:00:00Z', consumed_calls: 0,
  max_calls: 1, max_cost_usd: 0, flow: 'mock_orchestration' };
const now = Date.parse('2026-09-27T00:00:00Z');

test('valid mock gate reserves once and consumed gate only replays the stored result', () => {
  assert.equal(mockGateDecision(gate, context, now), 'reserve');
  assert.equal(mockGateDecision({ ...gate, status: 'consumed', consumed_calls: 1 }, context, now), 'replay');
});

test('expired, revoked, wrong user/client/queue and changed queue all deny before database call', () => {
  for (const invalid of [
    { ...gate, expires_at: '2020-01-01T00:00:00Z' },
    { ...gate, status: 'revoked' },
    { ...gate, authorized_by: 'stranger' },
    { ...gate, client_id: 'other' },
    { ...gate, queue_id: 'other' },
    { ...gate, max_cost_usd: 0.01 },
  ]) assert.equal(mockGateDecision(invalid, context, now), 'deny');
  assert.equal(mockGateDecision(gate, { ...context, queue: { ...context.queue, attempts: 1 } }, now), 'deny');
});

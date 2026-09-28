import assert from 'node:assert/strict';
import test from 'node:test';
import { currentHmlIdentity, invokeHmlOnce } from '../src/lib/veenceHmlSession.ts';

const queue = '484a62e7-05ca-4c55-9d30-f657f136b1b5';
const auth = (expiry, refreshError = false, user = { id: 'member' }) => {
  const calls = [];
  return {
    calls,
    async getSession() { calls.push('session'); return { data: { session: { access_token: 'old', expires_at: expiry } }, error: null }; },
    async refreshSession() { calls.push('refresh'); return refreshError
      ? { data: { session: null }, error: { message: 'expired' } }
      : { data: { session: { access_token: 'fresh', expires_at: 2000 } }, error: null }; },
    async getUser(token) { calls.push(`user:${token}`); return { data: { user }, error: user ? null : { message: 'invalid' } }; },
  };
};

test('expired JWT refreshes before the single invocation, without exposing credentials in the body', async () => {
  const a = auth(1001); const sent = [];
  const transport = { async invoke(name, options) { sent.push({ name, ...options }); return { data: { ok: true }, error: null }; } };
  await invokeHmlOnce(a, transport, queue);
  assert.deepEqual(a.calls, ['session', 'refresh', 'user:fresh']);
  assert.deepEqual(sent, [{ name: 'veence-hml-single-shot', body: { queue_id: queue }, headers: { Authorization: 'Bearer fresh' } }]);
});

test('refresh failure and rejected user both block execution before any request', async () => {
  const sent = []; const transport = { async invoke() { sent.push(1); return { data: {}, error: null }; } };
  await assert.rejects(invokeHmlOnce(auth(1001, true), transport, queue), /refresh_failed/);
  await assert.rejects(invokeHmlOnce(auth(1800, false, null), transport, queue), /invalid_session/);
  assert.deepEqual(sent, []);
});

test('one 401 response never retries, even if the JWT expires between preflight and edge', async () => {
  const a = auth(1800); let requests = 0;
  const transport = { async invoke() { requests++; return { data: null, error: { message: 'unauthorized', context: { status: 401 } } }; } };
  await assert.rejects(invokeHmlOnce(a, transport, queue), /session_expired/);
  assert.equal(requests, 1);
});

test('invalid queue identifier is rejected before Auth or network', async () => {
  const a = auth(1800);
  await assert.rejects(invokeHmlOnce(a, { invoke() { throw Error('unreachable'); } }, 'other'), /invalid_queue_id/);
  assert.deepEqual(a.calls, []);
});

test('fresh JWT uses verified identity without unnecessary refresh', async () => {
  const a = auth(1800);
  assert.deepEqual(await currentHmlIdentity(a, 1000), { token: 'old', userId: 'member' });
  assert.deepEqual(a.calls, ['session', 'user:old']);
});

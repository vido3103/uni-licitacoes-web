import assert from 'node:assert/strict';
import test from 'node:test';
import { hmlRuntimeRequest } from '../src/lib/veenceHmlRuntime.ts';

const auth = (valid) => ({
  async getSession() { return { data: { session: { access_token: 'fresh', expires_at: 2000000000 } }, error: null }; },
  async refreshSession() { return { data: { session: null }, error: { message: 'expired' } }; },
  async getUser() { return { data: { user: valid ? { id: 'member' } : null }, error: valid ? null : { message: 'invalid' } }; },
});

test('runtime command uses refreshed identity and never sends JWT in body', async () => {
  let calls = 0;
  const transport = { async invoke(name, options) {
    calls++; assert.equal(name, 'veence-hml-runtime');
    assert.deepEqual(options.body, { action: 'authorize_mock', request_key: 'idempotent' });
    assert.equal(options.headers.Authorization, 'Bearer fresh');
    return { data: { authorization: { id: 'gate' } }, error: null };
  } };
  await hmlRuntimeRequest(auth(true), transport, 'authorize_mock', { request_key: 'idempotent' });
  assert.equal(calls, 1);
});

test('invalid user and HTTP 401 cannot consume authorization or retry', async () => {
  let calls = 0;
  const transport = { async invoke() { calls++; return { data: null, error: { message: 'unauthorized', context: { status: 401 } } }; } };
  await assert.rejects(hmlRuntimeRequest(auth(false), transport, 'run_mock', { authorization_id: 'gate' }), /invalid_session/);
  assert.equal(calls, 0);
  await assert.rejects(hmlRuntimeRequest(auth(true), transport, 'run_mock', { authorization_id: 'gate' }), /session_expired/);
  assert.equal(calls, 1);
});

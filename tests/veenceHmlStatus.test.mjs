import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizedForClient, mayInvoke } from '../supabase/functions/veence-hml-status/policy.ts';

test('only linked client member or active platform owner can see fixture', () => {
  assert.equal(authorizedForClient({ role: 'member' }, null), true);
  assert.equal(authorizedForClient(null, { user_id: 'owner' }), true);
  assert.equal(authorizedForClient(null, null), false);
  assert.equal(authorizedForClient({ role: '' }, null), false);
});

test('fail-closed and queue gates block a second execution', () => {
  const queue = { status: 'pending', attempt_count: 0, max_attempts: 1 };
  assert.equal(mayInvoke(false, queue), false);
  assert.equal(mayInvoke(true, queue), true);
  assert.equal(mayInvoke(true, { ...queue, attempt_count: 1 }), false);
  assert.equal(mayInvoke(true, { ...queue, status: 'failed' }), false);
  assert.equal(mayInvoke(true, { ...queue, max_attempts: 2 }), false);
});

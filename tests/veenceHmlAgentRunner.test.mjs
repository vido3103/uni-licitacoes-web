import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runner = readFileSync(new URL('../supabase/functions/veence-hml-agent-runner/index.ts', import.meta.url), 'utf8');
const gateway = readFileSync(new URL('../supabase/functions/veence-hml-agent-runner/gateway.mjs', import.meta.url), 'utf8');

test('real agent runner is fail-closed before reservation and provider call', () => {
  const killSwitch = runner.indexOf('VEENCE_AI_ENABLED');
  const enabledCheck = runner.indexOf('config.enabled !== true');
  const reservation = runner.indexOf('hml_reserve_authorized_agent_invocation_service');
  const provider = runner.indexOf('callAgentGateway({');
  assert.ok(killSwitch >= 0 && enabledCheck > killSwitch);
  assert.ok(reservation > enabledCheck);
  assert.ok(provider > reservation);
});

test('real agent runner is single-attempt and durable-idempotent', () => {
  assert.match(runner, /reservation\.replayed/);
  assert.match(runner, /retryAllowed:\s*false/g);
  assert.doesNotMatch(runner, /for\s*\([^)]*retry/i);
  assert.doesNotMatch(gateway, /models:\s*/);
  assert.doesNotMatch(gateway, /fallback/i);
});

test('gateway keeps a safe reasoning-output budget and persists reported cost metadata', () => {
  assert.match(gateway, /Math\.min\(Number\(timeoutMs\) \|\| 120000, 120000\)/);
  assert.match(gateway, /Math\.max\(4096, Math\.min\(Number\(maxOutputTokens\) \|\| 4096, 4096\)\)/);
  assert.match(gateway, /reasoningTokens/);
  assert.match(gateway, /finishReason/);
  assert.match(gateway, /reportedCostUsd/);
  assert.match(runner, /hml_complete_agent_invocation_service/);
  assert.match(runner, /hml_fail_agent_invocation_service/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageSql = readFileSync(new URL('../supabase/hml/011_agent_package_v1.sql', import.meta.url), 'utf8');
const gateSql = readFileSync(new URL('../supabase/hml/012_agent_workflow_gate.sql', import.meta.url), 'utf8');
const workflowIdentitySql = readFileSync(new URL('../supabase/hml/015_agent_workflow_identity.sql', import.meta.url), 'utf8');
const releaseSql = readFileSync(new URL('../supabase/hml/016_agent_human_execution_release.sql', import.meta.url), 'utf8');
const snapshotHardeningSql = readFileSync(new URL('../supabase/hml/017_agent_release_snapshot_hardening.sql', import.meta.url), 'utf8');
const controlFunction = readFileSync(new URL('../supabase/functions/veence-hml-agent-control/index.ts', import.meta.url), 'utf8');

test('agent package is configured but remains fail-closed', () => {
  assert.match(packageSql, /enabled\s*=\s*false/i);
  assert.match(packageSql, /openai\/gpt-5-mini/i);
  assert.match(packageSql, /requires_operational_gate/i);
  assert.match(packageSql, /human_final_decision/i);
  assert.match(packageSql, /write_external',\s*false/i);
});

test('multi-agent workflow gate is private, budgeted and requires enabled agents', () => {
  assert.match(gateSql, /enable row level security/i);
  assert.match(gateSql, /revoke all on hml\.agent_workflow_authorizations from public, anon, authenticated/i);
  assert.match(gateSql, /max_cost_usd > 0 and max_cost_usd <= 0\.50/i);
  assert.match(gateSql, /consumed_calls <= max_calls/i);
  assert.match(gateSql, /where agent_code=p_agent_code and enabled for update/i);
  assert.match(gateSql, /grant execute on function hml\.reserve_authorized_agent_invocation[\s\S]*to service_role/i);
});

test('invocation idempotency is durable before any future provider call', () => {
  assert.match(gateSql, /invocation_key=p_invocation_key/i);
  assert.match(gateSql, /'replayed',true/i);
  assert.match(gateSql, /authorization_id uuid references hml\.agent_workflow_authorizations/i);
});

test('human authorization is bound to the exact selected workflow', () => {
  assert.match(workflowIdentitySql, /add column if not exists workflow text/i);
  assert.match(workflowIdentitySql, /p_workflow text/i);
  assert.match(workflowIdentitySql, /a\.workflow is distinct from p_workflow/i);
  assert.match(workflowIdentitySql, /hml_issue_agent_workflow_authorization_v2_service/i);
  assert.match(controlFunction, /p_workflow:workflow/i);
});

test('real multi-agent reservation requires a second explicit human release', () => {
  assert.match(releaseSql, /execution_released_by uuid references auth\.users/i);
  assert.match(releaseSql, /execution_released_at timestamptz/i);
  assert.match(releaseSql, /release_request_key uuid/i);
  assert.match(releaseSql, /a\.execution_released_at is null or a\.execution_released_by<>p_user/i);
  assert.match(releaseSql, /agent\.enabled is distinct from true/i);
  assert.match(releaseSql, /hml_release_agent_workflow_authorization_service/i);
  assert.match(controlFunction, /if\(action==="release"\)/i);
  assert.match(controlFunction, /if\(!globalAiEnabled\)return json\(\{error:"ai_disabled"\}/i);
  assert.match(controlFunction, /if\(!plan\.executionReady\)return json\(\{error:"agents_not_active"/i);
});

test('release idempotency key never leaves the service-role snapshot boundary', () => {
  assert.match(snapshotHardeningSql, /- 'request_key' - 'release_request_key'/i);
  assert.match(releaseSql, /revoke all on function public\.hml_release_agent_workflow_authorization_service[\s\S]*from public,anon,authenticated/i);
  assert.match(releaseSql, /grant execute on function public\.hml_release_agent_workflow_authorization_service[\s\S]*to service_role/i);
});

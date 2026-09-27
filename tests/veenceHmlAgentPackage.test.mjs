import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageSql = readFileSync(new URL('../supabase/hml/011_agent_package_v1.sql', import.meta.url), 'utf8');
const gateSql = readFileSync(new URL('../supabase/hml/012_agent_workflow_gate.sql', import.meta.url), 'utf8');

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

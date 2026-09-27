import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runner = readFileSync(new URL('../supabase/functions/veence-hml-agent-runner/index.ts', import.meta.url), 'utf8');
const workflowRunner = readFileSync(new URL('../supabase/functions/veence-hml-agent-workflow-runner/index.ts', import.meta.url), 'utf8');
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

test('gateway keeps safe reasoning-output headroom and persists reported cost metadata', () => {
  assert.match(gateway, /Math\.min\(Number\(timeoutMs\) \|\| 120000, 120000\)/);
  assert.match(gateway, /Math\.max\(8192, Math\.min\(Number\(maxOutputTokens\) \|\| 8192, 8192\)\)/);
  assert.match(gateway, /Produza JSON compacto e objetivo/);
  assert.match(gateway, /reasoningTokens/);
  assert.match(gateway, /finishReason/);
  assert.match(gateway, /reportedCostUsd/);
  assert.match(runner, /hml_complete_agent_invocation_service/);
  assert.match(runner, /hml_fail_agent_invocation_service/);
});

test('post-run evidence hardening prevents estimate-as-cost and false PDF-read claims', () => {
  assert.match(runner, /estimated_unit_value e estimated_total_value são valores estimados/);
  assert.match(runner, /NUNCA os trate como custo de aquisição/);
  assert.match(runner, /documentAccess\.mode for metadata_only/);
  assert.match(runner, /externalWritesAllowed=false proíbe executar ações externas/);
});

test('official PDFs are signed server-side and attached only once to orchestration', () => {
  assert.match(runner, /agentCode !== "orchestracao_veence"/);
  assert.match(runner, /opportunity_documents/);
  assert.match(runner, /createSignedUrl\(row\.storage_path, PDF_URL_TTL_SECONDS\)/);
  assert.match(runner, /mode: "attached_pdf"/);
  assert.match(runner, /detail: "low"/);
  assert.match(runner, /ORCHESTRATOR_DOCUMENT_RULES/);
  assert.match(gateway, /\/v1\/responses/);
  assert.match(gateway, /type: 'input_file'/);
  assert.match(gateway, /file_url: file\.url/);
  assert.match(gateway, /detail: 'low'/);
  assert.match(gateway, /store: false/);
});

test('workflow preserves role-relevant upstream results and gives audit the full chain', () => {
  assert.match(workflowRunner, /upstreamAgentResults/);
  assert.match(workflowRunner, /habilitacao:\s*\["orchestracao_veence", "triagem"\]/);
  assert.match(workflowRunner, /produtos:\s*\["orchestracao_veence", "triagem"\]/);
  assert.match(workflowRunner, /auditoria:\s*\["orchestracao_veence", "triagem", "habilitacao", "produtos", "suprimentos", "logistica", "economico"\]/);
  assert.match(workflowRunner, /documentAccess:\s*\{/);
  assert.match(workflowRunner, /mode:\s*"metadata_only"/);
  assert.match(workflowRunner, /versions:\s*context\.versions/);
  assert.match(workflowRunner, /workflow_step_context_too_large/);
  assert.match(workflowRunner, /attachedPdfCount/);
});

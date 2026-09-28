import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runner = readFileSync(new URL('../supabase/functions/veence-hml-agent-runner/index.ts', import.meta.url), 'utf8');
const workflowRunner = readFileSync(new URL('../supabase/functions/veence-hml-agent-workflow-runner/index.ts', import.meta.url), 'utf8');
const gateway = readFileSync(new URL('../supabase/functions/veence-hml-agent-runner/gateway.mjs', import.meta.url), 'utf8');

test('real agent runner is fail-closed before reservation and provider call', () => {
  const killSwitch = runner.indexOf('VEENCE_AI_ENABLED');
  const enabledCheck = runner.search(/config\.enabled\s*!==\s*true/);
  const documentPreflight = runner.search(/trustedPdfInputs\(queue,\s*agentCode\)/);
  const reservation = runner.indexOf('hml_reserve_authorized_agent_invocation_service');
  const provider = runner.indexOf('callAgentGateway({');
  assert.ok(killSwitch >= 0 && enabledCheck > killSwitch);
  assert.ok(documentPreflight > enabledCheck && reservation > documentPreflight);
  assert.ok(provider > reservation);
});

test('real agent runner is single-attempt and durable-idempotent', () => {
  assert.match(runner, /reservation\.replayed/);
  assert.match(runner, /retryAllowed:\s*false/g);
  assert.doesNotMatch(runner, /for\s*\([^)]*retry/i);
  assert.doesNotMatch(gateway, /models:\s*/);
  assert.doesNotMatch(gateway, /fallback/i);
});

test('gateway keeps bounded reasoning-output headroom and persists reported cost metadata', () => {
  assert.match(gateway, /Math\.min\(Number\(timeoutMs\) \|\| 120000, 120000\)/);
  assert.match(gateway, /Math\.max\(1024, Math\.min\(Number\.isFinite\(requestedTokens\) \? requestedTokens : 4096, 4096\)\)/);
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
  assert.match(runner, /mandatoryEditalAttachment\s*:\s*true/);
  assert.match(runner, /integralReadRequired\s*:\s*true/);
  assert.match(runner, /assessDocumentRead/);
});

test('official PDFs are signed server-side and edital receives high visual detail', () => {
  assert.match(runner, /agentCode\s*!==\s*"orchestracao_veence"/);
  assert.match(runner, /opportunity_documents/);
  assert.match(runner, /createSignedUrl\(String\(row\.storage_path\),\s*PDF_URL_TTL_SECONDS\)/);
  assert.match(runner, /mode\s*:\s*"attached_pdf"/);
  assert.match(runner, /ORCHESTRATOR_DOCUMENT_RULES/);
  assert.match(gateway, /\/v1\/responses/);
  assert.match(gateway, /type: 'input_file'/);
  assert.match(gateway, /file_url: file\.url/);
  assert.match(gateway, /function pdfDetail/);
  assert.match(gateway, /\? 'high' : 'low'/);
  assert.match(gateway, /detail: pdfDetail\(file\)/);
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

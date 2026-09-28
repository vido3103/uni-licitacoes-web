import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const gatePath = join(root, "supabase", "migrations", "20260928015000_prod_ai_execution_human_gate.sql");
const scopePath = join(root, "supabase", "migrations", "20260928015100_prod_ai_execution_gate_worker_scope.sql");
const workerPath = join(root, "supabase", "functions", "uni-analysis-worker-gemini", "index.ts");

test("gate PROD é fail-closed, auditável e restrito ao service_role", async () => {
  const sql = await readFile(gatePath, "utf8");
  assert.match(sql, /private\.ai_execution_authorizations/i);
  assert.match(sql, /private\.is_platform_owner\(\)/i);
  assert.match(sql, /a\.status='released'/i);
  assert.match(sql, /a\.expires_at>now\(\)/i);
  assert.match(sql, /a\.consumed_claims<a\.max_claims/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /revoke all on function public\.claim_opportunity_ai_analysis_job_service\([^;]+from public,anon,authenticated/i);
  assert.match(sql, /grant execute on function public\.claim_opportunity_ai_analysis_job_service\([^;]+to service_role/i);
  assert.doesNotMatch(sql, /\bhml\s*\./i);
});

test("escopo do gate coincide com WORKER_ID real", async () => {
  const [scopeSql, worker] = await Promise.all([
    readFile(scopePath, "utf8"),
    readFile(workerPath, "utf8"),
  ]);
  const workerId = worker.match(/WORKER_ID\s*=\s*["']([^"']+)["']/)?.[1];
  const gateScope = scopeSql.match(/set default\s+'([^']+)'/i)?.[1];
  assert.ok(workerId, "WORKER_ID não encontrado no worker");
  assert.ok(gateScope, "worker_scope default não encontrado no gate");
  assert.equal(gateScope, workerId);
});

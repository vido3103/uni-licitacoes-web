import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");

test("baseline de produção não contém DDL/DML do schema HML", async () => {
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql"));
  const violations = [];

  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    if (/\bhml\s*\./i.test(sql) || /\bcreate\s+schema\s+(?:if\s+not\s+exists\s+)?hml\b/i.test(sql)) {
      violations.push(file);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Migrações exclusivas de homologação devem ficar em supabase/hml, não em supabase/migrations: ${violations.join(", ")}`,
  );
});

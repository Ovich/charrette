// node --test skills/project-conventions/scripts/rules.test.mjs   (from the repository root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "rules.mjs");
const run = (cwd, ...a) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...a], { cwd, encoding: "utf8" });
  return { status: r.status, out: r.stdout, json: a.includes("--json") && r.stdout ? JSON.parse(r.stdout) : null };
};

function repo(agents, files) {
  const d = mkdtempSync(join(tmpdir(), "rules-"));
  execFileSync("git", ["init", "-q"], { cwd: d });
  writeFileSync(join(d, "AGENTS.md"), agents);
  for (const [f, s] of Object.entries(files)) { mkdirSync(join(d, dirname(f)), { recursive: true }); writeFileSync(join(d, f), s); }
  execFileSync("git", ["add", "-A"], { cwd: d });
  return d;
}

const AGENTS = `# AGENTS.md

## Data

1. **MUST derive row types from Drizzle, never hand-write them.** Copies drift.
2. **SHOULD keep one query file per table.** Two files, two truths.

## API

4. **MUST NOT throw across the handler boundary.** The framework logs nothing.
`;

test("rules, sections, next free number, markers with their rule", () => {
  const d = repo(AGENTS, {
    "src/a.ts": "// AGENTS EXCEPTION (rule 2): the join needs both tables in one file\nexport {};\n",
    "src/b.ts": "// AGENTS EXCEPTION (rule 9): no such rule\nexport {};\n",
    "docs/x.md": "Write `AGENTS EXCEPTION (rule 3)` above the site.\n",
  });
  const r = run(d, "--json");
  assert.equal(r.status, 1);
  assert.deepEqual(r.json.rules.map((x) => [x.number, x.section, x.level]), [[1, "Data", "MUST"], [2, "Data", "SHOULD"], [4, "API", "MUST NOT"]]);
  assert.equal(r.json.next, 5);
  assert.equal(r.json.markers.length, 2);
  assert.deepEqual(r.json.markers.map((m) => [m.rule, m.exists]), [[2, true], [9, false]]);
  assert.equal(r.json.markers[0].reason, "the join needs both tables in one file");
  const text = run(d);
  assert.match(text.out, /3 rules, next free number 5/);
  assert.match(text.out, /BAD\s+rule 9\s+src\/b\.ts:1/);
});

test("clean tree exits 0; duplicate numbers exit 1; no file exits 2", () => {
  const d = repo(AGENTS, { "src/a.ts": "// AGENTS EXCEPTION (rule 1): generated at build\n" });
  assert.equal(run(d).status, 0);
  const dup = repo(AGENTS + "\n4. **MUST log every retry.** Silent retries hide outages.\n", {});
  const r = run(dup);
  assert.equal(r.status, 1);
  assert.match(r.out, /DUPLICATE numbers 4/);
  const empty = mkdtempSync(join(tmpdir(), "rules-"));
  assert.equal(run(empty).status, 2);
});

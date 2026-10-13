// node --test skills/plan/write-plan/scripts/decisions.test.mjs   (from the repository root)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { judge, readCitations, readDocuments } from "./decisions.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "decisions.mjs");
const run = (...a) => {
  const r = spawnSync(process.execPath, [SCRIPT, ...a], { encoding: "utf8" });
  return { status: r.status, out: r.stdout, json: a.includes("--json") && r.stdout ? JSON.parse(r.stdout) : null };
};

/** A docs folder and a code folder (not a git repository) filled with the given files. */
function project(docs, code = {}) {
  const root = mkdtempSync(join(tmpdir(), "decisions-"));
  for (const [where, files] of [["docs", docs], ["code", code]]) {
    for (const [f, s] of Object.entries(files)) { mkdirSync(join(root, where, dirname(f)), { recursive: true }); writeFileSync(join(root, where, f), s); }
    mkdirSync(join(root, where), { recursive: true });
  }
  return { docs: join(root, "docs"), code: join(root, "code") };
}

const table = (...ids) => `## 8. Decisions\n\n| id | Kind | Decision | Status | Source | Slice |\n|---|---|---|---|---|---|\n${ids.map((id) => `| ${id} | contract | something | agreed | the person | — |`).join("\n")}\n`;
const plan = (...ids) => `# alerts, plan\n\n${table(...ids)}`;
const LEGACY = "> **Decision ids**: legacy series\n";
const findings = (p) => judge(readDocuments([p.docs]), readCitations([p.docs], { code: [p.code] }));
const rules = (fs) => fs.map((f) => f.rule).sort();

test("a topic used by two plans is a collision; a plan and a board sharing it are not", () => {
  const p = project({
    "2026-10-01-alerts.plan.md": plan("D1"),
    "2026-10-05-alerts.plan.md": plan("D1"),
    "2026-10-02-alerts.brainstorm.md": plan("D1"),
  });
  const fs = findings(p);
  assert.deepEqual(rules(fs), ["topic"]);
  assert.match(fs[0].text, /alerts is used by 2 plan documents/);
});

test("an id defined twice in one document, and a legacy id defined in two documents", () => {
  const p = project({
    "2026-10-01-alerts.plan.md": plan("D1", "D3", "D3"),
    "2026-09-01-feeds.plan.md": LEGACY + plan("D7"),
    "2026-09-02-vaults.plan.md": LEGACY + plan("D7", "D8"),
  });
  const fs = findings(p);
  assert.deepEqual(rules(fs), ["duplicate", "duplicate"]);
  assert.ok(fs.some((f) => /D3 is defined twice/.test(f.text) && f.file.endsWith("alerts.plan.md") && f.line === 9));
  assert.ok(fs.some((f) => /D7 of the legacy series is defined in 2 documents/.test(f.text)));
});

test("a qualified citation to a missing row or a missing document dangles, with its line", () => {
  const p = project(
    { "2026-10-01-alerts.plan.md": plan("D1", "D3") },
    { "src/feed.py": "# reads the feed\nlimit = 3  # alerts#D9\n", "src/ui.ts": "// alerts.board#D2\n" },
  );
  const fs = findings(p);
  assert.deepEqual(rules(fs), ["dangling", "dangling"]);
  assert.ok(fs.some((f) => f.file.endsWith("feed.py") && f.line === 2 && /has no row D9/.test(f.text)));
  assert.ok(fs.some((f) => f.file.endsWith("ui.ts") && /no board has the topic alerts/.test(f.text)));
});

test("citations that resolve, to a plan and to a board, give no finding", () => {
  const p = project(
    {
      "2026-10-01-alerts.plan.md": plan("D1", "D3"),
      "2026-09-28-alerts.brainstorm.md": table("D1", "D2"),
      "2026-10-02-feeds.plan.md": "Depends on alerts#D3, see also alerts.board#D2.\n" + plan("D1"),
    },
    { "src/feed.py": "x = 1  # alerts#D3\ny = 2  # alerts.board#D2\n" },
  );
  assert.deepEqual(findings(p), []);
});

test("a bare id from code resolves against the legacy series, dangles outside it, and is ignored without one", () => {
  const code = { "src/model.py": '"""The markdown rule, D96."""\nfloor = 0.9  # D97\n' };
  const marked = project({ "2026-09-01-feeds.plan.md": LEGACY + plan("D95", "D96") }, code);
  const fs = findings(marked);
  assert.deepEqual(rules(fs), ["dangling"]);
  assert.ok(fs[0].line === 2 && /D97 is in no document of the legacy series/.test(fs[0].text));
  const unmarked = project({ "2026-09-01-feeds.plan.md": plan("D95") }, code);
  assert.deepEqual(findings(unmarked), []);
});

test("a citation shown in a code span or a fence of a document is an example, not a reference", () => {
  const p = project({
    "2026-10-01-alerts.plan.md": "Cite it as `fork-demo#D4` from code.\n\n```\nalerts#D99\n```\n" + plan("D1"),
  });
  assert.deepEqual(findings(p), []);
  // an escape sequence before a topic is not part of it: "\nalerts#D99" in a string cites alerts
  const q = project({ "2026-10-01-alerts.plan.md": plan("D1") }, { "a.js": 'const s = "\\nalerts#D99";\n' });
  assert.match(findings(q)[0].text, /^alerts#D99: /);
});

test("slice documents are read but neither collide by topic nor dangle on their short ids", () => {
  const p = project({
    "2026-10-01-alerts.plan.md": plan("D1"),
    "2026-10-01-alerts-SL1.slice.md": "Carries D1 and D150 of the plan.\n",
    "2026-10-01-alerts-SL2.slice.md": "Carries D1.\n",
  });
  assert.equal(readDocuments([p.docs]).filter((d) => d.kind === "slice").length, 2);
  assert.deepEqual(findings(p), []);
});

test("the command exits 1 on a finding, 0 without, 2 on a usage error, and --json carries all three lists", () => {
  const bad = project({ "2026-10-01-alerts.plan.md": plan("D1", "D1") });
  const r = run(bad.docs, "--json");
  assert.equal(r.status, 1);
  assert.deepEqual(Object.keys(r.json), ["documents", "citations", "findings"]);
  assert.equal(r.json.findings[0].rule, "duplicate");
  assert.match(run(bad.docs).out, /1 documents, 2 decision ids, 0 citations, 1 finding\n {2}duplicate/);
  const good = project({ "2026-10-01-alerts.plan.md": plan("D1") }, { "a.js": "// alerts#D1\n" });
  assert.equal(run(good.docs, "--code", good.code).status, 0);
  assert.equal(run().status, 2);
  assert.equal(run(join(good.docs, "missing")).status, 2);
});

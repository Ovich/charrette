import { test } from "node:test";
import assert from "node:assert/strict";
import { check, readApproval } from "../src/core/plan.ts";

/** A plan as write-plan writes it: the status in the header, the decisions in §8. */
const plan = (status: string, rows: string) => `# feed, plan

> **Status**: ${status}
> **Delivers**: the feed

## The tracker
Not cut yet.

# Design

## 8. Decisions
| id | Kind | Decision | Status | Source | Slice |
|---|---|---|---|---|---|
${rows}

# Execution

## 9. The slices
`;

const rows = `| D1 | purpose | Ship the feed | agreed | interview | 1 |
| D2 | module | Cache in memory | agreed | \`agent default\` | 1 |
| D3 | contract | Markdown applied at once | agreed | agent default | 1 |`;

test("the defaults are read from the Source column, contract first", () => {
  const p = readApproval(plan("draft", rows));
  assert.equal(p.approved, false);
  assert.equal(p.decisions.length, 3);
  assert.deepEqual(p.defaults.map((d) => d.id), ["D3", "D2"]);
  assert.equal(p.defaults[0]!.line, 16);
  assert.deepEqual(check(p), []);
});

test("an approved plan whose defaults were never confirmed warns, naming them", () => {
  const p = readApproval(plan(`approved: Ada, 2026-10-14, "Yes go for it"`, rows));
  const f = check(p);
  assert.equal(f.length, 1);
  assert.equal(f[0]!.line, 3);
  assert.match(f[0]!.text, /2 agent default\(s\) were never confirmed: D3 \(contract\), D2/);
});

test("confirmed defaults pass; a partial or a stray confirmation warns", () => {
  assert.deepEqual(check(readApproval(plan(`approved: Ada, 2026-10-14, "yes"; defaults confirmed: D2, D3`, rows))), []);
  assert.deepEqual(check(readApproval(plan(`approved: Ada, 2026-10-14, "yes"; defaults confirmed: all`, rows))), []);
  const partial = check(readApproval(plan(`approved: Ada, 2026-10-14, "yes"; defaults confirmed: D2, D9`, rows)));
  assert.equal(partial.length, 2);
  assert.match(partial[0]!.text, /without confirmation: D3 \(contract\)/);
  assert.match(partial[1]!.text, /D9 is confirmed/);
});

test("a plan without defaults, or without a decisions table, is quiet once approved", () => {
  assert.deepEqual(check(readApproval(plan(`approved: Ada, 2026-10-14, "yes"`, "| D1 | purpose | x | agreed | interview | 1 |"))), []);
  assert.deepEqual(check(readApproval(`> **Status**: approved: Ada\n\n# Design\n`)), []);
});

test("a plan with no status line is named", () => {
  const f = check(readApproval("# a plan\n"));
  assert.match(f[0]!.text, /no status line/);
});

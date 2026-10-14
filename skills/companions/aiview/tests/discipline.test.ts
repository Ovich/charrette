import { test } from "node:test";
import assert from "node:assert/strict";
import { captionWarning, forkWarning, disciplineWarnings } from "../src/mermaid/discipline.ts";

const lines = (s: string) => s.split("\n");

test("caption: the nearest non-blank line above the fence, blank lines allowed between", () => {
  const ok = lines("# Title\n\nDependency graph: what may import what.\n\n```mermaid\nflowchart TB\n```");
  assert.equal(captionWarning(ok, 5), undefined);
  const tight = lines("Phasing: what ships first.\n```mermaid\nflowchart TB\n```");
  assert.equal(captionWarning(tight, 2), undefined);
});

test("caption: a heading, a fence, a table row or the top of the file is not a caption", () => {
  assert.match(captionWarning(lines("# Title\n\n```mermaid\nflowchart TB\n```"), 3)!, /no caption/);
  assert.match(captionWarning(lines("```mermaid\nflowchart TB\n```"), 1)!, /no caption/);
  assert.match(captionWarning(lines("```\ncode\n```\n\n```mermaid\nflowchart TB\n```"), 5)!, /no caption/);
  assert.match(captionWarning(lines("| a | b |\n|---|---|\n\n```mermaid\nflowchart TB\n```"), 4)!, /no caption/);
});

test("fork: a chain has no fork, and a labeled fork is fine", () => {
  assert.equal(forkWarning("flowchart TB\n  A --> B --> C\n  C --> D"), undefined);
  assert.equal(forkWarning("flowchart LR\n  G{ok?} -->|yes| S1\n  G -->|no| S2\n  S1 --> S3"), undefined);
  assert.equal(forkWarning("flowchart LR\n  A -- text --> B\n  A -. dotted .-> C\n  A == thick ==> D"), undefined);
});

test("fork: an unlabeled arrow leaving a node that branches is named", () => {
  assert.match(forkWarning("flowchart TB\n  A --> B\n  A --> C")!, /^A branches \(2 arrows\) and none carries a label$/);
  assert.match(forkWarning("flowchart TB\n  A -->|x| B\n  A --> C")!, /A branches \(2 arrows\) and 1 of them carries no label/);
  assert.match(forkWarning("flowchart TB\n  S03[\"step\"] --> S04a[\"a\"]\n  S03 --> S04b[\"b\"]\n  S04a --> S05\n  S04b --> S05")!, /^S03 branches/);
});

test("fork: shapes, classes, subgraphs, dotted and thick arrows, many sources", () => {
  const t = [
    "flowchart TB",
    "  subgraph P[\"phase\"]",
    "    A[\"one --> two\"]:::done -.-> B((b))",
    "    A ==> C{{c}}",
    "  end",
    "  classDef done fill:#0f0",
    "  X & Y --> Z",
  ].join("\n");
  assert.match(forkWarning(t)!, /^A branches \(2 arrows\)/);
  assert.doesNotMatch(forkWarning(t)!, /X|Y|Z/);
});

test("fork: only flowcharts are read", () => {
  assert.equal(forkWarning("sequenceDiagram\n  A->>B: hi\n  A->>C: hi"), undefined);
  assert.equal(forkWarning("stateDiagram-v2\n  [*] --> S\n  [*] --> T"), undefined);
});

test("disciplineWarnings: caption only for markdown, fork for both", () => {
  const md = "```mermaid\nflowchart TB\n  A --> B\n  A --> C\n```";
  assert.equal(disciplineWarnings(lines(md), 1, "flowchart TB\n  A --> B\n  A --> C", true).length, 2);
  assert.equal(disciplineWarnings(lines(md), 1, "flowchart TB\n  A --> B\n  A --> C", false).length, 1);
});

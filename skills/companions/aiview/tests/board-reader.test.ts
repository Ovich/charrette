// The seam from aiview's side (D3): aiview reads the swarm board through swarm's BoardReader,
// imported by relative path, so aiview's typecheck and test runner prove the cross-folder import.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openBoardReader } from "../../swarm/src/board/snapshot.ts";
// The board is written here as swarm's own process would write it: seeding only, never what aiview reads through.
import { openBoard } from "../../swarm/src/board/board.ts";

test("aiview reads a run through the reader", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-board-reader-"));
  const db = path.join(dir, "swarm.sqlite");
  const board = await openBoard(db);
  const reader = await openBoardReader(db);
  try {
    const repo = "/repos/one/.git";
    const run = board.openRun({ repo, group: "review-tool", title: "Review tool", seats: [{ id: "S1", title: "the board", blockers: [] }] });
    const s1 = board.join({ run: run.id, slice: "S1", doing: "the schema", files: [] }).runner;
    board.post(s1, "@orchestrator the schema is in");

    const [summary] = reader.repos();
    assert.equal(summary.repo, repo);
    assert.deepEqual(summary.runs.map((r) => [r.run, r.title]), [[run.id, "Review tool"]]);
    assert.deepEqual(reader.snapshot(repo), board.snapshot(repo));
  } finally {
    reader.close();
    board.close();
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

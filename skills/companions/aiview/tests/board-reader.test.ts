// The seam from aiview's side (D3): aiview reads the swarm board through swarm's BoardReader,
// imported by relative path, so aiview's typecheck and test runner prove the cross-folder import.
import { test, mock } from "node:test";
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

test("`BoardReader.stats` deep-equals `Board.stats` for a run, the across scopes and both kinds (D2, SL2)", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-board-reader-stats-"));
  const db = path.join(dir, "swarm.sqlite");
  // a still clock, so an open run is computed to the same now by both
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-01T09:00:00.000Z") });
  const board = await openBoard(db);
  const reader = await openBoardReader(db);
  try {
    const repo = "/repos/one/.git";
    const seats = [
      { id: "S1", title: "the schema", blockers: [] },
      { id: "S2", title: "the page", blockers: [] },
    ];
    const plan = board.openRun({ repo, group: "review-tool", title: "Review tool", seats });
    const s1 = board.join({ run: plan.id, slice: "S1", doing: "the schema", files: [{ path: "src/a.ts", interface: true }] }).runner;
    const s2 = board.join({ run: plan.id, slice: "S2", doing: "the page", files: [] }).runner;
    board.checkEdit(s2, "src/a.ts");
    board.post(s2, `@${s1.name} I add a helper to src/a.ts`, { about: "src/a.ts" });
    mock.timers.tick(60_000);
    assert.equal(board.lockMerge(s1, "main").granted, true);
    board.merged(s1, "abc123", ["src/a.ts"], { files: ["src/a.ts"] });
    board.end(s1);
    board.end(s2);
    mock.timers.tick(60_000);
    board.closeRun(plan.id);

    const idea = board.openRun({
      repo,
      kind: "brainstorm",
      group: "idea",
      title: "An idea",
      seats: [
        { id: "skeptic", title: "the skeptic", role: "skeptic", blockers: [] },
        { id: "builder", title: "the builder", role: "builder", blockers: [] },
      ],
    });
    const skeptic = board.join({ run: idea.id, slice: "skeptic", doing: "doubting", files: [] }).runner;
    const builder = board.join({ run: idea.id, slice: "builder", doing: "building", files: [] }).runner;
    board.post(builder, "a cache in front, see src/a.ts:12", { about: "D1" });
    const agreed = board.post(builder, "a cache with a one-minute TTL", { about: "D1", kind: "agreement" });
    board.endorse(skeptic, agreed.seq);
    mock.timers.tick(60_000); // the brainstorm run stays open

    const scopes = [
      { repo, run: plan.id },
      { repo, run: idea.id },
      { repo },
      { repo, since: "30d" },
      { repo, closedOnly: true },
      { repo, kinds: ["plan" as const] },
      { repo, kinds: ["brainstorm" as const] },
    ];
    for (const scope of scopes) assert.deepEqual(reader.stats(scope), board.stats(scope), JSON.stringify(scope));
    assert.equal(reader.stats({ repo }).runs.length, 2, "both kinds are in the across scope");
  } finally {
    mock.timers.reset();
    reader.close();
    board.close();
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

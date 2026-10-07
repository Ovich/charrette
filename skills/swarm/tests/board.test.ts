import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openBoard, type Board } from "../src/board/board.ts";

const REPO = "/repos/one/.git";
const SLICES = [
  { id: "S1", title: "the board", blockers: [] },
  { id: "S3", title: "the page", blockers: ["S1"] },
  { id: "S5", title: "the skill", blockers: [] },
];

let dir: string;
let board: Board;
const opened: Board[] = [];

const another = async (): Promise<Board> => {
  const b = await openBoard(path.join(dir, "swarm.sqlite"));
  opened.push(b);
  return b;
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-board-"));
  board = await another();
});

afterEach(() => {
  for (const b of opened.splice(0)) b.close();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const twoRunners = () => {
  const run = board.openRun({ repo: REPO, plan: "review-tool", title: "Review tool", slices: SLICES });
  const s3 = board.join({ run: run.id, slice: "S3", doing: "page", files: [] }).runner;
  const s5 = board.join({ run: run.id, slice: "S5", doing: "skill", files: [] }).runner;
  board.deliver(s3); // the join events
  board.deliver(s5);
  return { run, s3, s5, orchestrator: board.participant("review-tool/orchestrator")! };
};

test("opens a run and lists its slices", () => {
  const run = board.openRun({ repo: REPO, plan: "review-tool", title: "Review tool", slices: SLICES });
  assert.equal(run.state, "open");
  assert.deepEqual(
    run.slices.map((s) => [s.id, s.state, s.blockers]),
    [
      ["S1", "ready", []],
      ["S3", "ready", ["S1"]],
      ["S5", "ready", []],
    ],
  );
  board.setSliceState(run.id, "S1", "running");
  assert.equal(board.runs()[0].slices[0].state, "running");
});

test("join returns every participant of the repository, both plans", () => {
  const a = board.openRun({ repo: REPO, plan: "review-tool", title: "A", slices: SLICES });
  const b = board.openRun({ repo: REPO, plan: "swarm", title: "B", slices: SLICES });
  const other = board.openRun({ repo: "/repos/two/.git", plan: "elsewhere", title: "C", slices: SLICES });
  board.join({ run: a.id, slice: "S3", doing: "page", files: [{ path: "src/x.ts", interface: true }] });
  board.join({ run: other.id, slice: "S1", doing: "far away", files: [] });
  const { runner, roster } = board.join({ run: b.id, slice: "S1", doing: "board", files: [] });
  assert.equal(runner.name, "swarm/S1");
  assert.deepEqual(roster.map((r) => r.name).sort(), ["review-tool/S3", "review-tool/orchestrator", "swarm/S1", "swarm/orchestrator"]);
  const s3 = roster.find((r) => r.name === "review-tool/S3")!;
  assert.equal(s3.doing, "page");
  assert.deepEqual(s3.files, [{ path: "src/x.ts", interface: true }]);
});

test("a mention is delivered in full, the rest as one line", () => {
  const { s3, s5 } = twoRunners();
  const named = board.post(s3, "@S5 I take src/a.ts first\nthen the rest");
  const other = board.post(s3, "progress: half way");
  const d = board.deliver(s5);
  assert.deepEqual(d.full.map((m) => m.seq), [named.seq]);
  assert.equal(d.full[0].body, "@S5 I take src/a.ts first\nthen the rest");
  assert.equal(d.lines.length, 1);
  assert.match(d.lines[0], new RegExp(`^#${other.seq} review-tool/S3: progress: half way$`));
});

test("a runner never receives its own message", () => {
  const { s3 } = twoRunners();
  board.post(s3, "@S3 note to self");
  const d = board.deliver(s3);
  assert.deepEqual(d, { full: [], lines: [] });
});

test("deliver marks delivered, a second deliver is empty", () => {
  const { s3, s5 } = twoRunners();
  board.post(s3, "one");
  board.post(s3, "@S5 two");
  const first = board.deliver(s5);
  assert.equal(first.full.length + first.lines.length, 2);
  assert.deepEqual(board.deliver(s5), { full: [], lines: [] });
});

test("@all reaches its plan only, @plan/S3 crosses", () => {
  const { s3, s5 } = twoRunners();
  const b = board.openRun({ repo: REPO, plan: "swarm", title: "B", slices: SLICES });
  const far = board.join({ run: b.id, slice: "S1", doing: "board", files: [] }).runner;
  board.deliver(far);
  board.deliver(s3);
  board.deliver(s5);

  board.post(s3, "@all rebase on main");
  assert.equal(board.deliver(s5).full.length, 1);
  const farGot = board.deliver(far);
  assert.equal(farGot.full.length, 0);
  assert.equal(farGot.lines.length, 1);

  board.post(s3, "@swarm/S1 your schema touches mine");
  assert.equal(board.deliver(far).full.length, 1);
  assert.equal(board.deliver(s5).full.length, 0);

  board.post(far, "@RT·S3 agreed, I go second"); // the plan code of review-tool (D30)
  assert.equal(board.deliver(s3).full.length, 1);
});

test("wait resolves within 100 ms of a post for it", async () => {
  const { s3, s5 } = twoRunners();
  const poster = await another(); // a second connection, as a second process would hold
  const s3There = poster.participant(s3.name)!;
  let posted = 0;
  setTimeout(() => {
    posted = Date.now();
    poster.post(s3There, "@S5 done with src/a.ts");
  }, 300);
  const d = await board.wait(s5, 5000);
  const latency = Date.now() - posted;
  assert.equal(d.full.length, 1);
  assert.ok(latency < 100, `woke after ${latency} ms`);
});

test("wait resolves empty on timeout", async () => {
  const { s5 } = twoRunners();
  const t0 = Date.now();
  const d = await board.wait(s5, 150);
  assert.deepEqual(d, { full: [], lines: [] });
  assert.ok(Date.now() - t0 >= 140);
});

test("post by an ended runner throws", () => {
  const { s3 } = twoRunners();
  board.end(s3);
  assert.throws(() => board.post(s3, "late"), /review-tool\/S3 has ended/);
});

test("an agreement is a message of kind agreement", () => {
  const { s3, s5 } = twoRunners();
  const m = board.post(s3, "@S5 I own src/a.ts until my merge", { kind: "agreement", about: "src/a.ts" });
  assert.equal(board.read(m.seq).kind, "agreement");
  assert.equal(board.read(m.seq).about, "src/a.ts");
  assert.equal(board.deliver(s5).full[0].kind, "agreement");
});

test("unknown run, runner and seq are named", () => {
  assert.throws(() => board.join({ run: 42, slice: "S1", doing: "x", files: [] }), /unknown run 42/);
  assert.equal(board.participant("nobody/S9"), null);
  assert.throws(() => board.read(99), /unknown message #99/);
});

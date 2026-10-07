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

// ── claims, reconcile, the merge lock (Slice 2) ──────────────────────────────────

const CHECKOUT = path.resolve("/repos/one");
const wt = (name: string): string => path.resolve(`/worktrees/${name}`);

/** S3 holds src/a.ts (declared), S5 holds src/b.ts; each in its own worktree. */
const claimed = () => {
  const run = board.openRun({ repo: REPO, plan: "review-tool", title: "Review tool", slices: SLICES });
  const s3 = board.join({ run: run.id, slice: "S3", doing: "the page", files: [{ path: "src/a.ts", interface: false }], worktree: wt("s3") }).runner;
  const s5 = board.join({ run: run.id, slice: "S5", doing: "the skill", files: [{ path: "src/b.ts", interface: false }], worktree: wt("s5") }).runner;
  board.deliver(s3);
  board.deliver(s5);
  return { run, s3, s5 };
};

test("refuses an edit to a path held by another runner", () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.checkEdit(s3, path.join(wt("s3"), "src/a.ts")), { allowed: true });
  const v = board.checkEdit(s5, path.join(wt("s5"), "src/a.ts"));
  assert.equal(v.allowed, false);
  const refusal = (v as { refusal: string }).refusal;
  assert.match(refusal, /review-tool\/S3/);
  assert.match(refusal, /the page/);
  assert.match(refusal, /`swarm wait`/);
  assert.match(refusal, /`swarm post "@review-tool\/S3 …"`/);
});

test("refuses across two runs on one repository", () => {
  claimed();
  const other = board.openRun({ repo: REPO, plan: "swarm", title: "B", slices: SLICES });
  const s1 = board.join({ run: other.id, slice: "S1", doing: "board", files: [], worktree: wt("swarm-s1") }).runner;
  const v = board.checkEdit(s1, path.join(wt("swarm-s1"), "src/b.ts"));
  assert.equal(v.allowed, false);
  assert.match((v as { refusal: string }).refusal, /held by review-tool\/S5 \(the skill\)/);
  // a run on another repository holds nothing here
  const far = board.openRun({ repo: "/repos/two/.git", plan: "far", title: "C", slices: SLICES });
  const f1 = board.join({ run: far.id, slice: "S1", doing: "x", files: [], worktree: wt("far") }).runner;
  assert.deepEqual(board.checkEdit(f1, path.join(wt("far"), "src/b.ts")), { allowed: true });
});

test("widens the claim on a free undeclared path", () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.checkEdit(s3, path.join(wt("s3"), "src/new.ts")), { allowed: true });
  const v = board.checkEdit(s5, path.join(wt("s5"), "src/new.ts"));
  assert.equal(v.allowed, false);
  assert.match((v as { refusal: string }).refusal, /src\/new\.ts is held by review-tool\/S3/);
});

test("a worktree path and the checkout path are one claim", () => {
  const { s3, s5 } = claimed();
  assert.equal(board.checkEdit(s5, path.join(CHECKOUT, "src", "a.ts")).allowed, false);
  assert.equal(board.checkEdit(s5, path.join(wt("s5"), "src", "a.ts")).allowed, false);
  assert.equal(board.checkEdit(s5, "src/a.ts").allowed, false);
  board.checkEdit(s3, path.join(CHECKOUT, "src", "c.ts"));
  assert.equal(board.checkEdit(s5, path.join(wt("s5"), "src", "c.ts")).allowed, false);
  // outside every root of the repository: no claim at all
  assert.deepEqual(board.checkEdit(s5, path.resolve("/elsewhere/src/a.ts")), { allowed: true });
});

test("end releases the claims", () => {
  const { s3, s5 } = claimed();
  board.end(s3);
  assert.deepEqual(board.checkEdit(s5, path.join(wt("s5"), "src/a.ts")), { allowed: true });
});

test("slice done releases a stale runner's claims", () => {
  const { run, s5 } = claimed();
  board.setSliceState(run.id, "S3", "done");
  assert.deepEqual(board.checkEdit(s5, path.join(wt("s5"), "src/a.ts")), { allowed: true });
});

test("claims a free file written outside the claim", () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.reconcileWrites(s5, ["src/free.ts", "src/b.ts"]), []);
  const v = board.checkEdit(s3, path.join(wt("s3"), "src/free.ts"));
  assert.equal(v.allowed, false);
  assert.match((v as { refusal: string }).refusal, /held by review-tool\/S5/);
});

test("flags a held file written outside the claim, mentioning both", () => {
  const { s3, s5 } = claimed();
  const flags = board.reconcileWrites(s5, ["src/a.ts"]);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].path, "src/a.ts");
  assert.equal(flags[0].holder, "review-tool/S3");
  const m = board.read(flags[0].seq);
  assert.deepEqual([...m.mentions].sort(), ["review-tool/S3", "review-tool/S5"]);
  assert.equal(m.about, "src/a.ts");
  assert.deepEqual(board.deliver(s3).full.map((x) => x.seq), [flags[0].seq]);
  // the holder keeps it
  assert.equal(board.checkEdit(s5, "src/a.ts").allowed, false);
});

test("grants the lock to one runner at a time", () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.lockMerge(s3), { granted: true });
  assert.deepEqual(board.lockMerge(s5), { granted: false, holder: "review-tool/S3" });
  assert.deepEqual(board.lockMerge(s3), { granted: true });
  board.merged(s3, "abc123", ["src/a.ts"]);
  assert.deepEqual(board.lockMerge(s5), { granted: true });
});

test("merged releases the lock and mentions holders and declarers", () => {
  const { run, s3, s5 } = claimed();
  // S1 declares src/b.ts, which S5 holds: a declarer, not a holder
  const s1 = board.join({ run: run.id, slice: "S1", doing: "board", files: [{ path: "src/b.ts", interface: false }], worktree: wt("s1") }).runner;
  board.deliver(s3);
  board.deliver(s5);
  board.deliver(s1);
  const merger = board.participant("review-tool/orchestrator")!;
  assert.deepEqual(board.lockMerge(merger), { granted: true });
  board.merged(merger, "abc123", ["src/b.ts"]);
  assert.deepEqual(board.lockMerge(s3), { granted: true }, "the lock was released");

  const forS5 = board.deliver(s5).full;
  const forS1 = board.deliver(s1).full;
  assert.equal(forS5.length, 1);
  assert.equal(forS1.length, 1);
  assert.equal(forS5[0].seq, forS1[0].seq);
  assert.match(forS5[0].body, /rebase onto abc123/);
  assert.deepEqual([...forS5[0].mentions].sort(), ["review-tool/S1", "review-tool/S5"]);
  // S3 neither holds nor declared src/b.ts: one line, not in full
  const forS3 = board.deliver(s3);
  assert.equal(forS3.full.length, 0);
  assert.equal(forS3.lines.length, 1);
});

test("an interface file in a merge is announced to @all", () => {
  const run = board.openRun({ repo: REPO, plan: "review-tool", title: "A", slices: SLICES });
  const s3 = board.join({ run: run.id, slice: "S3", doing: "api", files: [{ path: "src/api.ts", interface: true }], worktree: wt("s3") }).runner;
  const s5 = board.join({ run: run.id, slice: "S5", doing: "x", files: [], worktree: wt("s5") }).runner;
  const other = board.openRun({ repo: REPO, plan: "swarm", title: "B", slices: SLICES });
  const far = board.join({ run: other.id, slice: "S1", doing: "y", files: [], worktree: wt("far") }).runner;
  for (const p of [s3, s5, far]) board.deliver(p);
  board.lockMerge(s3);
  board.merged(s3, "def456", [path.join(wt("s3"), "src", "api.ts")]);
  for (const p of [s5, far]) {
    const d = board.deliver(p);
    assert.equal(d.full.length, 1, `${p.name} got the announcement in full`);
    assert.match(d.full[0].body, /@all interface changed: src\/api\.ts/);
    assert.match(d.full[0].body, /rebase onto def456/);
  }
});

test("identify resolves a bound agent, a bound session, then the worktree", () => {
  const { run, s3, s5 } = claimed();
  board.bind({ agentId: "a-5", sessionId: "main" }, { run: run.id, slice: "S5" });
  board.bind({ sessionId: "main" }, { plan: "review-tool", slice: "orchestrator" });
  assert.equal(board.identify({ agentId: "a-5", sessionId: "main" })?.name, s5.name);
  assert.equal(board.identify({ sessionId: "main" })?.name, "review-tool/orchestrator");
  // an unbound subagent of that session is not the orchestrator; its cwd decides
  assert.equal(board.identify({ agentId: "a-x", sessionId: "main" }), null);
  assert.equal(board.identify({ agentId: "a-x", sessionId: "main", worktree: path.join(wt("s3"), "src") })?.name, s3.name);
  board.end(s5);
  assert.equal(board.identify({ agentId: "a-5" }), null);
});

test("unknown run, runner and seq are named", () => {
  assert.throws(() => board.join({ run: 42, slice: "S1", doing: "x", files: [] }), /unknown run 42/);
  assert.equal(board.participant("nobody/S9"), null);
  assert.throws(() => board.read(99), /unknown message #99/);
});

// ── the page's view: repos, snapshot, onChange (Slice 3, D39) ─────────────────────

test("a snapshot shows two plans on one repository", () => {
  const { s3 } = claimed();
  const other = board.openRun({ repo: REPO, plan: "swarm", title: "B", slices: SLICES });
  const s1 = board.join({ run: other.id, slice: "S1", doing: "board", files: [{ path: "src/api.ts", interface: true }], worktree: wt("swarm-s1") }).runner;
  board.post(s3, "@swarm/S1 one thread", { about: "src/a.ts" });
  board.lockMerge(s1);

  const snap = board.snapshot(REPO);
  assert.equal(snap.repo, REPO);
  assert.equal(snap.name, "one");
  assert.deepEqual(
    snap.runs.map((r) => [r.plan, r.code, r.title, r.open, r.runners, r.done, r.of]),
    [
      ["review-tool", "RT", "Review tool", true, 2, 0, 3],
      ["swarm", "SW", "B", true, 1, 0, 3],
    ],
  );
  assert.deepEqual(Object.keys(snap.queues).sort(), ["review-tool", "swarm"]);
  assert.deepEqual(
    snap.queues["review-tool"].map((q) => [q.slice, q.title, q.state, q.blockers, q.runner]),
    [
      ["S1", "the board", "ready", [], null],
      ["S3", "the page", "ready", ["S1"], "review-tool/S3"],
      ["S5", "the skill", "ready", [], "review-tool/S5"],
    ],
  );
  const by = Object.fromEntries(snap.roster.map((r) => [r.runner, r]));
  assert.deepEqual(Object.keys(by).sort(), ["review-tool/S3", "review-tool/S5", "review-tool/orchestrator", "swarm/S1", "swarm/orchestrator"]);
  assert.equal(by["review-tool/orchestrator"].state, "watching");
  assert.equal(by["review-tool/S3"].state, "working");
  assert.equal(by["review-tool/S3"].title, "the page");
  assert.equal(by["review-tool/S3"].doing, "the page");
  assert.deepEqual(by["review-tool/S3"].files, [{ path: "src/a.ts", interface: false }]);
  assert.equal(by["swarm/S1"].state, "merging");
  assert.deepEqual(by["swarm/S1"].files, [{ path: "src/api.ts", interface: true }]);
  assert.deepEqual(snap.lock && snap.lock.holder, "swarm/S1");
  const last = snap.events.at(-1)!;
  assert.deepEqual([last.kind, last.from, last.body, last.about], ["msg", "review-tool/S3", "@swarm/S1 one thread", "src/a.ts"]);
  assert.ok(snap.events.every((e, i) => i === 0 || e.seq > snap.events[i - 1].seq), "oldest first");
  // another repository is not in it, and an unknown one is named
  assert.throws(() => board.snapshot("/repos/none/.git"), /no repository \/repos\/none\/\.git/);
});

test("a runner's state: ended, done, waiting", async () => {
  const { run, s3, s5 } = claimed();
  const waiting = board.wait(s5, 400);
  const watcher = await another();
  assert.equal(watcher.snapshot(REPO).roster.find((r) => r.runner === s5.name)!.state, "waiting");
  await waiting;
  board.end(s5);
  board.setSliceState(run.id, "S3", "done");
  const by = Object.fromEntries(board.snapshot(REPO).roster.map((r) => [r.runner, r.state]));
  assert.equal(by[s5.name], "ended");
  assert.equal(by[s3.name], "done");
});

test("a closed run stays in repos() among the last ten", () => {
  const first = board.openRun({ repo: REPO, plan: "old", title: "Old", slices: SLICES });
  board.closeRun(first.id);
  const open = board.openRun({ repo: "/repos/two/.git", plan: "live", title: "Live", slices: SLICES });
  let repos = board.repos();
  assert.deepEqual(repos.map((r) => r.repo), ["/repos/two/.git", REPO], "a repository with an open run first");
  assert.deepEqual(repos[1].runs.map((r) => [r.plan, r.open]), [["old", false]]);
  assert.equal(board.snapshot(REPO).roster.find((r) => r.runner === "old/orchestrator")!.state, "done");
  // ten later closed runs push it out; the open one stays
  for (let i = 0; i < 10; i++) board.closeRun(board.openRun({ repo: "/repos/three/.git", plan: `p${i}`, title: "x", slices: SLICES }).id);
  repos = board.repos();
  assert.deepEqual(repos.map((r) => r.repo), ["/repos/two/.git", "/repos/three/.git"]);
  assert.equal(repos[1].runs.length, 10);
  assert.ok(repos[0].runs.some((r) => r.run === open.id));
});

test("each write fires onChange once with its repository", async () => {
  const watcher = await another(); // a second connection: the page server's
  const seen: string[] = [];
  const off = watcher.onChange((repo) => seen.push(repo));
  const settle = async (what: string): Promise<void> => {
    const t0 = Date.now();
    while (!seen.length && Date.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 150)); // a second call would land here
    assert.deepEqual(seen, [REPO], `${what}: ${JSON.stringify(seen)}`);
    seen.length = 0;
  };
  const run = board.openRun({ repo: REPO, plan: "review-tool", title: "R", slices: SLICES });
  await settle("open a run");
  const s3 = board.join({ run: run.id, slice: "S3", doing: "page", files: [{ path: "src/a.ts", interface: false }], worktree: wt("s3") }).runner;
  await settle("join");
  board.post(s3, "hello");
  await settle("post");
  board.setSliceState(run.id, "S3", "running");
  await settle("slice state");
  board.checkEdit(s3, "src/new.ts");
  await settle("claim widened");
  board.release(s3, "src/new.ts");
  await settle("claim released");
  board.lockMerge(s3);
  await settle("lock taken");
  board.merged(s3, "abc", ["src/a.ts"]);
  await settle("lock released");
  board.end(s3);
  await settle("end");
  board.closeRun(run.id);
  await settle("close the run");
  off();
});

test("calls counts deliveries", () => {
  const { s3 } = claimed();
  const calls = () => board.snapshot(REPO).roster.find((r) => r.runner === s3.name)!.calls;
  const before = calls();
  board.deliver(s3);
  board.deliver(s3);
  assert.equal(calls(), before + 2);
});

test("a flag appears and clears with its claim", () => {
  const { s3, s5 } = claimed();
  board.reconcileWrites(s5, ["src/a.ts", "src/free.ts"]);
  assert.deepEqual(board.snapshot(REPO).flags, [
    { path: "src/a.ts", runner: "review-tool/S5" },
    { path: "src/free.ts", runner: "review-tool/S5" },
  ]);
  board.release(s3, "src/a.ts"); // the holder's claim goes, and with it the flag
  board.release(s5, "src/free.ts");
  assert.deepEqual(board.snapshot(REPO).flags, []);
});

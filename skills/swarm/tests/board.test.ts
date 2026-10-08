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
  const d = await board.wait(s5, { timeoutMs: 5000 });
  const latency = Date.now() - posted;
  assert.equal(d.full.length, 1);
  assert.ok(latency < 100, `woke after ${latency} ms`);
});

test("wait resolves empty on timeout", async () => {
  const { s5 } = twoRunners();
  const t0 = Date.now();
  const d = await board.wait(s5, { timeoutMs: 150 });
  assert.deepEqual(d, { full: [], lines: [] });
  assert.ok(Date.now() - t0 >= 140);
});

test("a mentions-only wait: a one-line event does not end it, a mention does; the event stays for deliver", async () => {
  const { s3, s5 } = twoRunners();
  const poster = await another();
  const s3There = poster.participant(s3.name)!;
  const waiting = board.wait(s5, { timeoutMs: 5000, mentionsOnly: true });
  let done = false;
  void waiting.then(() => (done = true));
  await new Promise((r) => setTimeout(r, 100));
  poster.setDoing(s3There, "the sidebar"); // an event: one line for S5
  poster.post(s3There, "@S1 not for S5"); // a message for someone else: one line for S5
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(done, false, "a line ended a mentions-only wait");
  poster.post(s3There, "@S5 your turn");
  const d = await waiting;
  assert.deepEqual(
    d.full.map((m) => m.body),
    ["@S5 your turn"],
  );
  assert.deepEqual(d.lines, []);
  // what the wait did not return is still undelivered
  const rest = board.deliver(s5);
  assert.equal(rest.full.length, 0);
  assert.equal(rest.lines.length, 2);
  assert.match(rest.lines.join("\n"), /doing: the sidebar/);
  assert.match(rest.lines.join("\n"), /@S1 not for S5/);
});

test("a mentions-only wait ends on an urgent post that does not mention it", async () => {
  const { s5, orchestrator } = twoRunners();
  const poster = await another();
  setTimeout(() => poster.post(poster.participant(orchestrator.name)!, "stop: main is red", { kind: "urgent" }), 100);
  const d = await board.wait(s5, { timeoutMs: 5000, mentionsOnly: true });
  assert.equal(d.full.length + d.lines.length, 1);
  assert.match([...d.full.map((m) => m.body), ...d.lines].join("\n"), /main is red/);
});

test("without mentionsOnly, a wait still ends on any delivery", async () => {
  const { s3, s5 } = twoRunners();
  const poster = await another();
  setTimeout(() => poster.setDoing(poster.participant(s3.name)!, "the sidebar"), 100);
  const d = await board.wait(s5, { timeoutMs: 5000 });
  assert.equal(d.lines.length, 1);
});

test("a newer wait of a runner, from another process, supersedes the older: it returns empty at once; the newer gets the message", async () => {
  const { s3, s5 } = twoRunners();
  const other = await another(); // the foreground wait, in a second process
  const older = board.wait(s5, { timeoutMs: 10_000, mentionsOnly: true });
  let olderAt = 0;
  void older.then(() => (olderAt = Date.now()));
  await new Promise((r) => setTimeout(r, 100));
  const t0 = Date.now();
  const newer = other.wait(other.participant(s5.name)!, { timeoutMs: 10_000, mentionsOnly: true });
  assert.deepEqual(await older, { full: [], lines: [], superseded: true });
  assert.ok(olderAt - t0 < 1000, `superseded after ${olderAt - t0} ms`);
  board.post(s3, "@S5 rebase onto abc");
  const d = await newer;
  assert.equal(d.superseded, undefined);
  assert.deepEqual(d.full.map((m) => m.body), ["@S5 rebase onto abc"]);
  assert.deepEqual(board.deliver(s5), { full: [], lines: [] }, "the message was taken by the newer wait only");
});

test("a superseded wait leaves the newer one's state: listening while a mentions wait is pending, waiting for a plain one", async () => {
  const { s5 } = twoRunners();
  const watcher = await another();
  const s5Of = () => watcher.snapshot(REPO).roster.find((r) => r.runner === s5.name)!;
  const listener = board.wait(s5, { timeoutMs: 10_000, mentionsOnly: true });
  const foreground = watcher.wait(watcher.participant(s5.name)!, { timeoutMs: 400 });
  assert.equal((await listener).superseded, true);
  assert.deepEqual([s5Of().state, s5Of().listening], ["waiting", false]);
  await foreground;
  assert.deepEqual([s5Of().state, s5Of().listening], ["working", false]);
  const first = board.wait(s5, { timeoutMs: 10_000, mentionsOnly: true });
  const second = watcher.wait(watcher.participant(s5.name)!, { timeoutMs: 400, mentionsOnly: true });
  assert.equal((await first).superseded, true);
  assert.deepEqual([s5Of().state, s5Of().listening], ["working", true]);
  await second;
  assert.equal(s5Of().listening, false);
});

test("end releases a pending wait of that runner, empty, at once", async () => {
  const { s5 } = twoRunners();
  const other = await another(); // end from a second connection, as the runner's next call would
  const waiting = board.wait(s5, { timeoutMs: 10_000, mentionsOnly: true });
  await new Promise((r) => setTimeout(r, 100));
  const t0 = Date.now();
  other.end(other.participant(s5.name)!);
  const d = await waiting;
  assert.deepEqual(d, { full: [], lines: [] });
  assert.ok(Date.now() - t0 < 1000, `released after ${Date.now() - t0} ms`);
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

const FREE = { allowed: true, sharedWith: [], notice: null };
const noticeOf = (v: ReturnType<Board["checkEdit"]>): string | null => (v.allowed ? v.notice : `refused: ${v.refusal}`);

test("the first edit of a held file is held, naming the holder and the post that opens it (D41)", () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.checkEdit(s3, path.join(wt("s3"), "src/a.ts")), FREE);
  const v = board.checkEdit(s5, path.join(wt("s5"), "src/a.ts"));
  assert.equal(v.allowed, false);
  const refusal = (v as { refusal: string }).refusal;
  assert.match(refusal, /review-tool\/S3/);
  assert.match(refusal, /the page/);
  assert.match(refusal, /`swarm post "@review-tool\/S3 …" --about src\/a\.ts`/);
  assert.match(refusal, /its holder answers with an agreement on who changes what \(`swarm agree … --about src\/a\.ts`\), and that agreement goes\. Then claim again\.$/);
});

test("a post about the path mentioning the holder opens it; both then hold it", () => {
  const { s3, s5 } = claimed();
  board.checkEdit(s5, path.join(wt("s5"), "src/a.ts"));
  board.post(s5, "@S3 I add isExpired() at the end", { about: "src/a.ts" });
  assert.deepEqual(board.checkEdit(s5, path.join(wt("s5"), "src/a.ts")), {
    allowed: true,
    sharedWith: [{ runner: "review-tool/S3", doing: "the page" }],
    notice: "src/a.ts is also held by review-tool/S3: the page",
  });
  assert.deepEqual(board.snapshot(REPO).files.find((f) => f.path === "src/a.ts")!.holders, ["review-tool/S3", "review-tool/S5"]);
  // the holder's next edit goes through too, told once of the newcomer
  assert.equal(noticeOf(board.checkEdit(s3, "src/a.ts")), "src/a.ts is also held by review-tool/S5: the skill");
});

test("a body naming the file opens it as an about does", () => {
  const { s5 } = claimed();
  board.post(s5, "@S3 in a.ts I only append a helper");
  assert.equal(board.checkEdit(s5, "src/a.ts").allowed, true);
});

test("a post about the path mentioning no holder does not open it", () => {
  const { run, s5 } = claimed();
  board.join({ run: run.id, slice: "S1", doing: "board", files: [], worktree: wt("s1") });
  board.post(s5, "I add isExpired() at the end", { about: "src/a.ts" });
  board.post(s5, "@S1 I add isExpired() at the end", { about: "src/a.ts" }); // S1 does not hold it
  board.post(s5, "@S3 about something else", { about: "src/b.ts" });
  assert.equal(board.checkEdit(s5, "src/a.ts").allowed, false);
});

test("the notice is given once per runner and path", () => {
  const { s3, s5 } = claimed();
  board.post(s5, "@S3 a helper at the end", { about: "src/a.ts" });
  assert.deepEqual(
    [1, 2, 3].map(() => noticeOf(board.checkEdit(s5, "src/a.ts"))),
    ["src/a.ts is also held by review-tool/S3: the page", null, null],
  );
  // another shared path is told of on its own
  board.post(s3, "@S5 one line in b.ts", { about: "src/b.ts" });
  assert.equal(noticeOf(board.checkEdit(s3, "src/b.ts")), "src/b.ts is also held by review-tool/S5: the skill");
  assert.equal(noticeOf(board.checkEdit(s3, "src/b.ts")), null);
});

test("release drops one holder of a shared path", () => {
  const { run, s3, s5 } = claimed();
  board.post(s5, "@S3 a helper at the end", { about: "src/a.ts" });
  board.checkEdit(s5, "src/a.ts");
  board.release(s3, "src/a.ts");
  assert.deepEqual(board.snapshot(REPO).files.find((f) => f.path === "src/a.ts")!.holders, ["review-tool/S5"]);
  const s1 = board.join({ run: run.id, slice: "S1", doing: "board", files: [], worktree: wt("s1") }).runner;
  const v = board.checkEdit(s1, "src/a.ts");
  assert.match((v as { refusal: string }).refusal, /^src\/a\.ts is also held by review-tool\/S5 \(/);
});

test("merged mentions every other holder of a shared path", () => {
  const { run, s3, s5 } = claimed();
  const s1 = board.join({ run: run.id, slice: "S1", doing: "board", files: [], worktree: wt("s1") }).runner;
  for (const p of [s1, s5]) {
    board.post(p, "@S3 my part of a.ts", { about: "src/a.ts" });
    assert.equal(board.checkEdit(p, "src/a.ts").allowed, true);
  }
  for (const p of [s1, s3, s5]) board.deliver(p);
  board.lockMerge(s3);
  board.merged(s3, "abc123", ["src/a.ts"]);
  const m = board.deliver(s5).full[0];
  assert.match(m.body, /rebase onto abc123/);
  assert.deepEqual([...m.mentions].sort(), ["review-tool/S1", "review-tool/S5"]);
  assert.equal(board.deliver(s1).full[0].seq, m.seq);
});

test("a runner is given a funny name at join, unique on the repository; @Name mentions it (D43)", () => {
  const run = board.openRun({ repo: REPO, plan: "review-tool", title: "R", slices: SLICES });
  const other = board.openRun({ repo: REPO, plan: "swarm", title: "B", slices: [{ id: "S1", title: "x", blockers: [] }] });
  const many = Array.from({ length: 30 }, (_, i) => board.join({ run: run.id, slice: `T${i}`, doing: "x", files: [] }).runner);
  const far = board.join({ run: other.id, slice: "S1", doing: "y", files: [] }).runner;
  const nicks = [...many, far].map((p) => p.nick);
  assert.ok(nicks.every((n) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(n)), nicks.join(", "));
  assert.equal(new Set(nicks).size, nicks.length, "unique among the repository's active runners");
  assert.equal(board.participant("review-tool/orchestrator")!.nick, "orchestrator");
  // kept for the run: a second join of the slice keeps it
  assert.equal(board.join({ run: run.id, slice: "T0", doing: "again", files: [] }).runner.nick, many[0].nick);
  assert.equal(board.roster(REPO).find((r) => r.name === far.name)!.nick, far.nick);
  // @SleepyOtter is a mention of that runner, across plans
  const m = board.post(many[1], `@${far.nick.replace(" ", "")} your schema`);
  assert.deepEqual(m.mentions, [far.name]);
});

test("holds the first edit across two runs on one repository", () => {
  claimed();
  const other = board.openRun({ repo: REPO, plan: "swarm", title: "B", slices: SLICES });
  const s1 = board.join({ run: other.id, slice: "S1", doing: "board", files: [], worktree: wt("swarm-s1") }).runner;
  const v = board.checkEdit(s1, path.join(wt("swarm-s1"), "src/b.ts"));
  assert.equal(v.allowed, false);
  assert.match((v as { refusal: string }).refusal, /held by review-tool\/S5 \(\w+ \w+: the skill\)/);
  // a run on another repository holds nothing here
  const far = board.openRun({ repo: "/repos/two/.git", plan: "far", title: "C", slices: SLICES });
  const f1 = board.join({ run: far.id, slice: "S1", doing: "x", files: [], worktree: wt("far") }).runner;
  assert.deepEqual(board.checkEdit(f1, path.join(wt("far"), "src/b.ts")), FREE);
});

test("widens the claim on a free undeclared path, silently", () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.checkEdit(s3, path.join(wt("s3"), "src/new.ts")), FREE);
  const v = board.checkEdit(s5, path.join(wt("s5"), "src/new.ts"));
  assert.equal(v.allowed, false);
  assert.match((v as { refusal: string }).refusal, /src\/new\.ts is also held by review-tool\/S3/);
});

test("a worktree path and the checkout path are one claim", () => {
  const { s3, s5 } = claimed();
  assert.equal(board.checkEdit(s5, path.join(CHECKOUT, "src", "a.ts")).allowed, false);
  assert.equal(board.checkEdit(s5, path.join(wt("s5"), "src", "a.ts")).allowed, false);
  assert.equal(board.checkEdit(s5, "src/a.ts").allowed, false);
  board.checkEdit(s3, path.join(CHECKOUT, "src", "c.ts"));
  assert.equal(board.checkEdit(s5, path.join(wt("s5"), "src", "c.ts")).allowed, false);
  // outside every root of the repository: no claim at all
  assert.deepEqual(board.checkEdit(s5, path.resolve("/elsewhere/src/a.ts")), FREE);
});

test("end releases the claims", () => {
  const { s3, s5 } = claimed();
  board.end(s3);
  assert.deepEqual(board.checkEdit(s5, path.join(wt("s5"), "src/a.ts")), FREE);
});

test("slice done releases a stale runner's claims", () => {
  const { run, s5 } = claimed();
  board.setSliceState(run.id, "S3", "done");
  assert.deepEqual(board.checkEdit(s5, path.join(wt("s5"), "src/a.ts")), FREE);
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

test("a runner refused the lock hears its release by merged in a mentions-only wait (D65)", async () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.lockMerge(s3), { granted: true });
  assert.deepEqual(board.lockMerge(s5), { granted: false, holder: "review-tool/S3" });
  const merger = await another();
  // S3 merged a file S5 neither holds nor declared: only the refusal makes S5 a reader
  setTimeout(() => merger.merged(merger.participant(s3.name)!, "abc123", ["src/a.ts"]), 100);
  const d = await board.wait(s5, { timeoutMs: 5000, mentionsOnly: true });
  assert.equal(d.full.length, 1);
  assert.match(d.full[0].body, /the merge lock is free: @review-tool\/S5/);
  assert.ok(d.full[0].mentions.includes("review-tool/S5"));
  // the record is cleared: the next merge does not mention S5 again
  assert.deepEqual(board.lockMerge(s3), { granted: true });
  board.merged(s3, "def456", ["src/a.ts"]);
  assert.equal(board.deliver(s5).full.length, 0);
});

test("a runner refused the lock hears its release by the holder's end (D65)", async () => {
  const { s3, s5 } = claimed();
  assert.deepEqual(board.lockMerge(s3), { granted: true });
  assert.deepEqual(board.lockMerge(s5), { granted: false, holder: "review-tool/S3" });
  const ender = await another();
  setTimeout(() => ender.end(ender.participant(s3.name)!), 100);
  const d = await board.wait(s5, { timeoutMs: 5000, mentionsOnly: true });
  assert.equal(d.full.length, 1);
  assert.match(d.full[0].body, /the merge lock is free: @review-tool\/S5/);
  assert.deepEqual(board.lockMerge(s5), { granted: true });
});

test("a refusal recorded under one holder is not carried to the next (D65)", () => {
  const { run, s3, s5 } = claimed();
  const s1 = board.join({ run: run.id, slice: "S1", doing: "board", files: [], worktree: wt("s1") }).runner;
  board.deliver(s3);
  board.deliver(s5);
  board.deliver(s1);
  board.lockMerge(s3);
  board.lockMerge(s5); // refused under S3
  board.end(s3); // tells S5, clears the record
  assert.equal(board.deliver(s5).full.length, 1);
  assert.deepEqual(board.lockMerge(s1), { granted: true });
  board.merged(s1, "abc123", ["src/c.ts"]);
  assert.equal(board.deliver(s5).full.length, 0, "S5 was not refused under S1");
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

test("identify resolves the live runner from its worktree, a subdirectory included (D28)", () => {
  const { s3, s5 } = claimed();
  assert.equal(board.identify({ worktree: path.join(wt("s3"), "src") })?.name, s3.name);
  assert.equal(board.identify({ worktree: wt("s5") })?.name, s5.name);
  assert.equal(board.identify({}), null);
  board.end(s5);
  assert.equal(board.identify({ worktree: wt("s5") }), null);
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
  assert.deepEqual(by["review-tool/S3"].files, [{ path: "src/a.ts", interface: false, shared: false }]);
  assert.equal(by["swarm/S1"].state, "merging");
  assert.deepEqual(by["swarm/S1"].files, [{ path: "src/api.ts", interface: true, shared: false }]);
  assert.deepEqual(snap.lock && snap.lock.holder, "swarm/S1");
  const last = snap.events.at(-1)!;
  assert.deepEqual([last.kind, last.from, last.body, last.about], ["msg", "review-tool/S3", "@swarm/S1 one thread", "src/a.ts"]);
  assert.ok(snap.events.every((e, i) => i === 0 || e.seq > snap.events[i - 1].seq), "oldest first");
  // another repository is not in it, and an unknown one is named
  assert.throws(() => board.snapshot("/repos/none/.git"), /no repository \/repos\/none\/\.git/);
});

test("a runner's state: ended, done, waiting", async () => {
  const { run, s3, s5 } = claimed();
  const waiting = board.wait(s5, { timeoutMs: 400 });
  const watcher = await another();
  assert.equal(watcher.snapshot(REPO).roster.find((r) => r.runner === s5.name)!.state, "waiting");
  await waiting;
  board.end(s5);
  board.setSliceState(run.id, "S3", "done");
  const by = Object.fromEntries(board.snapshot(REPO).roster.map((r) => [r.runner, r.state]));
  assert.equal(by[s5.name], "ended");
  assert.equal(by[s3.name], "done");
});

test("a pending mentions-only wait is listening, the state still working; a plain wait is waiting", async () => {
  const { s5 } = twoRunners();
  const watcher = await another();
  const s5Of = () => watcher.snapshot(REPO).roster.find((r) => r.runner === s5.name)!;
  assert.equal(s5Of().listening, false);
  const listening = board.wait(s5, { timeoutMs: 300, mentionsOnly: true });
  assert.deepEqual([s5Of().state, s5Of().listening], ["working", true]);
  await listening;
  assert.equal(s5Of().listening, false);
  const waiting = board.wait(s5, { timeoutMs: 300 });
  assert.deepEqual([s5Of().state, s5Of().listening], ["waiting", false]);
  await waiting;
  assert.equal(s5Of().state, "working");
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

test("calls counts every board call of a runner, one each, a wait's looks none (D66)", async () => {
  const { s3, s5 } = claimed();
  const calls = () => board.snapshot(REPO).roster.find((r) => r.runner === s3.name)!.calls;
  const step = (what: string, call: () => unknown): void => {
    const before = calls();
    call();
    assert.equal(calls(), before + 1, what);
  };
  step("claim", () => board.checkEdit(s3, path.join(wt("s3"), "src/c.ts")));
  step("post", () => board.post(s3, "@S5 a word"));
  step("agree", () => board.post(s3, "S3 changes c.ts", { kind: "agreement" }));
  step("doing", () => board.setDoing(s3, "the tests"));
  step("deliver", () => board.deliver(s3));
  const seq = board.post(s5, "@S3 hello").seq;
  step("read", () => board.read(seq, s3));
  step("release", () => board.release(s3, path.join(wt("s3"), "src/c.ts")));
  step("merge-lock", () => board.lockMerge(s3));
  step("merged", () => board.merged(s3, "abc123", []));
  board.deliver(s3); // nothing left for s3: the wait below times out after several looks
  const before = calls();
  await board.wait(s3, { timeoutMs: 1300 }); // more than one look: the poll runs every second
  assert.equal(calls(), before + 1, "wait");
  step("end", () => board.end(s3));
  // a read with no runner, and a refused call, count none
  const after = calls();
  board.read(seq);
  assert.throws(() => board.post(s3, "too late"));
  assert.equal(calls(), after);
});

test("an ended runner's doing says how it ended, and its end time is kept (D66)", () => {
  const { s3, s5 } = claimed();
  board.setDoing(s3, "writing src/cli.js");
  board.setDoing(s5, "writing src/b.ts");
  assert.deepEqual(board.lockMerge(s3), { granted: true });
  board.merged(s3, "abc123", []);
  board.end(s3);
  board.end(s5);
  const by = Object.fromEntries(board.snapshot(REPO).roster.map((r) => [r.runner, r]));
  assert.equal(by[s3.name].doing, "merged and ended");
  assert.equal(by[s5.name].doing, "ended");
  for (const r of [by[s3.name], by[s5.name]]) {
    assert.ok(r.ended && Date.parse(r.ended) >= Date.parse(r.joined), `${r.runner} ended ${r.ended}`);
  }
});

test("a runner joined again starts unmerged and live (D66)", () => {
  const { run, s3 } = claimed();
  board.lockMerge(s3);
  board.merged(s3, "abc123", []);
  board.end(s3);
  const again = board.join({ run: run.id, slice: "S3", doing: "a second pass", files: [], worktree: wt("s3") }).runner;
  assert.equal(board.snapshot(REPO).roster.find((r) => r.runner === again.name)!.ended, null);
  board.end(again);
  assert.equal(board.snapshot(REPO).roster.find((r) => r.runner === again.name)!.doing, "ended");
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

test("a run and its slices carry their links, opaque, to the snapshot (D44)", () => {
  board.openRun({
    repo: REPO,
    plan: "review-tool",
    title: "R",
    link: "http://localhost:4321/d/12",
    slices: [
      { id: "S1", title: "the board", blockers: [], link: "http://localhost:4321/d/13" },
      { id: "S3", title: "the page", blockers: ["S1"] },
    ],
  });
  const snap = board.snapshot(REPO);
  assert.equal(snap.runs[0].link, "http://localhost:4321/d/12");
  assert.deepEqual(snap.queues["review-tool"].map((q) => [q.slice, q.link]), [["S1", "http://localhost:4321/d/13"], ["S3", null]]);
  assert.equal(board.runs()[0].link, "http://localhost:4321/d/12");
});

test("a store from before shared claims is rebuilt keyed by holder, its claims kept", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const file = path.join(dir, "old.sqlite");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE claims (repo TEXT NOT NULL, path TEXT NOT NULL, participant INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'inside', PRIMARY KEY (repo, path));
           INSERT INTO claims VALUES ('${REPO}', 'src/a.ts', 2, 'interface');`);
  db.close();
  const old = await openBoard(file);
  opened.push(old);
  const run = old.openRun({ repo: REPO, plan: "review-tool", title: "R", slices: SLICES }); // participant 1, the orchestrator
  const s3 = old.join({ run: run.id, slice: "S3", doing: "the page", files: [] }).runner; // participant 2
  const s5 = old.join({ run: run.id, slice: "S5", doing: "the skill", files: [] }).runner;
  assert.equal(s3.id, 2);
  assert.deepEqual(old.snapshot(REPO).files, [{ path: "src/a.ts", holders: ["review-tool/S3"], interface: true }]);
  old.post(s5, "@S3 one helper", { about: "src/a.ts" });
  assert.equal(old.checkEdit(s5, "src/a.ts").allowed, true);
  assert.deepEqual(old.snapshot(REPO).files[0].holders, ["review-tool/S3", "review-tool/S5"]);
});

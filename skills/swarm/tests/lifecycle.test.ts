// The board's lifecycle (D19, D20, D32, D45, D46): a closed run's channel is read-only, pruned
// past the retention with main's old talk, agreements kept; a run whose members went silent is flagged once.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openBoard, type Board } from "../src/board/board.ts";

const REPO = "/repos/one/.git";
const SEATS = [
  { id: "S1", title: "one", blockers: [] },
  { id: "S2", title: "two", blockers: [] },
];
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

let dir: string;
let file: string;
let board: Board;
// the same store, opened raw: what the interface cannot do, dating rows in the past
let raw: import("node:sqlite").DatabaseSync;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-lifecycle-"));
  file = path.join(dir, "swarm.sqlite");
  board = await openBoard(file);
  const { DatabaseSync } = await import("node:sqlite");
  raw = new DatabaseSync(file);
});

afterEach(() => {
  raw.close();
  board.close();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const ago = (ms: number, from = Date.now()): string => new Date(from - ms).toISOString();
const count = (sql: string, ...params: (string | number)[]): number => Number((raw.prepare(sql).get(...params) as { n: number }).n);

const runWithMembers = (group: string) => {
  const run = board.openRun({ repo: REPO, group, title: group, seats: SEATS });
  const s1 = board.join({ run: run.id, slice: "S1", doing: "one", files: [] }).runner;
  const s2 = board.join({ run: run.id, slice: "S2", doing: "two", files: [] }).runner;
  return { run, s1, s2 };
};

/** Closes the run and dates its close, and every message in it, `ms` ago. */
const closedAgo = (run: number, ms: number): void => {
  board.closeRun(run);
  raw.prepare("UPDATE runs SET closed_at = ? WHERE id = ?").run(ago(ms), run);
  raw.prepare("UPDATE messages SET at = ? WHERE run = ?").run(ago(ms + DAY), run);
  // the closed event, in main, dates from the close (D67)
  raw.prepare("UPDATE messages SET at = ? WHERE run IS NULL AND event = 'closed' AND body = ?").run(ago(ms), `run ${run} closed`);
  // the opened event, in main, dates from before it (D69)
  raw.prepare("UPDATE messages SET at = ? WHERE run IS NULL AND event = 'opened' AND body LIKE ?").run(ago(ms + DAY), `run ${run} opened:%`);
};

test("a closed run's channel refuses a post; its messages stay readable", () => {
  const { run, s1, s2 } = runWithMembers("alpha");
  const m = board.post(s1, "before the close");
  board.closeRun(run.id);
  // the members are ended first: that refusal comes before the archive's
  assert.throws(() => board.post(s1, "late"), /has ended/);
  // a member woken behind the board's back still finds the channel archived
  raw.prepare("UPDATE participants SET ended_at = NULL WHERE id IN (?, ?)").run(s1.id, s2.id);
  assert.throws(() => board.post(s1, "late"), new RegExp(`run ${run.id} is closed`));
  assert.throws(() => board.post(s1, "late", { kind: "agreement" }), new RegExp(`run ${run.id} is closed`));
  assert.equal(board.read(m.seq).body, "before the close");
  assert.ok(board.snapshot(REPO).events.some((e) => e.seq === m.seq));
});

test("prune removes a run closed past the retention with its seats, channel and deliveries; keeps a recent one and an open one", () => {
  const old = runWithMembers("old");
  const said = board.post(old.s1, "@S2 in the old channel");
  board.deliver(old.s2);
  closedAgo(old.run.id, 31 * DAY);
  const recent = runWithMembers("recent");
  closedAgo(recent.run.id, 29 * DAY);
  const open = runWithMembers("open");
  raw.prepare("UPDATE runs SET opened_at = ? WHERE id = ?").run(ago(90 * DAY), open.run.id);
  raw.prepare("UPDATE messages SET at = ? WHERE run = ?").run(ago(90 * DAY), open.run.id);

  const removed = board.prune();
  assert.equal(removed.runs, 1);
  // the row stays, stamped, so its id is never handed out again (D61)
  assert.equal(count("SELECT COUNT(*) AS n FROM runs WHERE id = ? AND pruned_at IS NOT NULL", old.run.id), 1);
  assert.equal(count("SELECT COUNT(*) AS n FROM slices WHERE run = ?", old.run.id), 0);
  assert.equal(count("SELECT COUNT(*) AS n FROM participants WHERE run = ?", old.run.id), 0);
  assert.equal(count("SELECT COUNT(*) AS n FROM messages WHERE run = ?", old.run.id), 0);
  assert.equal(count("SELECT COUNT(*) AS n FROM deliveries WHERE seq = ?", said.seq), 0);
  assert.equal(count("SELECT COUNT(*) AS n FROM runs WHERE id = ?", recent.run.id), 1);
  assert.ok(count("SELECT COUNT(*) AS n FROM messages WHERE run = ?", recent.run.id) > 0);
  assert.deepEqual(board.runs().map((r) => r.id), [open.run.id]);
  assert.ok(count("SELECT COUNT(*) AS n FROM messages WHERE run = ?", open.run.id) > 0);
});

test("a pruned run's id is never given to a new run, and the page lists it nowhere (D61)", () => {
  const a = runWithMembers("a");
  closedAgo(a.run.id, 31 * DAY);
  assert.equal(board.prune().runs, 1);
  const b = runWithMembers("b");
  assert.ok(b.run.id > a.run.id, `${b.run.id} > ${a.run.id}`);
  assert.deepEqual(board.snapshot(REPO).runs.map((r) => r.run), [b.run.id]);
  assert.ok(!board.repos().some((r) => r.runs.some((x) => x.run === a.run.id)));
  assert.ok(!board.runs().some((r) => r.id === a.run.id));
});

test("open posts the opened event in main, naming kind, group and title: a member subscribed to main:opened wakes (D69)", async () => {
  const { run: first } = runWithMembers("alpha");
  const watcher = board.join({ run: first.id, slice: "S1", doing: "watching", files: [], on: [{ event: "opened", scope: "main" }] }).runner;
  board.deliver(watcher);
  const run = board.openRun({ repo: REPO, kind: "brainstorm", group: "beta", title: "Beta topic", seats: SEATS });
  const opened = board.snapshot(REPO).events.filter((e) => e.kind === "event" && e.body.startsWith(`run ${run.id} opened`));
  assert.equal(opened.length, 1);
  assert.equal(opened[0].channel, "main");
  assert.equal(opened[0].body, `run ${run.id} opened: brainstorm beta, Beta topic`);
  const { wakes } = await import("../src/board/events.ts");
  assert.ok(wakes(board.read(opened[0].seq), watcher, [{ event: "opened", scope: "main" }]));
});

test("close posts the closed event in main: a member subscribed to main:closed wakes (D67)", async () => {
  const { run } = runWithMembers("alpha");
  const other = board.openRun({ repo: REPO, group: "beta", title: "beta", seats: SEATS });
  const watcher = board.join({ run: other.id, slice: "S1", doing: "watching", files: [], on: [{ event: "closed", scope: "main" }] }).runner;
  board.deliver(watcher);
  board.closeRun(run.id);
  const closed = board.snapshot(REPO).events.filter((e) => e.kind === "event" && e.body === `run ${run.id} closed`);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].channel, "main");
  const { wakes } = await import("../src/board/events.ts");
  const m = board.read(closed[0].seq);
  assert.ok(wakes(m, watcher, [{ event: "closed", scope: "main" }]));
});

test("prune removes main's old talk, keeps agreements and their endorsements, and the pruned author of one", () => {
  const alpha = runWithMembers("alpha");
  const beta = runWithMembers("beta");
  const plain = board.post(alpha.s1, "old news", { channel: "main" });
  const agreement = board.post(alpha.s1, "alpha owns the header", { kind: "agreement", channel: "main" });
  const endorsement = board.endorse(beta.s1, agreement.seq);
  assert.equal(agreement.channel, "main");
  assert.equal(endorsement.channel, "main");
  raw.prepare("UPDATE messages SET at = ? WHERE seq IN (?, ?, ?)").run(ago(40 * DAY), plain.seq, agreement.seq, endorsement.seq);
  closedAgo(alpha.run.id, 31 * DAY);

  const removed = board.prune();
  assert.equal(removed.runs, 1);
  assert.throws(() => board.read(plain.seq), /unknown message/);
  assert.equal(board.read(agreement.seq).from, "alpha/S1");
  assert.equal(board.read(endorsement.seq).endorses, agreement.seq);
  // kept only as the agreement's author: never listed
  assert.deepEqual(board.repos().flatMap((r) => r.runs.map((x) => x.run)), [beta.run.id]);
});

test("a second prune removes nothing", () => {
  const old = runWithMembers("old");
  board.post(old.s1, "kept as author", { kind: "agreement", channel: "main" });
  closedAgo(old.run.id, 31 * DAY);
  const first = board.prune();
  assert.ok(first.runs === 1 && first.messages > 0);
  assert.deepEqual(board.prune(), { messages: 0, runs: 0 });
});

test("prune uses the retention setting, and a run within it stays", () => {
  const { run } = runWithMembers("short");
  closedAgo(run.id, 8 * DAY);
  assert.equal(board.prune().runs, 0);
  board.setting("retention-days", 7);
  assert.equal(board.prune().runs, 1);
  // and `now` moves it: a run closed today, pruned 31 days from now
  const later = runWithMembers("later");
  board.closeRun(later.run.id);
  assert.equal(board.prune(new Date(Date.now() + 6 * DAY)).runs, 0);
  assert.equal(board.prune(new Date(Date.now() + 8 * DAY)).runs, 1);
});

test("the retention setting: 30 by default, set to 7, refuses what is not a positive whole number", () => {
  assert.equal(board.setting("retention-days"), 30);
  assert.equal(board.setting("retention-days", 7), 7);
  assert.equal(board.setting("retention-days"), 7);
  assert.throws(() => board.setting("retention-days", 0), /positive whole number/);
  assert.throws(() => board.setting("retention-days", 1.5), /positive whole number/);
  assert.equal(board.setting("retention-days"), 7);
});

test("a run whose every member is silent is flagged once in main; a call clears the mark", () => {
  const { run, s1 } = runWithMembers("quiet");
  const later = (minutes: number): Date => new Date(Date.now() + minutes * MINUTE);
  assert.deepEqual(board.flagStale(later(5)), []);
  assert.deepEqual(board.flagStale(later(11)), [run.id]);
  const events = board.snapshot(REPO).events.filter((e) => e.body.includes("is stale"));
  assert.equal(events.length, 1);
  assert.equal(events[0].channel, "main");
  assert.equal(events[0].body, `run ${run.id} (quiet) is stale: every member silent; close it or dispatch again`);
  assert.equal(events[0].from, "quiet/orchestrator");
  assert.deepEqual(board.read(events[0].seq).mentions, ["quiet/orchestrator"]);
  assert.deepEqual(board.flagStale(later(12)), []);
  board.setDoing(s1, "back");
  assert.deepEqual(board.flagStale(later(25)), [run.id]);
});

test("one live member keeps the run unflagged", () => {
  const { run, s1 } = runWithMembers("busy");
  raw.prepare("UPDATE participants SET last_call = ?, joined_at = ? WHERE run = ? AND id != ?").run(ago(20 * MINUTE), ago(20 * MINUTE), run.id, s1.id);
  board.setDoing(s1, "still here");
  assert.deepEqual(board.flagStale(), []);
});

test("repos() lists every closed run within the retention, beyond ten, and none pruned", () => {
  const gone = runWithMembers("gone");
  closedAgo(gone.run.id, 40 * DAY);
  const kept: number[] = [];
  for (let i = 0; i < 12; i++) {
    const { run } = runWithMembers(`closed-${i}`);
    closedAgo(run.id, 20 * DAY);
    kept.push(run.id);
  }
  board.prune();
  const listed = board.repos().flatMap((r) => r.runs.map((x) => x.run));
  assert.deepEqual(listed, kept);
});

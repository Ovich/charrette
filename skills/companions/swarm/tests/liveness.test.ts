// Liveness from token counters: the Claude Code JSONL adapter, the adapter registry, and the
// stall rule the run's poller applies, with the readings and the clock injected.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openBoard, type Board } from "../src/board/board.ts";
import { EVENTS } from "../src/board/events.ts";
import { ADAPTERS, claudeCodeJsonl, readTranscript, stallDue, type TranscriptReader } from "../src/board/liveness.ts";

const REPO = "/repos/one/.git";
let dir: string;
let board: Board;
/** What the injected reader answers per path: a token count, or null for unreadable. */
let counters: Map<string, number | null>;
const read: TranscriptReader = (file) => {
  const n = counters.get(path.basename(file));
  return n == null ? null : { adapter: "test", cursor: { offset: 0, tokens: n } };
};

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-liveness-"));
  counters = new Map();
  board = await openBoard(path.join(dir, "swarm.sqlite"), { readTranscript: read });
});

afterEach(() => {
  board.close();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const line = (usage: Record<string, number> | null): string => JSON.stringify({ type: usage ? "assistant" : "user", message: usage ? { usage } : { content: "x" } }) + "\n";

test("the Claude Code adapter sums the four usage counts over complete lines, by byte offset; a torn last line waits", () => {
  const f = path.join(dir, "t.jsonl");
  fs.writeFileSync(f, line(null) + line({ input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 }));
  const first = readTranscript(f, null)!;
  assert.equal(first.adapter, "claude-code-jsonl");
  assert.equal(first.cursor.tokens, 1115);
  assert.equal(first.cursor.offset, fs.statSync(f).size);
  fs.appendFileSync(f, line({ input_tokens: 1, output_tokens: 2 }) + '{"type":"assist');
  const second = readTranscript(f, first)!;
  assert.equal(second.cursor.tokens, 1118);
  fs.appendFileSync(f, 'ant","message":{"usage":{"output_tokens":7}}}\n');
  assert.equal(readTranscript(f, second)!.cursor.tokens, 1125);
  // nothing new: the same reading
  assert.deepEqual(readTranscript(f, readTranscript(f, second)), readTranscript(f, second));
});

test("a missing file, or one no adapter recognises, reads null; the registry holds the Claude Code adapter", () => {
  assert.equal(readTranscript(path.join(dir, "none.jsonl"), null), null);
  const text = path.join(dir, "t.txt");
  fs.writeFileSync(text, "hello\nworld\n");
  assert.equal(readTranscript(text, null), null);
  assert.equal(claudeCodeJsonl.read(Buffer.from("[1]\n"), { offset: 0, tokens: 0 }), null);
  assert.ok(ADAPTERS.includes(claudeCodeJsonl));
});

test("stallDue: at each whole threshold of silence", () => {
  assert.equal(stallDue(4999, 0, 5000), false);
  assert.equal(stallDue(5000, 0, 5000), true);
  assert.equal(stallDue(9000, 1, 5000), false);
  assert.equal(stallDue(10000, 1, 5000), true);
});

/** A brainstorm with two seats, the orchestrator's and a's counters registered; b has none. */
const setup = () => {
  counters.set("o.jsonl", 1).set("a.jsonl", 1);
  const run = board.openRun({
    repo: REPO,
    kind: "brainstorm",
    group: "idea",
    title: "I",
    transcript: path.join(dir, "o.jsonl"),
    seats: [
      { id: "a", title: "A", blockers: [], transcript: path.join(dir, "a.jsonl") },
      { id: "b", title: "B", blockers: [] },
    ],
  });
  const a = board.join({ run: run.id, slice: "a", doing: "x", files: [] }).runner;
  const b = board.join({ run: run.id, slice: "b", doing: "x", files: [] }).runner;
  const orchestrator = board.participant("idea/orchestrator")!;
  return { run, a, b, orchestrator };
};
const stalls = () => board.snapshot(REPO).events.filter((e) => e.event === "stalled");
const warnings = () => board.snapshot(REPO).events.filter((e) => e.event === "liveness");
const at = (base: number, s: number): Date => new Date(base + s * 1000);

test("the stall rule: moves → nothing; flat 5 s → stalled; flat 10 s → a second; a move re-arms it; the orchestrator alone is mentioned", () => {
  const { run, a, b, orchestrator } = setup();
  const base = Date.now() + 60_000;
  counters.set("o.jsonl", 2).set("a.jsonl", 2);
  assert.equal(board.livenessTick(run.id, at(base, 0)), true);
  counters.set("a.jsonl", 3);
  board.livenessTick(run.id, at(base, 1));
  board.livenessTick(run.id, at(base, 2));
  assert.equal(stalls().length, 0, "a counter moved");
  board.livenessTick(run.id, at(base, 5.9));
  assert.equal(stalls().length, 0);
  board.livenessTick(run.id, at(base, 6));
  assert.equal(stalls().length, 1);
  const first = stalls()[0];
  assert.equal(first.body, "stalled 5s: no token counter moved; last active idea/a 5s ago; no phase open");
  assert.deepEqual(first.mentions, ["idea/orchestrator"]);
  board.livenessTick(run.id, at(base, 7));
  board.livenessTick(run.id, at(base, 10));
  assert.equal(stalls().length, 1);
  board.livenessTick(run.id, at(base, 11));
  assert.equal(stalls().length, 2);
  assert.match(stalls()[1].body, /^stalled 10s:/);
  // a move re-arms: the next silence counts from it
  counters.set("o.jsonl", 9);
  board.livenessTick(run.id, at(base, 12));
  board.livenessTick(run.id, at(base, 16));
  assert.equal(stalls().length, 2);
  board.phase(orchestrator, "diverge", "every idea");
  board.livenessTick(run.id, at(base, 17));
  assert.equal(stalls().length, 3);
  assert.equal(stalls()[2].body, "stalled 5s: no token counter moved; last active idea/orchestrator 5s ago; phase diverge 0/2 done");
  // the orchestrator has it in full, told its next step; a seat sees it only as a line of a later deliver
  assert.ok(board.deliver(orchestrator).full.some((m) => m.event === "stalled"));
  for (const p of [a, b]) {
    const d = board.deliver(p);
    assert.ok(!d.full.some((m) => m.event === "stalled"), p.name);
    assert.ok(d.lines.some((l) => /stalled/.test(l)), p.name);
  }
  const m = board.read(stalls()[2].seq);
  assert.match(EVENTS.stalled.next!(m, orchestrator, "swarm")!, /^read the thread, then open the next phase .* or address the member who owes a move/);
  assert.equal(EVENTS.stalled.next!(m, a, "swarm"), null);
  assert.ok(!EVENTS.stalled.always);
});

test("stalled wakes the orchestrator's wait --mentions, never a seat's; its repeats count up while nothing moves", async () => {
  const { run, a, orchestrator } = setup();
  const base = Date.now() + 60_000;
  counters.set("o.jsonl", 2).set("a.jsonl", 2);
  board.livenessTick(run.id, at(base, 0));
  // what was already for them (b's liveness warning, the joins) is had first
  board.deliver(a);
  board.deliver(orchestrator);
  const seat = board.wait(a, { mentionsOnly: true, timeoutMs: 400 });
  const orch = board.wait(orchestrator, { mentionsOnly: true, timeoutMs: 2000 });
  for (const s of [5, 10, 15, 20]) board.livenessTick(run.id, at(base, s));
  const [heardSeat, heardOrch] = await Promise.all([seat, orch]);
  assert.deepEqual(heardSeat.full, [], "a seat is not woken by stalled");
  assert.ok(heardOrch.full.some((m) => m.event === "stalled"));
  assert.deepEqual(
    stalls().map((e) => e.body.split(":")[0]),
    ["stalled 5s", "stalled 10s", "stalled 15s", "stalled 20s"],
  );
});

test("liveness warnings: no transcript at join, and a counter that stops reading, once per member and condition; unreadable counters are out of the rule", () => {
  const { run } = setup();
  assert.deepEqual(
    warnings().map((e) => e.body),
    ["liveness: no readable transcript for idea/b, stall check blind for it"],
  );
  const base = Date.now() + 60_000;
  counters.set("o.jsonl", 2).set("a.jsonl", null);
  board.livenessTick(run.id, at(base, 0));
  board.livenessTick(run.id, at(base, 1));
  assert.deepEqual(warnings().map((e) => e.body).slice(1), ["liveness: no readable transcript for idea/a, stall check blind for it"]);
  const card = board.snapshot(REPO).roster.find((r) => r.runner === "idea/a")!;
  assert.deepEqual(card.liveness, { state: "unreadable", tokens: null, movedAt: null });
  assert.deepEqual(board.snapshot(REPO).roster.find((r) => r.runner === "idea/b")!.liveness, { state: "none", tokens: null, movedAt: null });
  const orch = board.snapshot(REPO).roster.find((r) => r.runner === "idea/orchestrator")!.liveness!;
  assert.deepEqual([orch.state, orch.tokens, orch.movedAt], ["ok", 2, at(base, 0).toISOString()]);
  // read again, then failing again: warned again
  counters.set("a.jsonl", 5);
  board.livenessTick(run.id, at(base, 2));
  counters.set("a.jsonl", null);
  board.livenessTick(run.id, at(base, 3));
  assert.equal(warnings().length, 3);
  // only readable counters count: the orchestrator's has been flat since 0
  board.livenessTick(run.id, at(base, 5));
  assert.match(stalls()[0]?.body ?? "", /^stalled 5s: .* last active idea\/orchestrator/);
});

test("an open with no transcript warns for the orchestrator; a closed run's tick stops the poller; the threshold is the run's", () => {
  const run = board.openRun({ repo: REPO, kind: "brainstorm", group: "slow", title: "S", seats: [{ id: "a", title: "A", blockers: [] }], stallMs: 8000 });
  assert.equal(warnings()[0].body, "liveness: no readable transcript for slow/orchestrator, stall check blind for it");
  assert.equal(board.snapshot(REPO).runs[0].stallMs, 8000);
  counters.set("x.jsonl", 1);
  board.registerTranscript(run.id, "orchestrator", path.join(dir, "x.jsonl"));
  const base = Date.now() + 60_000;
  counters.set("x.jsonl", 2);
  board.livenessTick(run.id, at(base, 0));
  board.livenessTick(run.id, at(base, 5));
  assert.equal(stalls().length, 0, "8 s, not 5");
  board.livenessTick(run.id, at(base, 8));
  assert.equal(stalls().length, 1);
  assert.throws(() => board.registerTranscript(run.id, "nobody", "x"), /unknown slice nobody/);
  board.closeRun(run.id);
  assert.equal(board.livenessTick(run.id, at(base, 9)), false);
  assert.equal(board.livenessTick(999, at(base, 9)), false);
});

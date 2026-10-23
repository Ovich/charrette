// Board.stats on a brainstorm run (SL3): its questions D<n>, their outcomes and exchanges, the skeptic's marks, the
// claims with a source, and totals.brainstorm, read through Board.stats alone.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { MemberStats, RunStats } from "../src/board/board.ts";
import { REPO, at, brainstormRun, clockTo, planRun, scratchBoard, type ScratchBoard } from "./fixtures/stats-board.ts";

let s: ScratchBoard;
beforeEach(async () => {
  s = await scratchBoard("swarm-stats-brainstorm-");
});
afterEach(() => s.done());

const runOf = (run: number): RunStats => s.board.stats({ repo: REPO, run }).runs[0];
const memberOf = (r: RunStats, name: string): MemberStats => r.members.find((m) => m.member === name)!;
const question = (r: RunStats, id: string) => r.brainstorm!.questions.find((q) => q.id === id)!;

test("the outcome is the first agreement the skeptic endorsed; another seat's endorsement settles nothing (D30, SL3)", () => {
  const { board } = s;
  const { run, m: [skeptic, a, b] } = brainstormRun(board, "debate", ["skeptic", "a", "b"]);
  clockTo(1);
  const g1 = board.post(a, "keep one store", { about: "D1", kind: "agreement" });
  clockTo(2), board.endorse(b, g1.seq);
  clockTo(3);
  const g2 = board.post(a, "keep one store, one table per record", { about: "D1", kind: "agreement" });
  clockTo(4), board.endorse(skeptic, g2.seq);
  clockTo(5);
  const g3 = board.post(b, "one store, as agreed", { about: "D1", kind: "agreement" });
  clockTo(6), board.endorse(skeptic, g3.seq);
  // D2: endorsed by a seat that is not the skeptic only
  clockTo(7);
  const h = board.post(a, "name it stats", { about: "D2", kind: "agreement" });
  clockTo(8), board.endorse(b, h.seq);
  const r = runOf(run);
  assert.deepEqual(question(r, "D1").outcome, { at: at(3), seq: g2.seq, kind: "agreed" });
  assert.equal(question(r, "D2").outcome, null);
});

test("the skeptic by id `skeptic`, else by its subscription to `agreement` (D30, SL3)", () => {
  const { board } = s;
  // a seat named skeptic wins over a seat subscribed to agreement
  const one = brainstormRun(board, "named", ["skeptic", "watcher", "a"], { watcher: ["agreement"] });
  const [skeptic, watcher, a] = one.m;
  clockTo(1);
  const g1 = board.post(a, "keep one store", { about: "D1", kind: "agreement" });
  clockTo(2), board.endorse(watcher, g1.seq);
  const g2 = board.post(a, "keep one table", { about: "D2", kind: "agreement" });
  clockTo(3), board.endorse(skeptic, g2.seq);
  const named = runOf(one.run);
  assert.equal(question(named, "D1").outcome, null);
  assert.equal(question(named, "D2").outcome?.seq, g2.seq);
  // no seat named skeptic: the one subscribed to agreement is
  const two = brainstormRun(board, "subscribed", ["critic", "b"], { critic: ["agreement"] });
  const [critic, b] = two.m;
  clockTo(4);
  const g3 = board.post(b, "keep one store", { about: "D1", kind: "agreement" });
  clockTo(5), board.endorse(critic, g3.seq);
  const subscribed = runOf(two.run);
  assert.equal(question(subscribed, "D1").outcome?.seq, g3.seq);
  assert.deepEqual(memberOf(subscribed, critic.name).marks.map((x) => x.what), ["endorsed"]);
});

test("exchanges count `msg`, `urgent` and `agreement` about `D<n>` strictly before the outcome, never the outcome's own agreement, events or posts after (D33, D46 point 4, SL3, SL11)", () => {
  const { board } = s;
  const { run, m: [skeptic, a, b] } = brainstormRun(board, "debate", ["skeptic", "a", "b"]);
  clockTo(1), board.post(a, "the store should stay one file", { about: "D1" });
  clockTo(2), board.post(b, "it cannot, the lock contends", { about: "D1", kind: "urgent" });
  clockTo(3), board.setDoing(a, "weighing D1");
  clockTo(4);
  const g = board.post(a, "one file, one writer", { about: "D1", kind: "agreement" });
  clockTo(5), board.endorse(skeptic, g.seq);
  clockTo(6), board.post(b, "and after the outcome, one more thought", { about: "D1" });
  clockTo(7), board.post(a, "an agreement after the outcome", { about: "D1", kind: "agreement" });
  // the post and the urgent one; the outcome's agreement is none (D46)
  assert.equal(question(runOf(run), "D1").exchanges, 2);
});

test("a post about anything but `D<n>` is no question and still counts in its author's posts (D4, SL3)", () => {
  const { board } = s;
  const { run, m: [, a] } = brainstormRun(board, "debate", ["skeptic", "a"]);
  clockTo(1), board.post(a, "on the framing first", { about: "framing" });
  clockTo(2), board.post(a, "and a word with no about");
  clockTo(3), board.post(a, "Decision 1 is premature", { about: "D1x" });
  const r = runOf(run);
  assert.deepEqual(r.brainstorm!.questions, []);
  assert.equal(memberOf(r, a.name).posts, 3);
});

test("the skeptic's post after an agreement it did not endorse is an `objected` mark; `claimsWithSource.inferred` is true and a source named in words is unsourced (D23, SL3)", () => {
  const { board } = s;
  const { run, m: [skeptic, a, b] } = brainstormRun(board, "debate", ["skeptic", "a", "b"]);
  clockTo(1), board.post(a, "the reader module says so, in its header comment", { about: "D1" });
  clockTo(2), board.post(b, "src/board/stats.ts:120 shows it", { about: "D1" });
  clockTo(3);
  const g = board.post(a, "keep the reader as it is", { about: "D1", kind: "agreement" });
  clockTo(4);
  const objection = board.post(skeptic, "it does not hold for a pruned run", { about: "D1" });
  const r = runOf(run);
  const objected = memberOf(r, skeptic.name).marks.filter((x) => x.what === "objected");
  assert.deepEqual(
    objected.map((x) => [x.at, x.seq, x.path]),
    [[at(4), objection.seq, "D1"]],
  );
  assert.match(objected[0].note, new RegExp(`#${g.seq}`));
  assert.deepEqual(r.brainstorm!.claimsWithSource, { n: 1, of: 3, inferred: true });
  assert.deepEqual(
    [memberOf(r, a.name).unsourced, memberOf(r, b.name).unsourced, memberOf(r, skeptic.name).unsourced],
    [1, 0, 1],
  );
});

test("a brainstorm run carries `brainstorm` and no `plan`, a plan run the reverse; no budget figure, no escalated outcome (D24, D29, SL3)", () => {
  const { board } = s;
  const debate = brainstormRun(board, "debate", ["skeptic", "a"]);
  clockTo(1);
  const g = board.post(debate.m[1], "keep one store", { about: "D1", kind: "agreement" });
  clockTo(2), board.endorse(debate.m[0], g.seq);
  board.post(debate.m[1], "and D2 stays open", { about: "D2" });
  const plan = planRun(board, "app", ["S1"]);
  const out = board.stats({ repo: REPO });
  const d = out.runs.find((r) => r.run === debate.run)!;
  const p = out.runs.find((r) => r.run === plan.run)!;
  assert.ok("brainstorm" in d && !("plan" in d));
  assert.ok("plan" in p && !("brainstorm" in p));
  const text = JSON.stringify(out);
  assert.doesNotMatch(text, /budget/i);
  assert.doesNotMatch(text, /escalat/i);
  assert.deepEqual(
    d.brainstorm!.questions.map((q) => q.outcome?.kind ?? null),
    ["agreed", null],
  );
});

test("`totals.brainstorm` over the scope's brainstorm runs, null where not computed (D34, SL3)", () => {
  const { board } = s;
  planRun(board, "app", ["S1"]);
  const plans = board.stats({ repo: REPO, kinds: ["plan"] }).totals.brainstorm;
  assert.deepEqual(plans, {
    notRecorded: null,
    questionsSettled: null,
    questions: null,
    exchangesMedian: null,
    objectedThenAgreed: null,
    sourcedShare: null,
    claimsWithSource: { n: null, of: null },
    silentSeats: null,
  });
  // run one: D1 settled with no exchange before its outcome, D2 after 1, D3 open
  const one = brainstormRun(board, "first", ["skeptic", "a"]);
  clockTo(1);
  const g1 = board.post(one.m[1], "keep one store", { about: "D1", kind: "agreement" });
  board.endorse(one.m[0], g1.seq);
  board.post(one.m[1], "one table, see #12", { about: "D2" });
  const g2 = board.post(one.m[1], "one table", { about: "D2", kind: "agreement" });
  board.endorse(one.m[0], g2.seq);
  board.post(one.m[1], "D3 stays open", { about: "D3" });
  // run two: D1 objected, then settled after 4 exchanges
  const two = brainstormRun(board, "second", ["skeptic", "a", "b"]);
  const [skeptic, a, b] = two.m;
  clockTo(2);
  board.post(a, "keep the cache", { about: "D1", kind: "agreement" });
  board.post(skeptic, "the cache goes stale", { about: "D1" });
  board.post(a, "it is cleared on every write", { about: "D1" });
  board.post(b, "agreed, as https://example.org/cache says", { about: "D1" });
  const g3 = board.post(a, "keep the cache, cleared on every write", { about: "D1", kind: "agreement" });
  board.endorse(skeptic, g3.seq);
  clockTo(3);
  const t = board.stats({ repo: REPO, kinds: ["brainstorm"] }).totals.brainstorm;
  assert.deepEqual(t, {
    notRecorded: 0,
    questionsSettled: 3,
    questions: 4,
    // [0, 1, 4]: the outcome's own agreement is no exchange (D46)
    exchangesMedian: 1,
    objectedThenAgreed: 1,
    // claims up to the outcome: run one's 2 posts (1 sourced), run two's 3 (1 sourced)
    sourcedShare: 2 / 5,
    // the share's own figures, so the page writes "2 of 5" without counting (D35)
    claimsWithSource: { n: 2, of: 5 },
    silentSeats: 0,
  });
});

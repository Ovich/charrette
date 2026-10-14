// The board page's view functions (D3, D18, D46), on snapshots built here.
import { describe, expect, test } from "vitest";
import type { BoardSnapshot, RunSummary, SnapshotEvent, SnapshotRunner } from "../src/board/board.ts";
import { channels, defaultChannel, feed, mentionCtx, scope, showsClaims, showsMergeLock } from "./lib/view.ts";

const run = (id: number, kind: "plan" | "brainstorm", group: string, open = true): RunSummary => ({
  run: id, kind, plan: group, group, code: "XX", title: `${group} title`, link: null, open, runners: 0, done: 0, of: 0,
});
const member = (group: string, slice: string, state: SnapshotRunner["state"] = "working"): SnapshotRunner => ({
  runner: `${group}/${slice}`, nick: `Nick ${slice}`, plan: group, slice, title: slice, doing: "", state, stale: false,
  files: [], joined: "2026-10-14T10:00:00Z", ended: null, calls: 0, listening: false, on: [],
});
let seq = 0;
const post = (channel: "main" | number, from: string, body: string): SnapshotEvent => ({
  seq: ++seq, at: "2026-10-14T10:00:00Z", kind: "msg", from, body, about: null, channel,
});
const board = (runs: RunSummary[], roster: SnapshotRunner[] = [], events: SnapshotEvent[] = []): BoardSnapshot => ({
  repo: "/r/.git", name: "r", runs, lock: null, roster, events, queues: {},
  files: [{ path: "a.ts", holders: ["p/S1", "q/S2"], interface: true }], flags: [],
});

describe("channels", () => {
  test("groups open runs by kind, oldest first, and lists every closed run newest first", () => {
    const snap = board([run(5, "plan", "p5"), run(2, "plan", "p2"), run(3, "brainstorm", "b3"), run(1, "plan", "c1", false), run(4, "brainstorm", "c4", false)]);
    const g = channels(snap);
    expect(g.main.id).toBe("main");
    expect(g.plans.map((c) => c.id)).toEqual([2, 5]);
    expect(g.brainstorms.map((c) => c.id)).toEqual([3]);
    expect(g.closed.map((c) => c.id)).toEqual([4, 1]);
    expect(g.closed.every((c) => !c.open)).toBe(true);
  });

  test("a brainstorm-only board: its run under brainstorms, no plans, neither claims nor merge lock (D3)", () => {
    const snap = board([run(1, "brainstorm", "b")]);
    const g = channels(snap);
    expect(g.brainstorms.map((c) => c.id)).toEqual([1]);
    expect(g.plans).toEqual([]);
    expect(showsClaims(snap)).toBe(false);
    expect(showsMergeLock(snap)).toBe(false);
  });

  test("a plan open shows claims and the merge lock; a closed plan does not", () => {
    expect(showsClaims(board([run(1, "brainstorm", "b"), run(2, "plan", "p")]))).toBe(true);
    expect(showsMergeLock(board([run(1, "brainstorm", "b"), run(2, "plan", "p")]))).toBe(true);
    expect(showsMergeLock(board([run(1, "brainstorm", "b"), run(2, "plan", "p", false)]))).toBe(false);
  });
});

describe("scope", () => {
  const snap = board(
    [run(1, "plan", "p"), run(2, "plan", "q")],
    [member("p", "S1"), member("q", "S2"), member("q", "S3", "ended")],
    [post("main", "p/S1", "on main"), post(1, "p/S1", "in p @q/S2"), post(2, "q/S2", "in q")],
  );

  test("main holds main's events only, never a run's own talk (D18), and every active member", () => {
    const s = scope(snap, "main");
    expect(s.events.map((e) => e.body)).toEqual(["on main"]);
    expect(s.roster.map((r) => r.runner).sort()).toEqual(["p/S1", "q/S2"]);
  });

  test("a run holds only its events and its roster; files are the whole repository's (D26)", () => {
    const s = scope(snap, 2);
    expect(s.events.map((e) => e.body)).toEqual(["in q"]);
    expect(s.roster.map((r) => r.runner)).toEqual(["q/S2", "q/S3"]);
    expect(s.files[0].holders).toEqual(["p/S1", "q/S2"]);
  });
});

describe("the rail's counts and the default channel", () => {
  const ev = (channel: "main" | number, kind: SnapshotEvent["kind"]): SnapshotEvent => ({ ...post(channel, "p/S1", "x"), kind });
  const snap = board(
    [run(1, "plan", "p"), run(2, "plan", "q", false)],
    [member("p", "S1")],
    [ev("main", "event"), ev("main", "event"), ev("main", "msg"), ev(1, "event"), ev(1, "msg"), ev(2, "agreement")],
  );

  test("each channel counts what its thread shows under Everything, events included", () => {
    const g = channels(snap);
    const shown = (c: "main" | number) => feed(scope(snap, c).events, "all", null, mentionCtx(snap)).length;
    expect(g.main.entries).toBe(3);
    expect(g.main.entries).toBe(shown("main"));
    expect(g.plans[0].entries).toBe(shown(1));
    expect(g.closed[0].entries).toBe(shown(2));
  });

  test("Main while a run is open or none exists, else the newest closed run", () => {
    expect(defaultChannel(snap)).toBe("main");
    expect(defaultChannel(board([]))).toBe("main");
    expect(defaultChannel(board([run(3, "plan", "a", false), run(7, "brainstorm", "b", false)]))).toBe(7);
  });
});

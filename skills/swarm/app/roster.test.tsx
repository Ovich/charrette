// The roster card's wakes-on line (D59): the member's subscriptions, nothing when it has none.
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { SnapshotRunner } from "../src/board/board.ts";
import { Roster } from "./components/Roster.tsx";

afterEach(cleanup);

const member = (slice: string, on: string[]): SnapshotRunner => ({
  runner: `idea/${slice}`, nick: `Nick ${slice}`, plan: "idea", slice, title: slice, doing: "thinking", state: "working", stale: false,
  files: [], joined: "2026-10-14T10:00:00Z", ended: null, calls: 0, listening: false, on,
});

const show = (roster: SnapshotRunner[]) =>
  render(<Roster roster={roster} planTitle={() => "An idea"} focus={null} fresh={new Set()} onFollow={() => {}} />);

test("a member with subscriptions shows wakes on: …", () => {
  show([member("skeptic", ["agreement", "main:merged"])]);
  expect(screen.getByText("wakes on: agreement, main:merged")).toBeTruthy();
});

test("a member with none shows no wakes-on line", () => {
  const { container } = show([member("architect", [])]);
  expect(container.querySelector("[data-component=WakesOn]")).toBeNull();
});

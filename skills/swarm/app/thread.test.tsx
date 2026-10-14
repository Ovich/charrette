// The thread's flag row and a merged event's recipients (D10), rendered.
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { SnapshotEvent } from "../src/board/board.ts";
import { Thread } from "./components/Thread.tsx";

afterEach(cleanup);

const ev = (seq: number, kind: SnapshotEvent["kind"], from: string, body: string, about: string | null = null): SnapshotEvent => ({
  seq, at: "2026-10-14T10:00:00Z", kind, from, body, about, channel: 1,
});
const flag = ev(1, "event", "p/S1", "@p/S2 @p/S1 flag: p/S1 wrote src/a.ts outside its claim; p/S2 holds it. Settle it here.", "src/a.ts");
const ctx = { groups: ["p"], names: new Map<string, string>() };

const renderThread = (shown: SnapshotEvent[]) =>
  render(
    <Thread chips={[]} shown={shown} channelEvents={shown} ctx={ctx} filter="all" focus={null} isLit={() => false} fresh={new Set()} onFilter={() => {}} onUnfollow={() => {}} onShowAll={() => {}} />,
  );

test("a flag renders as a flag row with its chip, path, two runners and its answer", () => {
  const { container } = renderThread([flag, ev(2, "agreement", "p/S2", "S1 takes the bottom", "src/a.ts")]);
  const row = container.querySelector('li[data-kind="flag"]') as HTMLElement;
  expect(row).not.toBeNull();
  expect(row.querySelector('[data-component="FlagChip"][data-kind="flag"]')?.textContent).toBe("flag");
  expect(within(row).getByText("src/a.ts").tagName).toBe("CODE");
  expect(within(row).getByText("S1")).toBeTruthy();
  expect(within(row).getByText("S2")).toBeTruthy();
  expect(row.querySelector('[data-component="FlagAnswer"]')?.textContent).toBe("settled by #2");
});

test("an unanswered flag reads open", () => {
  const { container } = renderThread([flag]);
  expect(container.querySelector('[data-component="FlagAnswer"]')?.textContent).toBe("open");
});

test("a merged event shows whom it told to rebase and whom of a resolved conflict", () => {
  renderThread([
    ev(1, "event", "p/S1", "merged abc: rebase onto abc.\n@p/S2: you hold or declared a file it changed.\nfiles: src/a.ts"),
    ev(2, "msg", "p/S1", "@p/S3 I resolved src/a.ts: kept both", "src/a.ts"),
  ]);
  const rebase = document.querySelector('[data-recipients="rebase"]') as HTMLElement;
  const tell = document.querySelector('[data-recipients="tell"]') as HTMLElement;
  expect(within(rebase).getByText("S2")).toBeTruthy();
  expect(within(tell).getByText("S3")).toBeTruthy();
  expect(screen.getByText(/rebase onto abc/)).toBeTruthy();
});

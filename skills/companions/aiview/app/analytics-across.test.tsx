// The across-runs view (board D10, plan D28, D32-D35; mockup #677 `across` and `empty`): useStats stood
// in for with a `Stats` fixture whose totals disagree with its runs, useBoard with the board fixtures.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LIVE } from "./board-fixtures.ts";
import { ACROSS, ACROSS_ALL_KNOWN, ACROSS_EMPTY, PLAN_RUN, bodyOf } from "./stats-fixtures.ts";
import { source, standIn } from "./stats-stand-in.ts";

vi.mock("./hooks/useBoard.ts", async () => ({ useBoard: (await import("./stats-stand-in.ts")).useBoardStandIn }));
vi.mock("./hooks/useStats.ts", async () => ({ useStats: (await import("./stats-stand-in.ts")).useStatsStandIn }));

import { BoardView } from "./components/viewers/board/BoardView.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The board on All, then the Analytics pill beside the merge lock. */
const openAcross = (across = ACROSS) => {
  standIn([LIVE], across, [PLAN_RUN]);
  const view = render(<BoardView repos={[LIVE.repo]} run={null} />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Runs" })).getByRole("button", { name: "Analytics" }));
  return view;
};
const across = () => screen.getByText("Across runs").closest('[data-component="AcrossRunsView"]') as HTMLElement;
const tile = (label: string): HTMLElement => {
  const found = [...across().querySelectorAll<HTMLElement>('[data-component="KpiTile"]')].find((t) => t.querySelector(".k")?.textContent?.startsWith(label));
  if (!found) throw new Error(`no tile ${label}`);
  return found;
};
const valueOf = (label: string): string => tile(label).querySelector(".v")!.textContent!;

test("the page counts nothing (D28, D34, D35)", () => {
  openAcross();
  // summing the runs' flags gives 1, their known conflicts 1, counting them 3 plan runs; the totals say 7, 5 and 11
  expect(valueOf("Flags")).toBe("7edits outside a claim");
  expect(valueOf("Rebase conflicts")).toMatch(/^5/);
  expect(tile("Rebase conflicts").textContent).toContain("3 in shared files");
  expect(valueOf("Slices merged")).toBe("29of 33");
  expect(tile("Slices merged").textContent).toContain("11 plan runs");
  expect(valueOf("Lock wait")).toBe("4m 10sp50");
  expect(screen.getByText("14 runs · 37 members · charrette-app")).toBeTruthy();
  // the funnel's four steps, from totals.shared: 9, 8, 6, 4 (the runs' perFile hold 2 files)
  const funnel = across().querySelector('[data-component="SharingFunnel"]') as HTMLElement;
  expect([...funnel.querySelectorAll(".step .num")].map((n) => n.textContent)).toEqual(["9", "8", "6", "4"]);
  // the lock panel: totals.lockWait, its bins as written
  const lock = across().querySelector('[data-component="MergeLockPanel"]') as HTMLElement;
  expect(lock.textContent).toContain("23 merges · p50 4m 10s · p90 9m");
  expect([...lock.querySelectorAll(".hist .col span")].map((n) => n.textContent)).toEqual(["6", "5", "7", "3", "2"]);
});

test("a null figure reads not recorded, never 0; a tile over runs some unrecorded says N runs not recorded; the sparkline has a gap at the unrecorded run (US1, D32, D33)", () => {
  openAcross();
  expect(valueOf("Silent members")).toBe("not recorded");
  expect(tile("Silent members").querySelector(".v")!.textContent).not.toMatch(/0/);
  for (const label of ["Slices merged", "Slice time", "Lock wait", "Shared files settled", "Flags", "Rebase conflicts", "Silent members"]) {
    expect(within(tile(label)).getByText("1 run not recorded")).toBeTruthy();
  }
  // [2, null, 4, 5]: three points, the line broken at the null, one line through the last two
  const spark = tile("Slices merged").querySelector("svg")!;
  expect(spark.querySelectorAll("circle")).toHaveLength(3);
  const lines = spark.querySelectorAll("polyline");
  expect(lines).toHaveLength(1);
  expect(lines[0].getAttribute("points")!.split(" ")).toHaveLength(2);
});

test("unknown merges: the amber chip and + N unknown; with no unknown merge, no chip (US4, board D16)", () => {
  const { container } = openAcross();
  const chip = container.querySelector('[data-part="git-chip"]') as HTMLElement;
  expect(chip.textContent).toBe("⚠ git 2.38+ needed · 2 merges with conflicts unknown");
  expect(chip.classList.contains("warnchip")).toBe(true);
  expect(tile("Rebase conflicts").textContent).toContain("+ 2 unknown");
  cleanup();
  const known = openAcross(ACROSS_ALL_KNOWN);
  expect(known.container.querySelector('[data-part="git-chip"]')).toBeNull();
  expect(tile("Rebase conflicts").textContent).not.toContain("unknown");
});

test("no closed run: the empty state, verbatim (SL4)", () => {
  openAcross(ACROSS_EMPTY);
  expect(across().dataset.state).toBe("empty");
  expect(screen.getByText("No run has closed on this board yet.")).toBeTruthy();
  const why = screen.getByText(/^Analytics read closed runs\./);
  expect(why.textContent).toBe("Analytics read closed runs. Open one with swarm open; its figures appear here when it closes.");
  expect(within(why).getByText("swarm open").tagName).toBe("CODE");
  expect(across().querySelector('[data-component="KpiTile"]')).toBeNull();
});

test("the periods Last 7 days, Last 30 days, Every run kept; the last kind chip on cannot be turned off (D33)", () => {
  openAcross();
  const period = screen.getByRole("combobox", { name: "Period" }) as HTMLSelectElement;
  expect([...period.options].map((o) => o.textContent).sort()).toEqual(["Every run kept", "Last 30 days", "Last 7 days"]);
  fireEvent.change(period, { target: { value: "7d" } });
  expect(source.asks.at(-1)).toEqual({ period: "7d", kinds: ["plan", "brainstorm"] });
  fireEvent.change(period, { target: { value: "all" } });
  expect(source.asks.at(-1)).toEqual({ period: "all", kinds: ["plan", "brainstorm"] });
  const chip = (k: string) => within(across()).getByRole("button", { name: k });
  fireEvent.click(chip("plan"));
  expect(chip("plan").getAttribute("aria-pressed")).toBe("false");
  expect(source.asks.at(-1)).toEqual({ period: "all", kinds: ["brainstorm"] });
  // brainstorm is the last one on: it stays on
  fireEvent.click(chip("brainstorm"));
  expect(chip("brainstorm").getAttribute("aria-pressed")).toBe("true");
  expect(source.asks.at(-1)).toEqual({ period: "all", kinds: ["brainstorm"] });
});

test("Copy as JSON puts the response body on the clipboard, unchanged (US3, D34)", async () => {
  openAcross();
  fireEvent.click(within(across()).getByRole("button", { name: "Copy as JSON" }));
  await waitFor(() => expect(source.copied).toHaveLength(1));
  expect(source.copied[0]).toBe(bodyOf(ACROSS));
});

test("a runs-table row opens its run's tab on Analytics (D33, SL5)", () => {
  openAcross();
  const table = across().querySelector('[data-component="RunsTable"]') as HTMLElement;
  const row = within(table).getByText("The login page").closest("tr")!;
  fireEvent.click(row);
  expect(screen.queryByText("Across runs")).toBeNull();
  // run 4 is closed: its tab is the archived one, pressed, on Analytics
  const tab = screen.getByText("The login page", { selector: ".t" }).closest('[data-component="ArchivedTab"]') as HTMLElement;
  expect(tab.getAttribute("aria-pressed")).toBe("true");
  const view = within(screen.getByRole("group", { name: "This run" }));
  expect(view.getByRole("button", { name: "Analytics" }).getAttribute("aria-pressed")).toBe("true");
  expect(source.asks.at(-1)).toEqual({ run: 4 });
  expect(location.hash).toContain("run=4&view=analytics");
});

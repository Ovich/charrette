// One run's Analytics (board D10, plan D23, D24, D29-D33, D40; mockup #677 `run`, `brun`): useStats stood in
// for with one run's `Stats`, its members' counts disagreeing with their spans and marks.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RunSummary, Stats } from "../../swarm/src/board/snapshot.ts";
import { CLOSED, LIVE, RUNS } from "./board-fixtures.ts";
import { BRAINSTORM_RUN, LP_S4, OPEN_RUN, PLAN_RUN, UNRECORDED_RUN, bodyOf } from "./stats-fixtures.ts";
import { source, standIn } from "./stats-stand-in.ts";

vi.mock("./hooks/useBoard.ts", async () => ({ useBoard: (await import("./stats-stand-in.ts")).useBoardStandIn }));
vi.mock("./hooks/useStats.ts", async () => ({ useStats: (await import("./stats-stand-in.ts")).useStatsStandIn }));

import { BoardView } from "./components/viewers/board/BoardView.tsx";
import { RunAnalytics } from "./components/viewers/board/RunAnalytics.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LP_SUMMARY = CLOSED[0];
const TT_SUMMARY = CLOSED[1];
const OLD_SUMMARY: RunSummary = { ...LP_SUMMARY, run: 8, plan: "old-login", group: "old-login", code: "OL", title: "The old login" };

/** One run's tab on Analytics, alone. */
const showRun = (summary: RunSummary, stats: Stats) => {
  standIn([LIVE], null, [stats]);
  return render(<RunAnalytics repo={LIVE.repo} summary={summary} onView={() => {}} onOpenPost={() => {}} />);
};
const view = () => document.querySelector('[data-component="RunAnalytics"]') as HTMLElement;
const part = (name: string): HTMLElement | null => view().querySelector(`[data-component="${name}"]`);
const tile = (label: string): HTMLElement => {
  const found = [...view().querySelectorAll<HTMLElement>('[data-component="KpiTile"]')].find((t) => t.querySelector(".k")?.textContent?.startsWith(label));
  if (!found) throw new Error(`no tile ${label}`);
  return found;
};
const rowOf = (table: HTMLElement, text: string): HTMLElement => within(table).getAllByText(text)[0].closest("tr")!;
const lane = (member: string): HTMLElement => part("RunTimeline")!.querySelector(`[data-lane="${member}"]`) as HTMLElement;

test("a plan run draws its seven tiles, the timeline under the lock band, the members table and the shared-files list; a brainstorm run its six tiles, the questions chart, the seats timeline and the seats table (US2, SL5)", () => {
  showRun(LP_SUMMARY, PLAN_RUN);
  expect(view().querySelectorAll('[data-component="KpiTile"]')).toHaveLength(7);
  const timeline = part("RunTimeline")!;
  const rows = [...timeline.querySelectorAll(".tl > .row")];
  expect(rows[0].classList.contains("lockband")).toBe(true);
  expect(rows[0].textContent).toContain("merge lock");
  expect(rows.slice(1).map((r) => r.getAttribute("data-lane"))).toEqual(["login-page/orchestrator", "login-page/S4"]);
  expect(part("MembersTable")).toBeTruthy();
  expect(part("SharedFilesList")).toBeTruthy();
  expect(part("SeatsTable")).toBeNull();
  cleanup();

  showRun(TT_SUMMARY, BRAINSTORM_RUN);
  expect(view().querySelectorAll('[data-component="KpiTile"]')).toHaveLength(6);
  expect(part("QuestionsChart")).toBeTruthy();
  expect(part("RunTimeline")!.querySelector(".label")!.textContent).toBe("Seats");
  expect(part("RunTimeline")!.querySelector(".lockband")).toBeNull();
  expect(part("SeatsTable")).toBeTruthy();
  expect(part("MembersTable")).toBeNull();
  expect(part("SharedFilesList")).toBeNull();
});

test("a member's counts come from the stats: the waiting tag and the seats table read waitingMs, agreementsMade, endorsed, objections even where the fixture's spans and marks would count otherwise (D35, D40, S5.2)", () => {
  // S4's waiting spans add up to one minute; its waitingMs is twelve
  showRun(LP_SUMMARY, PLAN_RUN);
  const time = rowOf(part("MembersTable")!, LP_S4.nick).querySelectorAll("td")[1];
  expect(time.textContent).toContain("· 12m waiting");
  cleanup();

  // the skeptic's marks: one endorsement, no objection, no agreement; the user's: one agreement
  showRun(TT_SUMMARY, BRAINSTORM_RUN);
  const seats = part("SeatsTable")!;
  const cells = (nick: string) => [...rowOf(seats, nick).querySelectorAll("td")].slice(1).map((c) => c.textContent);
  expect(cells("Witty Heron")).toEqual(["5", "4", "3", "2", "1"]);
  expect(cells("Jolly Walrus")).toEqual(["4", "2", "—", "0", "2"]);
});

test("inferred spans are drawn apart, dashed, and the legend names silent: no command for 10 min, from silentAfterMs; both legends toggle (board D9, D33, SL5)", () => {
  showRun(LP_SUMMARY, PLAN_RUN);
  const segs = [...lane("login-page/S4").querySelectorAll<HTMLElement>(".seg")];
  const inferred = (what: string) => segs.filter((s) => s.classList.contains(`s-${what}`)).map((s) => s.classList.contains("inferred"));
  expect(inferred("working")).toEqual([true, true]);
  expect(inferred("silent")).toEqual([true]);
  expect(inferred("waiting")).toEqual([false]);
  expect(inferred("merging")).toEqual([false]);
  const legend = within(part("RunTimeline")!.querySelector(".legend") as HTMLElement);
  const silent = legend.getByRole("button", { name: "silent: no command for 10 min" });
  // the plan run's legend toggles: silent off hides the silent span, on shows it again
  fireEvent.click(silent);
  expect(silent.getAttribute("aria-pressed")).toBe("false");
  expect(lane("login-page/S4").querySelector(".s-silent")).toBeNull();
  fireEvent.click(silent);
  expect(lane("login-page/S4").querySelector(".s-silent")).toBeTruthy();
  cleanup();

  // the brainstorm run's legend toggles too: post off hides the seats' posts
  showRun(TT_SUMMARY, BRAINSTORM_RUN);
  const seatsLegend = within(part("RunTimeline")!.querySelector(".legend") as HTMLElement);
  expect(lane("theme-tokens/skeptic").querySelectorAll(".post")).toHaveLength(3);
  fireEvent.click(seatsLegend.getByRole("button", { name: /post/ }));
  expect(lane("theme-tokens/skeptic").querySelectorAll(".post")).toHaveLength(0);
});

test("a run with recorded: false: the Not recorded line in place of the lanes, — in Time, not recorded for lock wait and conflicts (D32, D33, SL5)", () => {
  showRun(OLD_SUMMARY, UNRECORDED_RUN);
  const timeline = part("RunTimeline")!;
  expect(within(timeline).getByText("Not recorded: this run closed before analytics recorded member activity.")).toBeTruthy();
  expect(timeline.querySelector("[data-lane]")).toBeNull();
  expect(rowOf(part("MembersTable")!, "Quiet Llama").querySelectorAll("td")[1].textContent).toBe("—");
  expect(tile("Lock wait").querySelector(".v")!.textContent).toBe("not recorded");
  expect(tile("Rebase conflicts").querySelector(".v")!.textContent).toBe("not recorded");
});

test("an open run's line says open (D32, D33, SL5)", () => {
  showRun(RUNS[0], OPEN_RUN);
  const line = screen.getByText(/^plan · run 1 · /).textContent!;
  expect(line.split(" · ")[2]).toBe("open");
  expect(line).not.toContain("closed");
});

test("a shared file whose conflict is unknown reads conflict unknown (git older than 2.38) (D33, SL5)", () => {
  showRun(LP_SUMMARY, PLAN_RUN);
  const list = part("SharedFilesList")!;
  expect(rowOf(list, "src/session.ts").querySelectorAll("td")[2].textContent).toBe("none · conflict unknown (git older than 2.38)");
  expect(rowOf(list, "src/login.ts").querySelectorAll("td")[2].textContent).toBe("agreed 2m after · conflict at merge");
});

test("no exchange cap, question title, escalation, for the person or budget anywhere (D24, D29, SL5)", () => {
  for (const [summary, stats] of [
    [LP_SUMMARY, PLAN_RUN],
    [TT_SUMMARY, BRAINSTORM_RUN],
  ] as const) {
    const { container } = showRun(summary, stats);
    expect(container.textContent).not.toMatch(/exchange cap|\bcap\b|escalat|for the person|budget|redispatch/i);
    cleanup();
  }
  // a question is its D<n> alone: no title beside it
  showRun(TT_SUMMARY, BRAINSTORM_RUN);
  const chart = part("QuestionsChart")!;
  expect([...chart.querySelectorAll(".row .name")].map((n) => n.textContent)).toEqual(["D1", "D2"]);
});

test("the run's Copy as JSON puts the --run body on the clipboard, unchanged (US3, D40, SL5)", async () => {
  showRun(LP_SUMMARY, PLAN_RUN);
  expect(source.asks.at(-1)).toEqual({ run: 4 });
  fireEvent.click(screen.getByRole("button", { name: "Copy as JSON" }));
  await waitFor(() => expect(source.copied).toHaveLength(1));
  expect(source.copied[0]).toBe(bodyOf(PLAN_RUN));
});

test("a mark with a seq opens Conversation on that post (SL5)", () => {
  const agreement = LIVE.events.find((e) => e.kind === "agreement" && e.run === 1)!;
  const run1: Stats = {
    ...OPEN_RUN,
    runs: [{ ...OPEN_RUN.runs[0], members: [{ ...LP_S4, member: "refresh-tokens/S4", marks: [{ at: agreement.at, what: "agreement", seq: agreement.seq, note: "RT·S4 adds audit()" }] }] }],
  };
  standIn([LIVE], null, [run1]);
  history.replaceState(null, "", "#run=1&view=analytics");
  const scrolled: string[] = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.id);
  };
  render(<BoardView repos={[LIVE.repo]} run={null} />);
  const mk = lane("refresh-tokens/S4").querySelector(".mk.m-agreement") as HTMLElement;
  fireEvent.click(mk);
  const seg = within(screen.getByRole("group", { name: "This run" }));
  expect(seg.getByRole("button", { name: "Conversation" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("region", { name: "The conversation" })).toBeTruthy();
  expect(scrolled).toEqual([`seq-${agreement.seq}`]);
  expect(document.getElementById(`seq-${agreement.seq}`)).toBeTruthy();
});

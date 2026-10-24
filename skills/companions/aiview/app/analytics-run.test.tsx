// One run's Analytics (board D10, plan D23, D24, D29-D33, D40; prototype #677 `run`, `brun`): useStats stood in
// for with one run's `Stats`, its members' counts disagreeing with their spans and marks.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RunSummary, Stats } from "../../swarm-board/src/client/reader.ts";
import { CLOSED, LIVE, RUNS } from "./board-fixtures.ts";
import { BRAINSTORM_RUN, EVENTS_READ_RUN, LP_S4, OPEN_RUN, PLAN_RUN, UNRECORDED_RUN, bodyOf } from "./stats-fixtures.ts";
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
const EVENTS_SUMMARY: RunSummary = { ...LP_SUMMARY, run: 9, plan: "old-signup", group: "old-signup", code: "OS", title: "The old signup" };
const EVENTS_TIP = "Estimated: this run closed before analytics recorded it; read from its board events.";

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

test("a member's counts come from the stats: the waiting tag and the seats table read waitingMs, agreementsMade, endorsed, objections even where the fixture's spans and marks would count otherwise; a seat not the skeptic shows its endorsements (D35, D40, D46, S5.2, SL11)", () => {
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
  expect(cells("Jolly Walrus")).toEqual(["4", "2", "1", "0", "2"]);
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

test("a run with recorded: false and no spans read: the Not recorded line in place of the lanes, — in Time, not recorded for lock wait and conflicts, no conflict text on a shared file (D32, D33, D45, SL5, SL10)", () => {
  showRun(OLD_SUMMARY, UNRECORDED_RUN);
  const timeline = part("RunTimeline")!;
  expect(within(timeline).getByText("Not recorded: this run closed before analytics recorded member activity.")).toBeTruthy();
  expect(timeline.querySelector("[data-lane]")).toBeNull();
  expect(rowOf(part("MembersTable")!, "Quiet Llama").querySelectorAll("td")[1].textContent).toBe("—");
  expect(tile("Lock wait").querySelector(".v")!.textContent).toBe("not recorded");
  expect(tile("Rebase conflicts").querySelector(".v")!.textContent).toBe("not recorded");
  // its shared files estimated (D44): drawn as inferred, the list marked so; its merged count exact from the members'
  // rows, never drawn estimated (round 2)
  expect(tile("Slices merged").dataset.state).toBe("filled");
  expect(tile("Shared files settled").dataset.state).toBe("estimated");
  expect(tile("Flags").dataset.state).toBe("filled");
  const list = part("SharedFilesList")!;
  expect(list.dataset.state).toBe("estimated");
  expect(list.querySelector(".label .hint")!.textContent).toBe("estimated");
  // its conflicts null: the tile already says not recorded, the row says nothing of them (D45)
  expect(rowOf(list, "src/old-login.ts").querySelectorAll("td")[2].textContent).toBe("none");
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

test("a shared file not told to every holder says so, its agreement not counted; an agreement before the tell reads so, never 0s after (D38, D46, SL11)", () => {
  const plan = PLAN_RUN.runs[0].plan!;
  const perFile = [
    ...plan.shared.perFile,
    { path: "src/token.ts", holders: ["login-page/S3", "login-page/S4"], told: false, agreement: 21, agreedAfterMs: 3 * 60_000, conflict: false, interface: false },
    { path: "src/form.ts", holders: ["login-page/S3", "login-page/S4"], told: false, agreement: null, agreedAfterMs: null, conflict: false, interface: false },
    { path: "src/early.ts", holders: ["login-page/S3", "login-page/S4"], told: true, agreement: 22, agreedAfterMs: -90_000, conflict: false, interface: false },
  ];
  showRun(LP_SUMMARY, { ...PLAN_RUN, runs: [{ ...PLAN_RUN.runs[0], plan: { ...plan, shared: { ...plan.shared, perFile } } }] });
  const list = part("SharedFilesList")!;
  const agreementOf = (path: string): HTMLElement => rowOf(list, path).querySelectorAll("td")[2] as HTMLElement;
  expect(agreementOf("src/token.ts").textContent).toBe("agreed · not every holder told");
  expect(agreementOf("src/token.ts").querySelector(".warn")).toBeTruthy();
  expect(agreementOf("src/form.ts").textContent).toBe("none · not every holder told");
  expect(agreementOf("src/early.ts").textContent).toBe("agreed before the tell");
  expect(agreementOf("src/early.ts").querySelector(".warn")).toBeNull();
  expect(list.textContent).not.toContain("0s after");
});

test("a run's length reads as swarm stats writes it, floored to the minute (D46, SL11)", () => {
  showRun(LP_SUMMARY, { ...PLAN_RUN, runs: [{ ...PLAN_RUN.runs[0], lengthMs: 14 * 60_000 + 47_000 }] });
  expect(tile("Length").querySelector(".v")!.textContent).toBe("14m");
  expect(screen.getByText(/^plan · run 4 · /).textContent).toMatch(/ · 14m$/);
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
  expect(seg.getByRole("button", { name: "Analytics" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("region", { name: "The conversation" })).toBeTruthy();
  expect(scrolled).toEqual([`seq-${agreement.seq}`]);
  expect(document.getElementById(`seq-${agreement.seq}`)).toBeTruthy();
});

test("a run before the records read from its board events: its lanes drawn estimated, dashed with the estimate's tip, each member's Time drawn as an estimate; Silent members a new record (D45, SL10)", () => {
  showRun(EVENTS_SUMMARY, EVENTS_READ_RUN);
  const timeline = part("RunTimeline")!;
  expect(timeline.dataset.state).toBe("estimated");
  expect(timeline.classList.contains("inferred")).toBe(true);
  expect(timeline.dataset.tip).toBe(EVENTS_TIP);
  expect(within(timeline).queryByText(/^Not recorded/)).toBeNull();
  expect(timeline.querySelector(".label .hint")!.textContent).toBe("estimated");
  // a working span each, inferred; S1's merge a mark in its lane and in the lock band
  expect(lane("old-signup/S1").querySelectorAll(".seg.s-working.inferred")).toHaveLength(1);
  expect(lane("old-signup/S1").querySelectorAll(".seg.s-merging")).toHaveLength(1);
  expect(lane("old-signup/S2").querySelectorAll(".seg.s-working.inferred")).toHaveLength(1);
  expect(timeline.querySelectorAll(".lockband .seg.s-merging")).toHaveLength(1);
  // Time: the member's join to its end, drawn as an estimate
  const time = (nick: string) => rowOf(part("MembersTable")!, nick).querySelectorAll("td")[1] as HTMLElement;
  expect(time("Quiet Llama").textContent).toBe(" 25m");
  expect(time("Shy Otter").textContent).toBe(" 45m");
  expect(time("Quiet Llama").classList.contains("inferred")).toBe(true);
  expect(time("Quiet Llama").dataset.tip).toBe(EVENTS_TIP);
  expect(tile("Length").textContent).toContain("first merge at 20m");
  expect(tile("Silent members").querySelector(".newrec")!.textContent).toBe("new record");
});

test("a hash change of run= switches the run's tab and its Analytics without a reload; one that leaves the board's fields equal moves nothing (D31, D45, SL10)", () => {
  standIn([LIVE], null, [OPEN_RUN, PLAN_RUN]);
  history.replaceState(null, "", "#run=1&view=analytics");
  render(<BoardView repos={[LIVE.repo]} run={null} />);
  const tabs = () => within(screen.getByRole("navigation", { name: "Runs" }));
  expect(tabs().getByText("Sessions with refresh tokens").closest("button")!.getAttribute("aria-pressed")).toBe("true");
  expect(source.asks.at(-1)).toEqual({ run: 1 });
  history.replaceState(null, "", "#run=4&view=analytics");
  fireEvent(window, new HashChangeEvent("hashchange"));
  // run 4 is closed: its archived tab pressed, on its Analytics
  const archived = screen.getByText("The login page", { selector: ".t" }).closest('[data-component="ArchivedTab"]') as HTMLElement;
  expect(archived.getAttribute("aria-pressed")).toBe("true");
  expect(source.asks.at(-1)).toEqual({ run: 4 });
  expect(view()).toBeTruthy();
  // the document's own fields change: the board stays where it is
  history.replaceState(null, "", "#doc=7&run=4&view=analytics");
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(archived.getAttribute("aria-pressed")).toBe("true");
  // run= alone: the run's conversation
  history.replaceState(null, "", "#run=2");
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(tabs().getByText("Audit log").closest("button")!.getAttribute("aria-pressed")).toBe("true");
  expect(document.querySelector('[data-component="RunAnalytics"]')).toBeNull();
});

// The board page (plan D7, D9, D14, D20, D22; mockup #643): useBoard is stood in for with the
// fixtures; each call's selection is recorded, and the snapshot answered is the repository it asks for.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BoardSnapshot } from "../../swarm/src/client/reader.ts";
import type { BoardState } from "./hooks/useBoard.ts";
import { ALL_CLOSED, APP, BRAINSTORM, CLOSED, LIVE, NICKS, OTHER, PHASED, REPOS, SITE } from "./board-fixtures.ts";

const source = vi.hoisted(() => ({
  calls: [] as { repo: string | null; run: number | null }[],
  boards: {} as Record<string, BoardSnapshot>,
}));
vi.mock("./hooks/useBoard.ts", () => ({
  useBoard: (q: { repo: string | null; run: number | null }): BoardState => {
    source.calls.push(q);
    const all = Object.values(source.boards);
    const snapshot = q.run !== null ? (all.find((b) => b.runs.some((r) => r.run === q.run)) ?? null) : (source.boards[q.repo ?? APP] ?? all[0] ?? null);
    const repos = REPOS.filter((r) => source.boards[r.repo]);
    return snapshot ? { repos, snapshot, error: null, connection: "live" } : { repos, snapshot: null, error: `no run ${q.run} on the board`, connection: "live" };
  },
}));

import { BoardView } from "./components/viewers/board/BoardView.tsx";
import { CLAIMS_EXPANDED_KEY } from "./components/viewers/board/ClaimsRow.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  try {
    localStorage.clear();
  } catch {
    /* none */
  }
  source.calls = [];
});

const show = (repos: string[], run: number | null, boards: BoardSnapshot[] = [LIVE]) => {
  source.boards = Object.fromEntries(boards.map((b) => [b.repo, b]));
  return render(<BoardView repos={repos} run={run} />);
};
const tabs = () => within(screen.getByRole("navigation", { name: "Runs" }));
const pressed = () => tabs().getAllByRole("button").find((b) => b.getAttribute("aria-pressed") === "true");
const convo = () => within(screen.getByRole("region", { name: "The conversation" }));
const strip = () => screen.queryByRole("region", { name: "Agents" });
const tabOf = (title: string) => tabs().getByText(title).closest("button")!;

// ── RunTabs ────────────────────────────────────────────────────────────────────────

test("the tab row: All, then each open run with its code, title and slices done/total, a brainstorm its seats; no closed run (SL10)", () => {
  show([APP], null);
  const names = tabs().getAllByRole("button").map((b) => b.textContent);
  expect(names[1]).toBe("All");
  // the run tabs, then the Analytics pill drawn beside the merge lock at the row's end (SL4)
  // a brainstorm's slice rows are seats, never slices to merge: never "0/1"
  expect(names.slice(2)).toEqual(["RTSessions with refresh tokens2/7", "ALAudit log0/3", "NMNaming the kinds1 seat", "Analytics", "merge lock free"]);
  for (const r of CLOSED) expect(tabs().queryByText(r.title)).toBeNull();
  expect(pressed()?.textContent).toBe("All");
});

test("All shows every open run's items, none of a closed run", () => {
  show([APP], null);
  for (const said of [/staying a number/, /yes, I add it\./, /reads better than/]) expect(convo().getByText(said)).toBeTruthy();
  expect(convo().queryByText(/Two names per token/)).toBeNull();
});

test("a run in the URL picks its tab; the tab keeps its items and those naming its members (D14)", () => {
  show([APP], 1);
  expect(pressed()).toBe(tabOf("Sessions with refresh tokens"));
  expect(convo().getByText(/staying a number/)).toBeTruthy();
  // audit-log's post naming RT·S4 shows under RT
  expect(convo().getByText(/I need one call at the top/)).toBeTruthy();
  expect(convo().queryByText(/reads better than/)).toBeNull();
});

test("picking a tab narrows the conversation; All widens it again", () => {
  show([APP], null);
  fireEvent.click(tabOf("Naming the kinds"));
  expect(pressed()).toBe(tabOf("Naming the kinds"));
  expect(convo().getByText(/reads better than/)).toBeTruthy();
  expect(convo().queryByText(/staying a number/)).toBeNull();
  fireEvent.click(tabs().getByText("All"));
  expect(convo().getByText(/staying a number/)).toBeTruthy();
});

test("a run's code in its tab carries no tip (D9)", () => {
  show([APP], null);
  const code = tabOf("Audit log").querySelector(".code") as HTMLElement;
  expect(code.textContent).toBe("AL");
  expect(code.closest("[data-tip]")).toBeNull();
});

test("a closed run in the URL opens as an archived tab, read only, × back to All", () => {
  show([APP], 4);
  const archived = screen.getByText("The login page").closest('[data-component="ArchivedTab"]') as HTMLElement;
  expect(archived.getAttribute("aria-pressed")).toBe("true");
  expect(within(archived).getByText("archived")).toBeTruthy();
  expect(convo().getByText(/read only · 4 of 4 slices/)).toBeTruthy();
  expect(convo().getByText(/merged 9f0c1d2/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close the archived run" }));
  expect(pressed()?.textContent).toBe("All");
});

test("an unknown run picks All and says so", () => {
  show([APP], 99);
  expect(pressed()?.textContent).toBe("All");
  expect(screen.getByText("run 99 is not on this board")).toBeTruthy();
});

// ── ArchivePanel ─────────────────────────────────────────────────────────────────

test("☰ opens the archive: every closed run, newest first; a row picks it as an archived tab", () => {
  show([APP], null);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  const panel = within(screen.getByRole("dialog", { name: "Archive" }));
  expect(panel.getByText(/· 2 closed runs/)).toBeTruthy();
  const rows = panel.getAllByRole("button").filter((b) => b.classList.contains("arow"));
  expect(rows.map((r) => r.querySelector(".code")?.textContent)).toEqual(["TT", "LP"]);
  fireEvent.click(rows[1]);
  expect(screen.queryByRole("dialog", { name: "Archive" })).toBeNull();
  expect(screen.getByText("The login page").closest('[data-component="ArchivedTab"]')).toBeTruthy();
});

test("the archive's search matches title, code and orchestrator", () => {
  show([APP], null);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  const panel = within(screen.getByRole("dialog", { name: "Archive" }));
  const search = panel.getByRole("searchbox");
  const codes = () => panel.queryAllByRole("button").filter((b) => b.classList.contains("arow")).map((r) => r.querySelector(".code")?.textContent);
  fireEvent.change(search, { target: { value: "login" } });
  expect(codes()).toEqual(["LP"]);
  fireEvent.change(search, { target: { value: "tt" } });
  expect(codes()).toEqual(["TT"]);
  fireEvent.change(search, { target: { value: "nothing like it" } });
  expect(panel.getByText("No archived run matches.")).toBeTruthy();
});

test("an archive row carries its kind as a chip: a brainstorm counts seats, a plan its slices", () => {
  show([APP], null);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  const panel = within(screen.getByRole("dialog", { name: "Archive" }));
  const row = (code: string) => panel.getAllByRole("button").find((b) => b.classList.contains("arow") && b.querySelector(".code")?.textContent === code)!;
  const brainstorm = row("TT");
  const chip = brainstorm.querySelector('[data-component="KindChip"]') as HTMLElement;
  expect(chip.textContent).toBe("brainstorm");
  expect(chip.classList.contains("brainstorm")).toBe(true);
  expect(brainstorm.querySelector(".am")?.textContent).toMatch(/^2 seats · /);
  expect(brainstorm.textContent).not.toMatch(/slices/);
  const plan = row("LP");
  const planChip = plan.querySelector('[data-component="KindChip"]') as HTMLElement;
  expect(planChip.textContent).toBe("plan");
  expect(planChip.classList.contains("plan")).toBe(true);
  expect(plan.querySelector(".am")?.textContent).toMatch(/^4\/4 slices · /);
});

test("the archive's search matches the kind", () => {
  show([APP], null);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  const panel = within(screen.getByRole("dialog", { name: "Archive" }));
  const search = panel.getByRole("searchbox");
  const codes = () => panel.queryAllByRole("button").filter((b) => b.classList.contains("arow")).map((r) => r.querySelector(".code")?.textContent);
  fireEvent.change(search, { target: { value: "brainstorm" } });
  expect(codes()).toEqual(["TT"]);
  fireEvent.change(search, { target: { value: "Plan" } });
  expect(codes()).toEqual(["LP"]);
});

test("Escape closes the archive", () => {
  show([APP], null);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Archive" })).toBeNull();
});

test("a click outside closes the archive; one inside does not", () => {
  show([APP], null);
  fireEvent.click(screen.getByRole("button", { name: "Archive" }));
  fireEvent.mouseDown(screen.getByRole("searchbox"));
  expect(screen.getByRole("dialog", { name: "Archive" })).toBeTruthy();
  fireEvent.mouseDown(screen.getByRole("region", { name: "The conversation" }));
  expect(screen.queryByRole("dialog", { name: "Archive" })).toBeNull();
});

// ── AgentStrip ───────────────────────────────────────────────────────────────────

test("the agent strip is hidden on All", () => {
  show([APP], null);
  expect(strip()).toBeNull();
});

test("under a closed run, its members as they ended, a card still followed", () => {
  const was = LIVE.roster.find((r) => r.state === "ended")!;
  const member = (slice: string, state: "done" | "ended") => ({ ...was, runner: `login-page/${slice}`, nick: `LP ${slice}`, plan: "login-page", slice, state });
  show([APP], 4, [{ ...LIVE, roster: [...LIVE.roster, member("S1", "ended"), member("orchestrator", "done")] }]);
  const cards = within(strip()!).getAllByRole("button");
  expect(cards.map((c) => c.querySelector(".slice")?.textContent)).toEqual(["orchestrator", `S1 · ${was.title}`]);
  expect(cards.every((c) => c.textContent?.includes("ended"))).toBe(true);
  fireEvent.click(cards[1]);
  expect(cards[1].getAttribute("aria-pressed")).toBe("true");
});

test("under a picked run, its members, orchestrator first, each read code then nick", () => {
  show([APP], 1);
  const cards = within(strip()!).getAllByRole("button");
  expect(cards[0].textContent).toContain("RT·orchestrator");
  expect(cards[0].textContent).toContain(NICKS["refresh-tokens/orchestrator"]);
  expect(cards[0].classList.contains("orch")).toBe(true);
  expect(cards.map((c) => c.querySelector(".pc")?.textContent)).toEqual(cards.map(() => "RT·"));
  expect(cards.some((c) => c.textContent?.includes("Sleepy Otter"))).toBe(true);
});

test("a card followed narrows the conversation to its member; clicked again, released", () => {
  show([APP], 1);
  const s5 = within(strip()!).getAllByRole("button").find((c) => c.textContent?.includes("Dizzy Puffin"))!;
  fireEvent.click(s5);
  expect(s5.getAttribute("aria-pressed")).toBe("true");
  expect(convo().getByText(/staying a number/)).toBeTruthy();
  expect(convo().queryByText(/return the new token/)).toBeNull();
  fireEvent.click(s5);
  expect(convo().getByText(/return the new token/)).toBeTruthy();
});

// ── the member's activity (swarm-relay S24, D9, D20) ─────────────────────────────

const ACTIVE = LIVE.roster.find((r) => r.runner.startsWith("refresh-tokens/") && r.slice !== "orchestrator" && r.state !== "ended" && r.state !== "done")!;
const withActivity = (liveness: object | undefined) => ({ ...LIVE, roster: LIVE.roster.map((r) => (r.runner === ACTIVE.runner ? { ...r, liveness } : r)) }) as BoardSnapshot;
const activeCard = () => within(strip()!).getAllByRole("button").find((c) => c.textContent?.includes(ACTIVE.nick))!;
const minutesAgo = (m: number) => Date.now() - m * 60000;

test.each([
  ["working", { state: "working", doing: "Edit", since: null }, /^working$/, "last: Edit"],
  ["busy", { state: "busy", doing: "browser_click /jobs", since: minutesAgo(3) }, /^busy · 3 min$/, "browser_click /jobs"],
  ["waiting", { state: "waiting", doing: "swarm wait", since: null }, /^waiting$/, "last: swarm wait"],
  ["quiet", { state: "quiet", doing: "Bash", since: minutesAgo(12), reason: "no call since 12 min" }, /^quiet · 12 min$/, "last: Bash · no call since 12 min"],
  ["gone", { state: "gone", doing: "Read", since: null }, /^gone$/, "last: Read"],
])("a %s member shows its own label and its tool beside it", (state, liveness, label, tool) => {
  show([APP], 1, [withActivity({ tokens: null, movedAt: null, ...liveness })]);
  const card = activeCard();
  const status = card.querySelector(".state")!;
  expect(status.className).toBe(`state ${state}`);
  expect(status.textContent).toMatch(label);
  const line = card.querySelector('[data-component="MemberActivity"]')!;
  expect(line.getAttribute("data-state")).toBe(state);
  expect(line.textContent).toBe(tool);
});

test("a gone member stays in the roster, its card marked gone", () => {
  show([APP], 1, [withActivity({ state: "gone", doing: null, since: null, tokens: null, movedAt: null })]);
  const card = activeCard();
  expect(card).toBeTruthy();
  expect(card.classList.contains("gone")).toBe(true);
});

test("a member with no activity state renders as before it", () => {
  show([APP], 1, [withActivity(undefined)]);
  const card = activeCard();
  expect(card.querySelector('[data-component="MemberActivity"]')).toBeNull();
  expect(card.classList.contains("gone")).toBe(false);
  expect(card.querySelector(".state")!.className).not.toMatch(/\b(busy|gone)\b/);
});

// ── the member's two ages (swarm-relay S43, D36, D38) ──────────────────────────

const agesOf = (card: HTMLElement) => card.querySelector('[data-component="MemberAges"]');

test("each card shows progress <age> and alive <age> beside the state", () => {
  show([APP], 1, [withActivity({ state: "working", doing: "Edit", since: null, tokens: null, movedAt: null, progressAt: minutesAgo(4), aliveAt: Date.now() - 20000 })]);
  const card = activeCard();
  expect(card.querySelector(".state")!.textContent).toMatch(/^working$/);
  expect(agesOf(card)!.textContent).toBe("progress 4 min · alive 20 s");
});

test("a card without the two ages renders as before", () => {
  show([APP], 1, [withActivity({ state: "working", doing: "Edit", since: null, tokens: null, movedAt: null })]);
  expect(agesOf(activeCard())).toBeNull();
});

test("a stalled member's card reads as stalled with its missing signal", () => {
  show([APP], 1, [withActivity({ state: "quiet", doing: "Bash", since: minutesAgo(16), reason: "no progress for 960s, link alive; last Bash",tokens: null, movedAt: null, progressAt: minutesAgo(16), aliveAt: Date.now() - 5000 })]);
  const card = activeCard();
  const status = card.querySelector(".state")!;
  expect(status.className).toBe("state stalled");
  expect(status.textContent).toMatch(/^stalled · 16 min$/);
  expect(card.querySelector('[data-component="MemberActivity"]')!.textContent).toBe("last: Bash · no progress for 960s, link alive; last Bash");
  expect(agesOf(card)!.textContent).toBe("progress 16 min · alive 5 s");
});

test("a gone member's card reads as gone, its lost link named", () => {
  show([APP], 1, [withActivity({ state: "gone", doing: "Read", since: null, reason: "no progress for 120s, link lost; last Read", tokens: null, movedAt: null, progressAt: minutesAgo(2), aliveAt: Date.now() - 40000 })]);
  const card = activeCard();
  expect(card.classList.contains("gone")).toBe(true);
  expect(card.querySelector(".state")!.textContent).toMatch(/^gone$/);
  expect(card.querySelector('[data-component="MemberActivity"]')!.textContent).toBe("last: Read · no progress for 120s, link lost; last Read");
  expect(agesOf(card)!.textContent).toBe("progress 2 min · alive 40 s");
});

// ── ClaimsRow ────────────────────────────────────────────────────────────────────

const SHARED: BoardSnapshot = { ...LIVE, files: [...LIVE.files, { path: "src/shared.ts", holders: ["refresh-tokens/S3", "audit-log/S1"], interface: true }] };

test("the claims row is collapsed, counting files and those shared", () => {
  show([APP], null, [SHARED]);
  const toggle = screen.getByRole("button", { name: /Claims/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.textContent).toContain(`${SHARED.files.length} files · 1 shared`);
  expect(screen.queryByText("src/shared.ts")).toBeNull();
});

test("opened, a plain list: one file per line with its holders, a shared one marked shared and uncoloured", () => {
  show([APP], null, [SHARED]);
  fireEvent.click(screen.getByRole("button", { name: /Claims/ }));
  const row = screen.getByText("src/shared.ts").closest("li")!;
  expect(row.querySelectorAll('[data-component="RunnerTag"]').length).toBe(2);
  const mark = within(row).getByText("shared");
  expect(mark.getAttribute("style")).toBeNull();
  expect(row.getAttribute("style")).toBeNull();
  expect(row.querySelector("[style*='danger'], [style*='amber']")).toBeNull();
  expect(localStorage.getItem(CLAIMS_EXPANDED_KEY)).toBe("1");
});

test("the claims row falls back to collapsed when storage throws, and still opens", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  show([APP], null);
  const toggle = screen.getByRole("button", { name: /Claims/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
});

test("under a closed run, no claims row", () => {
  show([APP], 4);
  expect(screen.queryByRole("region", { name: "Claims" })).toBeNull();
});

// ── MergeLock ────────────────────────────────────────────────────────────────────

test("the merge lock sits at the tab row's end, free or held, with its tip on hover and focus (D22)", () => {
  show([APP], null, [{ ...LIVE, lock: { holder: "refresh-tokens/S4", since: LIVE.events[0].at } }]);
  const lock = tabs().getByText("merge lock").closest('[data-component="MergeLock"]') as HTMLElement;
  expect(lock.tagName).toBe("BUTTON");
  expect(lock.dataset.tip).toMatch(/^Merge lock: one member merges at a time, across every run\./);
  expect(within(lock).getByText("S4")).toBeTruthy();
  fireEvent.focusIn(lock);
  expect(screen.getByRole("tooltip", { hidden: true }).textContent).toBe(lock.dataset.tip);
  cleanup();
  show([APP], null);
  expect(screen.getByText("merge lock free")).toBeTruthy();
});

test("clicking the merge lock opens its history, newest first; Escape closes it", () => {
  const at = LIVE.events[0].at;
  const lockHistory = [
    { runner: "refresh-tokens/S4", askedAt: at, grantedAt: at, mergedAt: null, refused: 0 },
    { runner: "refresh-tokens/S2", askedAt: at, grantedAt: at, mergedAt: at, refused: 2 },
  ];
  show([APP], null, [{ ...LIVE, lockHistory }]);
  fireEvent.click(tabs().getByText("merge lock free").closest("button")!);
  const dialog = screen.getByRole("dialog", { name: "Merge lock history" });
  const rows = dialog.querySelectorAll("tbody tr");
  expect(rows.length).toBe(2);
  expect(rows[0].className).toBe("holding");
  expect(rows[1].className).toBe("merged");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Merge lock history" })).toBeNull();
});

// ── RepoList ─────────────────────────────────────────────────────────────────────

test("RepoList shows with two repositories, not with one; picking the second asks useBoard for it", () => {
  const one = show([APP], null, [LIVE, SITE]);
  expect(one.container.querySelector('[data-component="RepoList"]')).toBeNull();
  cleanup();
  show([APP, OTHER], null, [LIVE, SITE]);
  const repos = within(screen.getByRole("navigation", { name: "Repositories" }));
  fireEvent.click(repos.getByText("charrette-site"));
  expect(source.calls.at(-1)).toEqual({ repo: OTHER, run: null });
  expect(pressed()?.textContent).toBe("All");
  expect(tabs().getByText("The landing page")).toBeTruthy();
});

// ── The tab the board opens on by itself (D17) ──────────────────────────────────────

test("one open run: the board opens on its tab; All stays clickable", () => {
  show([OTHER], null, [SITE]);
  expect(pressed()).toBe(tabOf("The landing page"));
  fireEvent.click(tabs().getByText("All"));
  expect(pressed()?.textContent).toBe("All");
});

test("two or more open runs: the board opens on All", () => {
  show([APP], null);
  expect(pressed()?.textContent).toBe("All");
});

test("no open run: the board opens on the most recently closed, as its archived tab, a brainstorm counting its seats, in its tab and its archived line (SL10, SL11)", () => {
  show([APP], null, [ALL_CLOSED]);
  const archived = screen.getByText("Theme tokens").closest('[data-component="ArchivedTab"]') as HTMLElement;
  expect(archived.getAttribute("aria-pressed")).toBe("true");
  expect(archived.textContent).toContain("2 seats");
  expect(archived.textContent).not.toContain("2/2");
  expect(convo().getByText(/read only · 2 seats$/)).toBeTruthy();
  expect(convo().queryByText(/slices/)).toBeNull();
});

test("no run at all: All, and the board says it has none yet", () => {
  show([OTHER], null, [{ ...SITE, runs: [], events: [], roster: [] }]);
  expect(pressed()?.textContent).toBe("All");
  expect(screen.getByText("No run on charrette-site yet.")).toBeTruthy();
});

test("a run from the URL wins over the opening rule", () => {
  show([OTHER, APP], 4, [SITE, LIVE]);
  expect(screen.getByText("The login page").closest('[data-component="ArchivedTab"]')!.getAttribute("aria-pressed")).toBe("true");
});

test("the person's pick wins: a board that changes later does not move the tab", () => {
  const { rerender } = show([OTHER], null, [SITE]);
  fireEvent.click(tabs().getByText("All"));
  source.boards = { [OTHER]: { ...SITE, events: [...SITE.events] } };
  rerender(<BoardView repos={[OTHER]} run={null} />);
  expect(pressed()?.textContent).toBe("All");
});

test("the run's head shows its current phase, name and text; a run with no phase yet shows none", () => {
  show([APP], BRAINSTORM.run, [PHASED]);
  const phase = document.querySelector('[data-component="RunPhase"]')!;
  expect(phase.getAttribute("data-phase")).toBe("diverge");
  expect(phase.querySelector(".name")?.textContent).toBe("diverge");
  expect(phase.querySelector(".said")?.textContent).toBe("every name a run could carry, no judgment yet");
  cleanup();
  show([APP], BRAINSTORM.run, [LIVE]);
  expect(document.querySelector('[data-component="RunViewSwitch"]')).not.toBeNull();
  expect(document.querySelector('[data-component="RunPhase"]')).toBeNull();
});

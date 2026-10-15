// The board page (plan D7, D9, D14, D20, D22; mockup #643): useBoard is stood in for with the
// fixtures; each call's selection is recorded, and the snapshot answered is the repository it asks for.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BoardSnapshot } from "../../swarm/src/board/snapshot.ts";
import type { BoardState } from "./hooks/useBoard.ts";
import { ALL_CLOSED, APP, CLOSED, LIVE, NICKS, OTHER, REPOS, SITE } from "./board-fixtures.ts";

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
  expect(names.slice(2)).toEqual(["RTSessions with refresh tokens2/7", "ALAudit log0/3", "NMNaming the kinds1 seat", "Analytics"]);
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

// ── ClaimsRow ────────────────────────────────────────────────────────────────────

const SHARED: BoardSnapshot = { ...LIVE, files: [...LIVE.files, { path: "src/shared.ts", holders: ["refresh-tokens/S3", "audit-log/S1"], interface: true }] };

test("the claims row is collapsed, counting files and those shared", () => {
  show([APP], null, [SHARED]);
  const toggle = screen.getByRole("button", { name: /Claims/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.textContent).toContain(`${SHARED.files.length} files · 1 shared by two runs`);
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
  expect(lock.getAttribute("tabindex")).toBe("0");
  expect(lock.dataset.tip).toMatch(/^Merge lock: one member merges at a time, across every run\./);
  expect(within(lock).getByText("S4")).toBeTruthy();
  fireEvent.focusIn(lock);
  expect(screen.getByRole("tooltip", { hidden: true }).textContent).toBe(lock.dataset.tip);
  cleanup();
  show([APP], null);
  expect(screen.getByText("merge lock free")).toBeTruthy();
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

// The board page (plan §3, "The page"): useBoard is stood in for with the fixtures; each call's
// selection is recorded, and the snapshot answered is the repository it asks for.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BoardSnapshot } from "../src/board/board.ts";
import type { BoardState } from "./hooks/useBoard.ts";
import { ALL_CLOSED, APP, BRAINSTORM_ONLY, CLOSED, LIVE, OTHER, REPOS, SITE } from "./fixtures.ts";

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

import { BoardPage } from "./BoardPage.tsx";
import { FILEMAP_EXPANDED_KEY } from "./components/FileMap.tsx";

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
  return render(<BoardPage repos={repos} run={run} />);
};
const rail = () => within(screen.getByRole("navigation", { name: "Channels" }));
const current = () => rail().getAllByRole("button").find((b) => b.getAttribute("aria-current") === "true");
const expandFiles = () => fireEvent.click(screen.getByRole("button", { name: /Files held/ }));
const thread = () => within(screen.getByRole("region", { name: "The thread" }));

test("run selects its channel", () => {
  show([APP], 1);
  expect(current()?.textContent).toContain("Sessions with refresh tokens");
  expect(thread().getByText(/staying a number/)).toBeTruthy();
  expect(thread().queryByText(/yes, I add it./)).toBeNull();
});

test("no run selects Main", () => {
  show([APP], null);
  expect(current()?.textContent).toContain("Main");
});

test("no run and no open run selects the newest closed run, Closed expanded", () => {
  show([APP], null, [ALL_CLOSED]);
  expect(current()?.textContent).toContain("Theme tokens");
  expect(rail().getByRole("button", { name: /Closed/ }).getAttribute("aria-expanded")).toBe("true");
  expect(thread().getByText(/Two names per token/)).toBeTruthy();
});

test("a run in the URL wins over the newest closed run", () => {
  show([APP], 4, [ALL_CLOSED]);
  expect(current()?.textContent).toContain("The login page");
});

test("Main's count in the rail is the entries Main's thread shows, events included", () => {
  show([APP], null);
  const main = rail().getAllByRole("button").find((b) => b.textContent?.startsWith("Main"))!;
  const onMain = LIVE.events.filter((e) => e.channel === "main").length;
  expect(onMain).toBeGreaterThan(0);
  expect(main.querySelector(".n")?.textContent).toBe(String(onMain));
});

test("Files held is collapsed by default, its header counting files and shared files (D5)", () => {
  const shared = { ...LIVE, files: [...LIVE.files, { path: "src/shared.ts", holders: [LIVE.roster[1].runner, LIVE.roster[2].runner], interface: true }] };
  show([APP], 1, [shared]);
  const header = screen.getByRole("button", { name: /Files held/ });
  expect(header.getAttribute("aria-expanded")).toBe("false");
  expect(header.textContent).toBe(`Files held · ${shared.files.length} · 1 shared`);
  expect(within(screen.getByRole("region", { name: "Files held" })).queryByText("src/shared.ts")).toBeNull();
  expandFiles();
  expect(within(screen.getByRole("region", { name: "Files held" })).getByText("src/shared.ts")).toBeTruthy();
});

test("expanding Files held is remembered across renders", () => {
  show([APP], 1);
  expandFiles();
  expect(localStorage.getItem(FILEMAP_EXPANDED_KEY)).toBe("1");
  cleanup();
  show([APP], 1);
  expect(screen.getByRole("button", { name: /Files held/ }).getAttribute("aria-expanded")).toBe("true");
});

test("Files held falls back to collapsed when storage throws, and still expands", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  show([APP], 1);
  expect(screen.getByRole("button", { name: /Files held/ }).getAttribute("aria-expanded")).toBe("false");
  expandFiles();
  expect(screen.getByRole("button", { name: /Files held/ }).getAttribute("aria-expanded")).toBe("true");
});

test("an unknown run selects Main and says so", () => {
  show([APP], 99);
  expect(current()?.textContent).toContain("Main");
  expect(screen.getByText("run 99 is not on this board")).toBeTruthy();
});

test("a brainstorm-only board shows neither FileMap nor MergeLock", () => {
  const { container } = show([APP], 3, [BRAINSTORM_ONLY]);
  expect(current()?.textContent).toContain("Naming the kinds");
  expect(container.querySelector('[data-component="FileMap"]')).toBeNull();
  expect(container.querySelector('[data-component="MergeLock"]')).toBeNull();
});

test("a board with a plan open shows FileMap and MergeLock, even on a brainstorm's channel", () => {
  const { container } = show([APP], 3);
  expect(container.querySelector('[data-component="FileMap"]')).toBeTruthy();
  expect(screen.getByText("merge lock free")).toBeTruthy();
  expandFiles();
  expect(within(screen.getByRole("region", { name: "Files held" })).getByText("src/routes/auth.ts")).toBeTruthy();
});

test("FileMap lists every holder of a shared file (D62)", () => {
  const shared = { ...LIVE, files: [...LIVE.files, { path: "src/shared.ts", holders: [LIVE.roster[1].runner, LIVE.roster[2].runner], interface: true }] };
  show([APP], 1, [shared]);
  expandFiles();
  const row = within(screen.getByRole("region", { name: "Files held" })).getByText("src/shared.ts").closest("li")!;
  expect(row.querySelectorAll('[data-component="RunnerTag"]').length).toBe(2);
});

test("ClosedChannels is collapsed, lists every closed run, and a closed thread reads only", () => {
  show([APP], null);
  const toggle = rail().getByRole("button", { name: /Closed/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.textContent).toContain(String(CLOSED.length));
  for (const r of CLOSED) expect(rail().queryByText(r.title)).toBeNull();
  fireEvent.click(toggle);
  for (const r of CLOSED) expect(rail().getByText(r.title)).toBeTruthy();
  fireEvent.click(rail().getByText("The login page"));
  expect(thread().getByText(/merged 9f0c1d2/)).toBeTruthy();
  expect(screen.getByText("closed: read-only")).toBeTruthy();
});

test("a closed run asked by the URL opens its section", () => {
  show([APP], 5);
  expect(rail().getByRole("button", { name: /Closed/ }).getAttribute("aria-expanded")).toBe("true");
  expect(current()?.textContent).toContain("Theme tokens");
});

test("RepoList shows with two repositories, not with one; picking the second asks useBoard for it", () => {
  const one = show([APP], null, [LIVE, SITE]);
  expect(one.container.querySelector('[data-component="RepoList"]')).toBeNull();
  cleanup();
  show([APP, OTHER], null, [LIVE, SITE]);
  const repos = within(screen.getByRole("navigation", { name: "Repositories" }));
  fireEvent.click(repos.getByText("charrette-site"));
  expect(source.calls.at(-1)).toEqual({ repo: OTHER, run: null });
  expect(current()?.textContent).toContain("Main");
  expect(rail().getByText("The landing page")).toBeTruthy();
});

test("the Main thread holds run events and cross-run posts, never a run's own talk", () => {
  show([APP], null);
  expect(thread().getByText(/yes, I add it\./)).toBeTruthy();
  for (const own of [/return the new token/, /staying a number/, /reads better than/, /Two names per token/]) {
    expect(thread().queryByText(own)).toBeNull();
  }
});

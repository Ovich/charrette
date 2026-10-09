// One run's page, as aiview frames it (plan D2, D3): useRun is stood in for with the mockup's
// live snapshot; the audit-log run (2) is shown.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { RunState } from "./hooks/useRun.ts";
import { LIVE } from "./fixtures.ts";

const source = vi.hoisted(() => ({ state: null as unknown as RunState }));
vi.mock("./hooks/useRun.ts", () => ({ useRun: () => source.state }));

import { RunPage } from "./RunPage.tsx";

afterEach(cleanup);

const show = (run: number) => {
  source.state = { snapshot: LIVE, connection: "live" };
  return render(<RunPage run={run} />);
};

test("lists only the run's runners", () => {
  show(2);
  const roster = within(screen.getByRole("region", { name: "Who is there" }));
  expect(roster.getByText("Jolly Walrus")).toBeTruthy();
  expect(roster.getByText("Quiet Llama")).toBeTruthy();
  expect(roster.queryByText("Sleepy Otter")).toBeNull();
  expect(roster.queryByText("Lucky Moose")).toBeNull();
});

test("the thread holds the run's messages and the other plan's mentions of its runners", () => {
  show(2);
  const feed = screen.getByRole("list");
  expect(within(feed).getByText(/I need one call at the top of every handler/)).toBeTruthy();
  // RT·S4 to AL·S2: a cross-plan mention of the run's runner
  expect(within(feed).getByText(/yes, I add it\./)).toBeTruthy();
  expect(within(feed).queryByText(/does `?store.rotate\(\)`? return/)).toBeNull();
  expect(within(feed).queryByText(/Is `?expiresAt`? staying a number/)).toBeNull();
});

test("the merge lock up top; no repositories rail, no plan queue, no top bar", () => {
  const { container } = show(2);
  expect(screen.getByText("merge lock free")).toBeTruthy();
  expect(screen.getByRole("toolbar", { name: "Show" })).toBeTruthy(); // FeedFilters
  for (const gone of ["Sidebar", "RepoList", "PlanQueues", "TopBar", "FileMap"]) expect(container.querySelector(`[data-component="${gone}"]`)).toBeNull();
  expect(screen.queryByText("Repositories")).toBeNull();
  expect(screen.queryByText("The plans")).toBeNull();
});

test("an unknown run says so", () => {
  show(99);
  expect(screen.getByText("No run 99 on this board.")).toBeTruthy();
});

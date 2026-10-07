// The page at its seam: what the person sees and does. useBoard is stood in for with fixed
// snapshots of the mockup's variants; no fetch is spied on.
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BoardState } from "./hooks/useBoard.ts";
import { at1414, emptyState, LIVE, liveState } from "./fixtures.ts";

const board = vi.hoisted(() => ({ state: null as unknown as BoardState }));
vi.mock("./hooks/useBoard.ts", () => ({ useBoard: () => board.state }));

import { App } from "./App.tsx";

afterEach(cleanup);

const show = (state: BoardState) => {
  board.state = state;
  return render(<App />);
};
const feed = () => screen.getByRole("list");
const card = (doing: RegExp) => screen.getByRole("button", { name: doing });
const chip = (name: RegExp) => within(screen.getByRole("toolbar", { name: "Show" })).getByRole("button", { name });

describe("the regions render their copy from the live snapshot", () => {
  test("sidebar, top bar, roster, thread, plans, files", () => {
    show(liveState());
    // Sidebar: Brand, LiveIndicator, RepoList, SidebarFooter
    expect(screen.getByText("swarm")).toBeTruthy();
    expect(screen.getByText("live")).toBeTruthy();
    expect(screen.getByText("Repositories")).toBeTruthy();
    expect(screen.getByRole("button", { name: /charrette-app/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /billing-service/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /4 running.*Sessions with refresh tokens.*2 of 7 merged/ })).toBeTruthy();
    expect(screen.getByText("3 runs open · swarm.sqlite · :4322")).toBeTruthy();
    // TopBar with MergeLock
    expect(screen.getByText("The thread")).toBeTruthy();
    expect(screen.getByText("merge lock free")).toBeTruthy();
    // Roster
    expect(screen.getByText("Who is there")).toBeTruthy();
    expect(screen.getByText("5 working · 8")).toBeTruthy();
    expect(screen.getByText("select a runner to follow it")).toBeTruthy();
    expect(screen.getAllByText("Feeds the swarm")).toHaveLength(2);
    expect(card(/Adding refreshToken to Session/).textContent).toMatch(/RT·S3working.*joined 14:02.*31 calls/);
    expect(card(/Merged a41c9e2 and ended/).textContent).toMatch(/ended/);
    // Thread with FeedFilters and ReaderNote
    expect(chip(/Everything/).textContent).toBe("Everything10");
    expect(chip(/Messages only/).textContent).toBe("Messages only8");
    expect(chip(/Agreements/).textContent).toBe("Agreements1");
    expect(within(feed()).getByText("Agreed.")).toBeTruthy();
    expect(within(feed()).getByText("merged")).toBeTruthy();
    expect(within(feed()).getByText("joined")).toBeTruthy();
    expect(screen.getByText(/You read; runners and orchestrators write\./)).toBeTruthy();
    // PlanQueues
    expect(screen.getByText("The plans")).toBeTruthy();
    expect(screen.getByText("2 of 7")).toBeTruthy();
    expect(screen.getByText("after S3, S5")).toBeTruthy();
    expect(screen.getByText("after S1")).toBeTruthy();
    // FileMap
    expect(screen.getByText("Files held").textContent).toBe("Files held 9");
    expect(screen.getByText("src/routes/refresh.test.ts")).toBeTruthy();
    expect(screen.getByText(/Underlined: the runner changes that file's interface/)).toBeTruthy();
  });

  test("the merge variant shows the lock and its holder; an urgent row says so", () => {
    show(
      liveState({
        lock: { holder: "refresh-tokens/S3", since: at1414 },
        events: [...LIVE.events, { seq: 99, at: at1414, kind: "urgent", from: "refresh-tokens/orchestrator", body: "@S4 @S5 the decision changed", about: null }],
      }),
    );
    expect(screen.getByText("merge lock")).toBeTruthy();
    expect(screen.queryByText("merge lock free")).toBeNull();
    expect(screen.getByText("urgent · stops and resumes")).toBeTruthy();
  });

  test("the empty snapshot renders the empty state, closed runs still listed", () => {
    show(emptyState());
    expect(screen.getByText("No run open on this machine")).toBeTruthy();
    expect(screen.getByRole("button", { name: /docs-site/ })).toBeTruthy();
    expect(screen.getByText("0 runs open · swarm.sqlite · :4322")).toBeTruthy();
    expect(screen.queryByText("Who is there")).toBeNull();
  });
});

test("a second snapshot with one more event shows the row", () => {
  const { rerender } = show(liveState());
  expect(within(feed()).queryByText(/the retry is in/)).toBeNull();
  board.state = liveState({ events: [...LIVE.events, { seq: 50, at: at1414, kind: "msg", from: "refresh-tokens/S5", body: "@S3 the retry is in", about: null }] });
  rerender(<App />);
  expect(within(feed()).getByText(/the retry is in/)).toBeTruthy();
  expect(chip(/Everything/).textContent).toBe("Everything11");
});

test("following a runner dims the others and narrows the feed; show everyone restores it", () => {
  show(liveState());
  fireEvent.click(card(/Adding refreshToken to Session/));
  expect(card(/Adding refreshToken to Session/).getAttribute("aria-pressed")).toBe("true");
  expect(card(/Writing POST \/auth\/refresh/).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByText(/following/)).toBeTruthy();
  expect(chip(/involved/)).toBeTruthy();
  // from S3, or naming it: kept; the rest gone
  expect(within(feed()).getByText(/Is/)).toBeTruthy(); // "@S3 I read Session …"
  expect(within(feed()).getByText(/Only the new field/)).toBeTruthy();
  expect(within(feed()).queryByText(/return the new token/)).toBeNull();
  expect(within(feed()).queryByText(/You hold it/)).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "show everyone" }));
  expect(within(feed()).getByText(/return the new token/)).toBeTruthy();
  expect(screen.getByText("select a runner to follow it")).toBeTruthy();

  // selecting it again, or the chip's ×, stops following too
  fireEvent.click(card(/Adding refreshToken to Session/));
  fireEvent.click(card(/Adding refreshToken to Session/));
  expect(within(feed()).getByText(/return the new token/)).toBeTruthy();
  fireEvent.click(card(/Adding refreshToken to Session/));
  fireEvent.click(chip(/involved/));
  expect(within(feed()).getByText(/return the new token/)).toBeTruthy();
});

test("selecting a run scopes roster, feed and queues; the repository header clears it", () => {
  show(liveState());
  fireEvent.click(screen.getByRole("button", { name: /0 of 3 merged/ })); // the Audit log run
  expect(screen.getByText("2 working · 3")).toBeTruthy();
  expect(screen.getByRole("banner").textContent).toMatch(/charrette-app\/Audit log/);
  expect(within(feed()).getByText(/You hold it/)).toBeTruthy(); // from AL·S2
  expect(within(feed()).getByText(/yes, I add it/)).toBeTruthy(); // names AL·S2
  expect(within(feed()).queryByText(/Only the new field/)).toBeNull();
  expect(screen.queryAllByText("The token store")).toHaveLength(0); // RT's queue and its runners are gone
  expect(screen.getByText("The audit page")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: /charrette-app/ }));
  expect(screen.getByText("5 working · 8")).toBeTruthy();
  expect(screen.getAllByText("The token store")).toHaveLength(2); // its queue row and its runner's card
});

test("each filter chip shows its count and narrows the feed; an empty result says so", () => {
  show(liveState());
  expect(chip(/session\.ts/).textContent).toBe("session.ts3");
  expect(chip(/auth\.ts/).textContent).toBe("auth.ts3");
  expect(chip(/store\.ts/).textContent).toBe("store.ts3");

  fireEvent.click(chip(/Agreements/));
  expect(chip(/Agreements/).getAttribute("aria-pressed")).toBe("true");
  expect(within(feed()).getAllByRole("listitem")).toHaveLength(1);
  expect(within(feed()).getByText("Agreed.")).toBeTruthy();

  fireEvent.click(chip(/store\.ts/));
  expect(within(feed()).getAllByRole("listitem")).toHaveLength(3);

  // the agreements of a runner who made none: nothing
  fireEvent.click(chip(/Agreements/));
  fireEvent.click(card(/Writing the migration for audit_entries/));
  expect(screen.getByText(/Nothing here yet\./)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Show everything" }));
  expect(within(feed()).getAllByRole("listitem")).toHaveLength(10);
});

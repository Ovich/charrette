// The page at its seam: what the person sees and does. useBoard is stood in for with fixed
// snapshots of the mockup's variants; no fetch is spied on.
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { BoardState } from "./hooks/useBoard.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AL_LINK, AL_S1_LINK, at1414, emptyState, LIVE, liveState } from "./fixtures.ts";

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
    // an ended card: how it ended for its doing, joined → ended for its meta (D66)
    expect(card(/merged and ended/).textContent).toMatch(/Lucky Moose·RT·S2ended.*merged and ended.*joined 14:01 → 14:09.*9 calls/);
    expect(card(/Adding refreshToken to Session/).textContent).not.toMatch(/→/);
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

describe("the background listener (D49)", () => {
  test("a listening runner's card says so under its tag, its state still working; a waiting one stays waiting", () => {
    const roster = LIVE.roster.map((r) =>
      r.runner === "refresh-tokens/S3" ? { ...r, listening: true } : r.runner === "refresh-tokens/S4" ? { ...r, state: "waiting" as const } : r,
    );
    show(liveState({ roster }));
    expect(card(/Adding refreshToken to Session/).textContent).toMatch(/RT·S3working\s*listening.*joined 14:02/);
    expect(card(/Writing POST \/auth\/refresh/).textContent).toMatch(/waiting/);
    expect(card(/Writing POST \/auth\/refresh/).textContent).not.toMatch(/listening/);
    expect(screen.getAllByText("listening")).toHaveLength(1);
  });

  test("the sidebar footer names the store, never the hooks (D58)", () => {
    show(liveState());
    const footer = document.querySelector('[data-component="SidebarFooter"]')!;
    expect(footer.textContent).toBe("3 runs open · swarm.sqlite · :4322");
    expect(document.body.textContent).not.toMatch(/hook/i);
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
  // the chip names the runner as everywhere else: its funny name, then its tag (D66)
  expect(chip(/involved/).textContent).toBe("Sleepy Otter·RT·S3 involved×");
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

// ── Slice 2b: shared files, funny names, links, the sidebar, the phone ─────────────────

describe("a runner shows its funny name beside its tag (D43)", () => {
  test("on its card, on its messages, in the queue while it runs", () => {
    show(liveState());
    expect(card(/Adding refreshToken to Session/).textContent).toMatch(/^Sleepy Otter·RT·S3working/);
    const fromS3 = within(feed()).getByText(/Only the new field/).closest("li")!;
    expect(fromS3.textContent).toMatch(/Sleepy Otter·RT·S3/);
    const joined = within(feed()).getByText("joined").closest("li")!;
    expect(joined.textContent).toMatch(/Sleepy Otter·RT·S3/);
    const queueRow = screen.getByText("The Session interface carries the refresh token", { selector: ".q .name" }).closest(".q")!;
    expect(queueRow.textContent).toBe("S3The Session interface carries the refresh tokenSleepy Otter·S3");
    // an orchestrator is its tag alone
    expect(screen.getAllByText("Feeds the swarm")[0].closest("button")!.textContent).toMatch(/^RT·orchestratorwatching/);
  });
});

test("a shared file: a FileMap row with both holders, a shared mark on each card", () => {
  const [s3, s5] = [LIVE.roster[0], LIVE.roster[4]];
  const share = (r: typeof s3) => ({ ...r, files: [...r.files.map((f) => ({ ...f })), { path: "src/auth/expiry.ts", interface: false, shared: true }] });
  show(
    liveState({
      roster: LIVE.roster.map((r) => (r === s3 || r === s5 ? share(r) : r)),
      files: [...LIVE.files, { path: "src/auth/expiry.ts", holders: [s3.runner, s5.runner], interface: false }],
    }),
  );
  const row = screen.getByText("src/auth/expiry.ts").closest(".f")!;
  expect(row.textContent).toBe("src/auth/expiry.tsSleepy Otter·RT·S3Dizzy Puffin·RT·S5");
  expect(screen.getByText("Files held").textContent).toBe("Files held 10");
  for (const doing of [/Adding refreshToken to Session/, /Running the client tests/]) {
    expect(within(card(doing)).getByText("expiry.ts").textContent).toBe("expiry.ts shared");
  }
  expect(within(card(/Writing POST \/auth\/refresh/)).queryByText(/shared/)).toBeNull();
});

test("a slice whose blockers are not all done reads after them, whatever its state", () => {
  const rt = LIVE.queues["refresh-tokens"].map((q) =>
    q.slice === "S6" ? { ...q, state: "ready" } : q.slice === "S7" ? { ...q, state: "running", runner: "refresh-tokens/S7" } : q,
  );
  show(liveState({ queues: { ...LIVE.queues, "refresh-tokens": rt } }));
  expect(screen.getByText("after S3, S5")).toBeTruthy();
  expect(screen.getByText("after S4, S5")).toBeTruthy();
  // once its blockers are merged, the state shows again
  const merged = rt.map((q) => (["S3", "S5"].includes(q.slice) ? { ...q, state: "done", runner: null } : q));
  cleanup();
  show(liveState({ queues: { ...LIVE.queues, "refresh-tokens": merged } }));
  expect(screen.queryByText("after S3, S5")).toBeNull();
  expect(screen.getByText("Settings lists signed-in devices", { selector: ".q .name" }).closest(".q")!.textContent).toMatch(/ready$/);
  expect(screen.getByText("after S4")).toBeTruthy();
});

test("a plan and a slice with a link open it in a new tab; without one, plain text (D44)", () => {
  show(liveState());
  const links = screen.getAllByRole("link", { name: "Audit log" });
  expect(links).toHaveLength(2); // the RunItem in the sidebar and the PlanQueue header
  for (const a of links) {
    expect(a.getAttribute("href")).toBe(AL_LINK);
    expect(a.getAttribute("target")).toBe("_blank");
  }
  expect(screen.getByRole("link", { name: "The audit table and its writer" }).getAttribute("href")).toBe(AL_S1_LINK);
  expect(screen.queryByRole("link", { name: "Sessions with refresh tokens" })).toBeNull();
  expect(screen.queryByRole("link", { name: "The audit page" })).toBeNull();
  // the run's row still selects it
  fireEvent.click(screen.getByRole("button", { name: /0 of 3 merged/ }));
  expect(screen.getByText("2 working · 3")).toBeTruthy();
});

test("the sidebar opens the repositories with an open run, open runs first, closed ones folded (D45)", () => {
  show(liveState());
  const group = (name: RegExp) => screen.getByRole("button", { name }).closest("[data-component=RepoGroup]") as HTMLElement;
  const app = group(/charrette-app/);
  const runs = () => within(app).queryAllByRole("button", { name: /merged$/ }).map((b) => b.getAttribute("aria-label"));
  expect(runs()).toEqual(["RT 4 running Sessions with refresh tokens 2 of 7 merged", "AL 2 running Audit log 0 of 3 merged"]);
  const closedRow = within(app).getByRole("button", { name: "1 closed" });
  expect(closedRow.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(closedRow);
  expect(runs()).toEqual([
    "RT 4 running Sessions with refresh tokens 2 of 7 merged",
    "AL 2 running Audit log 0 of 3 merged",
    "LP closed The login page 4 of 4 merged",
  ]);
  // only closed runs: folded, until the person opens it
  const docs = group(/docs-site/);
  expect(within(docs).queryByRole("button", { name: /Search rewrite/ })).toBeNull();
  fireEvent.click(within(docs).getByRole("button", { name: "Show runs" }));
  expect(within(docs).getByRole("button", { name: /Search rewrite/ })).toBeTruthy();
  // the person's collapse wins over the open run
  fireEvent.click(within(app).getByRole("button", { name: "Hide runs" }));
  expect(runs()).toEqual([]);
  expect(within(app).getByRole("button", { name: "Show runs" }).getAttribute("aria-expanded")).toBe("false");
});

test("no horizontal scroll at 390 px: the sources found in Edge are bounded (D42)", () => {
  // jsdom lays nothing out. Measured in Edge at 390 px with long unbroken titles and paths:
  // the aside's implicit grid column took its widest child's min-content (a plan or slice
  // title), and the single-column shell would take the sidebar's; both are now minmax(0, 1fr).
  const css = readFileSync(resolve(__dirname, "styles.css"), "utf8").replace(/\s+/g, " ");
  expect(css).toMatch(/\.aside \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/);
  expect(css).toMatch(/@media \(max-width: 860px\) \{ \.shell \{ grid-template-columns: minmax\(0, 1fr\); \} \}/);
  // and a long unbroken path or title wraps instead of pushing its box wider
  for (const rule of [".queue-h .t", ".row .about", ".card-a > span", ".repo-h .sel b"]) {
    const body = css.split(`${rule} {`)[1]?.split("}")[0] ?? "";
    expect(body, rule).toContain("min-width: 0;");
    expect(body, rule).toContain("overflow-wrap: anywhere;");
  }
});

// The board's views in the URL (plan D31): a run's Analytics and the across view with its scope are kept
// in the hash and reopen after a reload; a tab picked opens on Conversation. A reload is the page drawn
// again on the hash the last one wrote.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LIVE } from "./board-fixtures.ts";
import { ACROSS, OPEN_RUN } from "./stats-fixtures.ts";
import { source, standIn } from "./stats-stand-in.ts";

vi.mock("./hooks/useBoard.ts", async () => ({ useBoard: (await import("./stats-stand-in.ts")).useBoardStandIn }));
vi.mock("./hooks/useStats.ts", async () => ({ useStats: (await import("./stats-stand-in.ts")).useStatsStandIn }));

import { BoardView } from "./components/viewers/board/BoardView.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const draw = () => render(<BoardView repos={[LIVE.repo]} run={null} />);
const reload = () => {
  cleanup();
  return draw();
};
const tabs = () => within(screen.getByRole("navigation", { name: "Runs" }));
const tabOf = (title: string) => tabs().getByText(title).closest("button")!;
const runView = () => within(screen.getByRole("group", { name: "This run" }));
const pressedView = () => (runView().getByRole("button", { name: "Analytics" }).getAttribute("aria-pressed") === "true" ? "Analytics" : "Conversation");
const acrossShown = () => screen.queryByText("Across runs") !== null;

test("the URL keeps the views: run=<id>&view=analytics reopens that run on Analytics after a reload; the across view's period and kinds reopen; a picked tab opens on Conversation; picking a run tab or All leaves the across view (D31, SL4, SL5)", () => {
  standIn([LIVE], ACROSS, [{ ...OPEN_RUN }]);
  draw();

  // a picked tab opens on Conversation
  fireEvent.click(tabOf("Sessions with refresh tokens"));
  expect(pressedView()).toBe("Conversation");
  expect(location.hash).not.toContain("view=");

  // its Analytics is written in the URL, and a reload reopens that run on it
  fireEvent.click(runView().getByRole("button", { name: "Analytics" }));
  expect(location.hash).toContain("run=1&view=analytics");
  reload();
  expect(tabOf("Sessions with refresh tokens").getAttribute("aria-pressed")).toBe("true");
  expect(pressedView()).toBe("Analytics");
  expect(source.asks.at(-1)).toEqual({ run: 1 });

  // another tab picked opens on Conversation, and the URL drops the Analytics
  fireEvent.click(tabOf("Audit log"));
  expect(pressedView()).toBe("Conversation");
  expect(location.hash).not.toContain("view=analytics");

  // the across view with its period and kinds: kept in the URL, reopened after a reload
  fireEvent.click(tabs().getByRole("button", { name: "All runs" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "7d" } });
  fireEvent.click(screen.getByRole("button", { name: "brainstorm" }));
  reload();
  expect(acrossShown()).toBe(true);
  expect((screen.getByRole("combobox", { name: "Period" }) as HTMLSelectElement).value).toBe("7d");
  expect(screen.getByRole("button", { name: "plan" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "brainstorm" }).getAttribute("aria-pressed")).toBe("false");
  expect(source.asks.at(-1)).toEqual({ period: "7d", kinds: ["plan"] });

  // a run tab leaves the across view
  fireEvent.click(tabOf("Audit log"));
  expect(acrossShown()).toBe(false);
  expect(pressedView()).toBe("Conversation");
  expect(location.hash).not.toContain("across=1");
  fireEvent.click(tabs().getByRole("button", { name: "All runs" }));
  expect(acrossShown()).toBe(true);
  fireEvent.click(tabOf("Sessions with refresh tokens"));
  expect(acrossShown()).toBe(false);
  expect(location.hash).not.toContain("across=1");
  reload();
  expect(acrossShown()).toBe(false);
});

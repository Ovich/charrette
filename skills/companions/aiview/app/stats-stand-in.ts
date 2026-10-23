// The stand-ins the analytics suites share: useBoard answers the board fixtures as board-view.test.tsx
// does, useStats answers a `Stats` fixture with its body as the server would send it, and
// navigator.clipboard keeps what "Copy as JSON" wrote, the only place its answer lands (US3).
import { vi } from "vitest";
import type { BoardSnapshot, Stats } from "../../swarm-board/src/client/reader.ts";
import type { BoardState } from "./hooks/useBoard.ts";
import type { StatsState } from "./hooks/useStats.ts";
import type { StatsAsk } from "./lib/board/analytics.ts";
import { APP, REPOS } from "./board-fixtures.ts";
import { bodyOf } from "./stats-fixtures.ts";

export const source = {
  boards: {} as Record<string, BoardSnapshot>,
  /** The across view's answer. */
  across: null as Stats | null,
  /** One run's answer, by its id. */
  runs: {} as Record<number, Stats>,
  asks: [] as StatsAsk[],
  copied: [] as string[],
};

export function useBoardStandIn(q: { repo: string | null; run: number | null }): BoardState {
  const all = Object.values(source.boards);
  const snapshot = q.run !== null ? (all.find((b) => b.runs.some((r) => r.run === q.run)) ?? null) : (source.boards[q.repo ?? APP] ?? all[0] ?? null);
  const repos = REPOS.filter((r) => source.boards[r.repo]);
  return snapshot ? { repos, snapshot, error: null, connection: "live" } : { repos, snapshot: null, error: `no run ${q.run} on the board`, connection: "live" };
}

export function useStatsStandIn(_repo: string, ask: StatsAsk): StatsState {
  source.asks.push(ask);
  const stats = "run" in ask ? (source.runs[ask.run] ?? null) : source.across;
  return stats ? { stats, body: bodyOf(stats), error: null } : { stats: null, body: null, error: "no run" };
}

export function standIn(boards: BoardSnapshot[], across: Stats | null, runs: Stats[] = []): void {
  source.boards = Object.fromEntries(boards.map((b) => [b.repo, b]));
  source.across = across;
  source.runs = Object.fromEntries(runs.map((s) => [s.runs[0].run, s]));
  source.asks = [];
  source.copied = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(async (text: string) => void source.copied.push(text)) },
  });
  history.replaceState(null, "", "#");
}

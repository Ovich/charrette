// The BoardReader: the board as aiview reads it (D3), the one module of swarm aiview imports.
// The Board narrowed to reading: its answers are exactly Board's for the same calls. Hides
// openBoard, the SQL, the schema and its upkeep, retention, the change watch, and every write.
import { openBoard } from "./board.ts";
import { SQLITE_PATH } from "./home.ts";
import type { BoardSnapshot, RepoSummary } from "./board.ts";

export type { BoardSnapshot, RepoSummary, RunSummary, SnapshotRunner, SnapshotEvent } from "./board.ts";

export interface BoardReader {
  /** Most recently active first, as Board.repos(). */
  repos(): RepoSummary[];
  /** Throws "no repository <repo>", as Board.snapshot(). */
  snapshot(repo: string): BoardSnapshot;
  /** As Board.onChange: the listener hears the repository whose board moved; returns the unsubscribe. */
  onChange(listener: (repo: string) => void): () => void;
  close(): void;
}

/** Opens the board for reading; the default is the data home's store. */
export async function openBoardReader(dbPath: string = SQLITE_PATH): Promise<BoardReader> {
  const board = await openBoard(dbPath);
  return {
    repos: () => board.repos(),
    snapshot: (repo) => board.snapshot(repo),
    onChange: (listener) => board.onChange(listener),
    close: () => board.close(),
  };
}

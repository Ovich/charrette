// The BoardReader: the board as aiview reads it (D3), the one module of swarm aiview imports.
// The Board narrowed to reading: its answers are exactly Board's for the same calls. Hides
// openBoard, the SQL, the schema and its upkeep, retention, the change watch, and every write.
// The board and the data home load only when a reader opens: the board page imports this module
// for its pure helpers, and a browser cannot evaluate node:sqlite or the home's node:os.
import type { BoardSnapshot, RepoSummary } from "./board.ts";

export type { BoardSnapshot, RepoSummary, RunSummary, SnapshotRunner, SnapshotEvent } from "./board.ts";
// The pure helpers the board page needs, so the page too reaches swarm through this door (D18).
export { planCode, nameHandle, parseMentions } from "./mentions.ts";
export type { Kind } from "./kinds.ts";

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
export async function openBoardReader(dbPath?: string): Promise<BoardReader> {
  const [{ openBoard }, { SQLITE_PATH }] = await Promise.all([import("./board.ts"), import("./home.ts")]);
  const board = await openBoard(dbPath ?? SQLITE_PATH);
  return {
    repos: () => board.repos(),
    snapshot: (repo) => board.snapshot(repo),
    onChange: (listener) => board.onChange(listener),
    close: () => board.close(),
  };
}

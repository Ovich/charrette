// The board routes: swarm's board as aiview serves it (D3, D5). `/api/board` answers one
// repository's board and every repository; a write through swarm's board, in any process,
// reaches every open tab on aiview's `/events` as `board-changed`. Hides the BoardReader's
// opening (lazy, or at start when the store exists), its watch, and how a request names
// its repository. The SSE hub and the static page are the server's.
import fs from "node:fs";
import type http from "node:http";
import path from "node:path";
import { openBoardReader, type BoardReader } from "../../../swarm/src/board/snapshot.ts";
import type { BoardChangedEventPayload } from "../core/api.ts";
import { DATA_ROOT } from "../core/home.ts";
import type { SseHub } from "./sse.ts";

export interface BoardRoutes {
  /** True when the request was a board route and has been answered (or is being). */
  handle(req: http.IncomingMessage, res: http.ServerResponse, url: URL): boolean;
  close(): void;
}

/** Where swarm keeps its board: the data home's `swarm.sqlite`, beside aiview's index. */
const DEFAULT_BOARD_PATH = path.join(DATA_ROOT, "swarm.sqlite");

export function mountBoard(sse: SseHub, opts: { dbPath?: string } = {}): BoardRoutes {
  const dbPath = opts.dbPath ?? DEFAULT_BOARD_PATH;
  let reader: BoardReader | null = null;
  let opening: Promise<BoardReader> | null = null;
  let stopWatching: (() => void) | null = null;
  let closed = false;

  // One open at a time; a failed one is forgotten, so the next request tries again.
  const openReader = (): Promise<BoardReader> => {
    if (reader) return Promise.resolve(reader);
    opening ??= openBoardReader(dbPath).then(
      (opened) => {
        if (closed) {
          opened.close();
          throw new Error("the server is closing");
        }
        reader = opened;
        stopWatching = opened.onChange((repo) =>
          sse.broadcast({ type: "board-changed", repo } satisfies BoardChangedEventPayload),
        );
        return opened;
      },
      (err: unknown) => {
        opening = null;
        throw err;
      },
    );
    return opening;
  };
  // Opened at start when the store is there, so a tab hears board changes before it asks.
  if (fs.existsSync(dbPath)) openReader().catch(() => {}); // a failure answers on the next request

  const json = (res: http.ServerResponse, obj: unknown, status = 200): void => {
    if (res.headersSent) return;
    res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(obj));
  };

  /** One repository's whole board, as swarm's page server resolved it; `/api/run?id=` kept as `?run=`. */
  const answerBoard = (board: BoardReader, url: URL, res: http.ServerResponse): void => {
    const run = url.searchParams.get(url.pathname === "/api/run" ? "id" : "run");
    const key = url.searchParams.get("repo");
    const repos = board.repos();
    let repo: string | undefined;
    if (run !== null) {
      repo = repos.find((r) => r.runs.some((x) => x.run === Number(run)))?.repo;
      if (!repo) return json(res, { error: `no run ${run}` }, 404);
    } else if (key !== null) {
      repo = repos.find((r) => r.repo === key)?.repo;
      if (!repo) return json(res, { error: `no repository ${key}` }, 404);
    } else {
      repo = repos[0]?.repo; // the most recently active: repos() lists it first
      if (!repo) return json(res, { error: "no repository on the board" }, 404);
    }
    json(res, { repos, snapshot: board.snapshot(repo) });
  };

  return {
    handle(req, res, url) {
      if (url.pathname !== "/api/board" && url.pathname !== "/api/run") return false;
      if (req.method !== "GET" && req.method !== "HEAD") return false; // aiview's own 404 answers it
      if (!reader && !fs.existsSync(dbPath)) {
        json(res, { error: "no run on the board yet" }, 404);
        return true;
      }
      openReader()
        .then((board) => answerBoard(board, url, res))
        .catch((err: unknown) => json(res, { error: (err as Error).message }, 500));
      return true;
    },
    close() {
      closed = true;
      stopWatching?.();
      reader?.close();
      reader = null;
    },
  };
}

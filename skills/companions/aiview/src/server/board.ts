// The board routes: swarm's board as aiview serves it (D3, D5). `/api/board` answers one
// repository's board and every repository; a write through swarm's board, in any process,
// reaches every open tab on aiview's `/events` as `board-changed`. Hides the BoardReader's
// opening (lazy, or at start when the store exists), its watch, and how a request names
// its repository. The SSE hub and the static page are the server's.
import fs from "node:fs";
import type http from "node:http";
import path from "node:path";
import { openBoardReader, type BoardReader, type Kind, type StatsScope } from "../../../swarm/src/board/snapshot.ts";
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

  /** The repository a request names, as swarm's page server resolved it: a run's, a repository, or
   *  the most recently active; `missing` is the 404's message. `/api/run?id=` kept as `?run=`. */
  const repoNamed = (board: BoardReader, url: URL): { repo: string } | { missing: string } => {
    const run = url.searchParams.get(url.pathname === "/api/run" ? "id" : "run");
    const key = url.searchParams.get("repo");
    const repos = board.repos();
    if (run !== null) {
      const repo = repos.find((r) => r.runs.some((x) => x.run === Number(run)))?.repo;
      return repo ? { repo } : { missing: `no run ${run}` };
    }
    if (key !== null) {
      const repo = repos.find((r) => r.repo === key)?.repo;
      return repo ? { repo } : { missing: `no repository ${key}` };
    }
    const repo = repos[0]?.repo; // the most recently active: repos() lists it first
    return repo ? { repo } : { missing: "no repository on the board" };
  };

  /** One repository's whole board. */
  const answerBoard = (board: BoardReader, url: URL, res: http.ServerResponse): void => {
    const named = repoNamed(board, url);
    if ("missing" in named) return json(res, { error: named.missing }, 404);
    json(res, { repos: board.repos(), snapshot: board.snapshot(named.repo) });
  };

  /** The figures of a scope, `BoardReader.stats()` as it answers; the scope maps the CLI's flags one to one
   *  (D34): `since=all` is `--all` (no since, every run kept), `closedOnly=1` is `--closed`, `kind` is `--kind`. */
  const answerStats = (board: BoardReader, url: URL, res: http.ServerResponse): void => {
    const named = repoNamed(board, url);
    if ("missing" in named) return json(res, { error: named.missing }, 404);
    const q = url.searchParams;
    const run = q.get("run");
    const since = q.get("since");
    const kinds = (q.get("kind") ?? "").split(",").filter(Boolean) as Kind[];
    // the keys in the CLI's order, so the two bodies are the same text
    const scope: StatsScope = {
      repo: named.repo,
      ...(run !== null ? { run: Number(run) } : {}),
      ...(since !== null && since !== "all" ? { since } : {}),
      ...(kinds.length ? { kinds } : {}),
      ...(q.get("closedOnly") === "1" ? { closedOnly: true } : {}),
    };
    json(res, board.stats(scope));
  };

  const ROUTES = new Map<string, (board: BoardReader, url: URL, res: http.ServerResponse) => void>([
    ["/api/board", answerBoard],
    ["/api/run", answerBoard],
    ["/api/stats", answerStats],
  ]);

  return {
    handle(req, res, url) {
      const answer = ROUTES.get(url.pathname);
      if (!answer) return false;
      if (req.method !== "GET" && req.method !== "HEAD") return false; // aiview's own 404 answers it
      if (!reader && !fs.existsSync(dbPath)) {
        json(res, { error: "no run on the board yet" }, 404);
        return true;
      }
      openReader()
        .then((board) => answer(board, url, res))
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

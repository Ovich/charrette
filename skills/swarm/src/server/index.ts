// The page's server: two read routes, the SSE stream and the built page, on 127.0.0.1 only.
// It reads the Board and never writes to it; the CLI writes, in its own
// processes, and the Board's onChange tells this one.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { Board } from "../board/board.ts";
import { createSseHub } from "./sse.ts";
import { clearServerFiles, writeServerFiles } from "./state.ts";

export interface ServeOptions {
  port: number; // 4322 default; --port, SWARM_PORT
  toolRoot?: string; // where dist/ lives; injectable for tests
  writeState?: boolean; // claim swarm.pid / swarm.port; tests pass false
  heartbeatMs?: number; // SSE ping interval; injectable for tests
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** The tool's folder, dist/ beside it: the launcher sets SWARM_ROOT, else the launcher's own folder. */
const defaultToolRoot = (): string => process.env.SWARM_ROOT ?? path.dirname(path.resolve(process.argv[1] ?? "."));

export function startServer(board: Board, options: ServeOptions): http.Server {
  const { port, toolRoot = defaultToolRoot(), writeState = true, heartbeatMs } = options;
  const sse = createSseHub(heartbeatMs);
  const off = board.onChange((repo) => sse.broadcast({ type: "changed", repo }));

  const send = (res: http.ServerResponse, status: number, body: string | Buffer, type: string): void => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  const json = (res: http.ServerResponse, obj: unknown, status = 200): void => send(res, status, JSON.stringify(obj), MIME[".json"]);

  const distDir = path.join(toolRoot, "dist");
  const serveStatic = (res: http.ServerResponse, p: string): void => {
    const index = path.join(distDir, "index.html");
    if (!fs.existsSync(index)) return send(res, 404, `swarm's page is not built. Run: npm install && npm run build  (in ${toolRoot})`, "text/plain; charset=utf-8");
    const f = path.resolve(distDir, "." + decodeURIComponent(p).replaceAll("..", ""));
    if (f.startsWith(distDir) && fs.existsSync(f) && fs.statSync(f).isFile()) return send(res, 200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream");
    return send(res, 200, fs.readFileSync(index), MIME[".html"]); // the page's own routes
  };

  const server = http.createServer((req, res) => {
    // the page only reads: no route takes a write
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      return json(res, { error: `${req.method} is not accepted: the page only reads` }, 405);
    }
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    try {
      if (p === "/events") return sse.add(res);
      if (p === "/api/run") {
        // one run's repository snapshot, the page scopes it (plan D2): the view aiview frames
        const id = Number(url.searchParams.get("id"));
        const repo = board.repos().find((r) => r.runs.some((x) => x.run === id));
        if (!repo) return json(res, { error: `no run ${url.searchParams.get("id")}` }, 404);
        return json(res, { run: id, snapshot: board.snapshot(repo.repo) });
      }
      if (p.startsWith("/api/")) return json(res, { error: `no route ${p}` }, 404);
      return serveStatic(res, p);
    } catch (e) {
      return json(res, { error: (e as Error).message }, 500);
    }
  });

  server.on("close", () => {
    off();
    sse.close();
  });
  // Without this a detached server dies silently and its caller only sees a timeout.
  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(err.code === "EADDRINUSE" ? `swarm: port ${port} is already in use. Retry with --port <n> or set SWARM_PORT.` : `swarm: server error: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    const actual = (server.address() as { port: number }).port;
    if (writeState) {
      writeServerFiles(actual);
      process.on("exit", clearServerFiles);
      for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => process.exit(0));
    }
    const url = `http://localhost:${actual}/`;
    console.log(`swarm  the page\n  url   ${url}`);
  });
  return server;
}

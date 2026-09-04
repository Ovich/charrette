// The HTTP server: 5 API routes + static UI. Phase 3: still serves the legacy
// ui.html + vendor/ for parity; Phase 4 switches static serving to dist/.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { ALL_PROJECTS, TOOL_ROOT, type Document, type Index } from "../core/db.ts";
import type {
  ActiveProjectResponse,
  DocumentsResponse,
  DocumentResponse,
  PendingEventPayload,
  IndexEventPayload,
  ProjectEventPayload,
} from "../core/api.ts";
import { resolveBindings } from "../core/bind.ts";
import { formatOf, isHtml, isPdf, readDoc } from "../core/paths.ts";
import { clearServerFiles, writeServerFiles } from "../core/serverstate.ts";
import { DocWatcher } from "../core/watcher.ts";
import { createSseHub } from "./sse.ts";

export interface ServeOptions {
  port: number;
  open: boolean;
  startDoc: Document | null;
  /** Where dist/ lives. Injectable for tests. */
  toolRoot?: string;
  /** Claim the data home's pid/port files. Tests pass false so a suite run never
   *  clobbers the state of the real server the user has open. */
  writeState?: boolean;
}

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function openBrowser(url: string): void {
  const [c, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(c, args as string[], { detached: true, stdio: "ignore" }).unref();
  } catch (e) {
    console.error(`could not open browser: ${(e as Error).message}`);
  }
}

export function startServer(
  index: Index,
  { port, open, startDoc, toolRoot = TOOL_ROOT, writeState = true }: ServeOptions,
): http.Server {
  const sse = createSseHub();
  const watcher = new DocWatcher((dir, name) =>
    index
      .all()
      .find((d) => path.dirname(d.abs_path) === dir && path.basename(d.abs_path) === name),
  );
  watcher.on("changed", ({ id }: { id: number }) => {
    index.touch(id);
    sse.broadcast({ type: "changed", id });
  });
  for (const d of index.all()) if (d.exists) watcher.ensureWatch(d);

  const send = (
    res: http.ServerResponse,
    status: number,
    body: string | Buffer,
    type = "application/json; charset=utf-8",
  ) => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  const json = (res: http.ServerResponse, obj: unknown, status = 200) => send(res, status, JSON.stringify(obj));

  // Static UI: the built app in dist/. The CLI's ensureDist builds it before serve/open.
  const distDir = path.join(toolRoot, "dist");
  const useDist = fs.existsSync(path.join(distDir, "index.html"));

  const serveStatic = (res: http.ServerResponse, p: string): void => {
    if (!useDist)
      return send(res, 404, `aiview UI not built. Run: npm install && npm run build  (in ${toolRoot})`, "text/plain");
    const f = path.resolve(distDir, "." + p.replaceAll("..", ""));
    if (f.startsWith(distDir) && fs.existsSync(f) && fs.statSync(f).isFile())
      return send(res, 200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream");
    // SPA fallback
    return send(res, 200, fs.readFileSync(path.join(distDir, "index.html")), "text/html; charset=utf-8");
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    if (p === "/events") return sse.add(res);
    if (p === "/api/documents")
      return json(res, {
        documents: index.all(),
        groups: Object.fromEntries(index.allGroups().map((g) => [g.slug, g.title ?? g.slug])),
        projects: Object.fromEntries(index.allProjects().map((x) => [x.slug, x.title ?? x.slug])),
        activeProject: index.activeProject(),
        start: startDoc?.id ?? null,
      } satisfies DocumentsResponse);
    // The CLI writes the index in its own process; this is how it tells an open tab
    // that the document list moved, so a new document appears without a refresh.
    if (p === "/api/index-changed" && req.method === "POST") {
      req.resume(); // drain; the notification carries nothing
      req.on("end", () => {
        sse.broadcast({ type: "index" } satisfies IndexEventPayload);
        json(res, { ok: true });
      });
      return;
    }
    // The one place the active project is written: the UI posts here, and so does
    // the CLI whenever a server is up, so the broadcast is never a second path.
    if (p === "/api/active" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 4096) req.destroy(); // a slug, not a payload
      });
      req.on("end", () => {
        let slug: unknown;
        try {
          slug = (JSON.parse(body) as { project?: unknown }).project;
        } catch {
          return json(res, { error: "bad json" }, 400);
        }
        if (typeof slug !== "string" || !slug) return json(res, { error: "project required" }, 400);
        if (slug !== ALL_PROJECTS && !index.allProjects().some((x) => x.slug === slug))
          return json(res, { error: `no such project: ${slug}` }, 404);
        index.setActiveProject(slug);
        sse.broadcast({ type: "project", slug } satisfies ProjectEventPayload);
        json(res, { project: slug } satisfies ActiveProjectResponse);
      });
      return;
    }
    // The CLI writes pending rows in its own process; this tells an open tab which
    // document's cards moved. It reuses the `changed` event so the reload path is the
    // one already proven by the file watcher.
    if (p === "/api/pending-changed" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 4096) req.destroy(); // an id, not a payload
      });
      req.on("end", () => {
        let id: unknown;
        try {
          id = (JSON.parse(body) as { id?: unknown }).id;
        } catch {
          return json(res, { error: "bad json" }, 400);
        }
        if (typeof id !== "number") return json(res, { error: "id required" }, 400);
        sse.broadcast({ type: "changed", id } satisfies PendingEventPayload);
        json(res, { ok: true });
      });
      return;
    }
    // Doc-relative assets, confined to the document's folder.
    const a = p.match(/^\/api\/asset\/(\d+)\/(.+)$/);
    if (a) {
      const doc = index.get(Number(a[1]));
      if (!doc) return send(res, 404, "not found", "text/plain");
      const base = path.dirname(doc.abs_path);
      const f = path.resolve(base, decodeURIComponent(a[2]));
      if (f !== base && !f.startsWith(base + path.sep)) return send(res, 403, "forbidden", "text/plain");
      if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, "not found", "text/plain");
      return send(res, 200, fs.readFileSync(f), MIME[path.extname(f).toLowerCase()] ?? "application/octet-stream");
    }
    // Raw bytes (PDF viewing) — read per request, never held open, so writers are not blocked.
    const r = p.match(/^\/api\/raw\/(\d+)$/);
    if (r) {
      const doc = index.get(Number(r[1]));
      if (!doc || !fs.existsSync(doc.abs_path)) return send(res, 404, "not found", "text/plain");
      watcher.ensureWatch(doc);
      const type = isPdf(doc.file_path)
        ? "application/pdf"
        : isHtml(doc.file_path)
          ? "text/html; charset=utf-8"
          : "text/plain; charset=utf-8";
      return send(res, 200, fs.readFileSync(doc.abs_path), type);
    }
    const m = p.match(/^\/api\/document\/(\d+)$/);
    if (m) {
      const doc = index.get(Number(m[1]));
      if (!doc) return json(res, { error: "not found" }, 404);
      const pending = index.pendingFor(doc.id);
      if (!fs.existsSync(doc.abs_path))
        return json(res, { document: doc, content: null, pending } satisfies DocumentResponse);
      watcher.ensureWatch(doc);
      if (isPdf(doc.file_path))
        return json(res, { document: doc, format: "pdf", content: null, pending } satisfies DocumentResponse);
      // An html mockup is composed here, never on disk: data-bind placeholders are replaced
      // from sibling files of the same folder (bare names only), and the watcher learns
      // which files this document now depends on. readDoc stays raw for the indexer.
      if (isHtml(doc.file_path)) {
        const dir = path.dirname(doc.abs_path);
        const reader = (name: string): string | undefined => {
          if (/[\\/]/.test(name) || name.includes("..")) return undefined;
          const f = path.join(dir, name);
          return fs.existsSync(f) && fs.statSync(f).isFile() ? readDoc(f) : undefined;
        };
        const { html, sources, errors, warnings } = resolveBindings(readDoc(doc.abs_path), reader);
        watcher.setSources(doc.id, sources.map((s) => path.join(dir, s)));
        return json(res, {
          document: doc,
          format: "html",
          content: html,
          pending,
          bindings: { sources, errors, warnings },
        } satisfies DocumentResponse);
      }
      return json(res, {
        document: doc,
        format: formatOf(doc.file_path),
        content: readDoc(doc.abs_path),
        pending,
      } satisfies DocumentResponse);
    }
    if (p.startsWith("/api/")) return send(res, 404, "not found", "text/plain");
    serveStatic(res, p);
  });

  server.on("close", () => watcher.close());
  // Without this the process dies unhandled and, when detached with stdio ignored,
  // silently — the caller only sees "did not come up within 10s".
  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(
      err.code === "EADDRINUSE"
        ? `aiview: port ${port} is already in use. Retry with --port <n> or set AIVIEW_PORT.`
        : `aiview: server error: ${err.message}`,
    );
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    const actualPort = (server.address() as { port: number }).port;
    if (writeState) {
      writeServerFiles(actualPort);
      process.on("exit", clearServerFiles);
    }
    const url = `http://localhost:${actualPort}/${startDoc ? `#doc=${startDoc.id}` : ""}`;
    console.log(`aiview  ${startDoc ? startDoc.title : "(index)"}\n  url   ${url}`);
    if (open) openBrowser(url);
  });
  return server;
}

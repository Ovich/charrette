// The HTTP server: 5 API routes + static UI. Phase 3: still serves the legacy
// ui.html + vendor/ for parity; Phase 4 switches static serving to dist/.
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { TOOL_ROOT, type Document, type Index } from "../core/db.ts";
import type { DocumentsResponse, DocumentResponse } from "../core/api.ts";
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
  { port, open, startDoc, toolRoot = TOOL_ROOT }: ServeOptions,
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
        start: startDoc?.id ?? null,
      } satisfies DocumentsResponse);
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
      if (!fs.existsSync(doc.abs_path)) return json(res, { document: doc, content: null } satisfies DocumentResponse);
      watcher.ensureWatch(doc);
      if (isPdf(doc.file_path))
        return json(res, { document: doc, format: "pdf", content: null } satisfies DocumentResponse);
      return json(res, {
        document: doc,
        format: formatOf(doc.file_path),
        content: readDoc(doc.abs_path),
      } satisfies DocumentResponse);
    }
    if (p.startsWith("/api/")) return send(res, 404, "not found", "text/plain");
    serveStatic(res, p);
  });

  server.on("close", () => watcher.close());
  server.listen(port, "127.0.0.1", () => {
    const actualPort = (server.address() as { port: number }).port;
    writeServerFiles(actualPort);
    process.on("exit", clearServerFiles);
    const url = `http://localhost:${actualPort}/${startDoc ? `#doc=${startDoc.id}` : ""}`;
    console.log(`aiview  ${startDoc ? startDoc.title : "(index)"}\n  url   ${url}`);
    if (open) openBrowser(url);
  });
  return server;
}

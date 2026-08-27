var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/core/home.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
function ensureHome() {
  fs.mkdirSync(DOCS_ROOT, { recursive: true });
}
function adoptLegacyIndex(toolRoot, sqlitePath) {
  if (fs.existsSync(sqlitePath)) return;
  const legacy = path.join(toolRoot, "aiview.sqlite");
  if (!fs.existsSync(legacy)) return;
  fs.copyFileSync(legacy, sqlitePath);
  console.error(`aiview: adopted the index from ${legacy} (the original is left in place, unused)`);
}
var DATA_ROOT, DOCS_ROOT, docsDirFor;
var init_home = __esm({
  "src/core/home.ts"() {
    "use strict";
    DATA_ROOT = process.env.CHARRETTE_HOME ? path.resolve(process.env.CHARRETTE_HOME) : path.join(os.homedir(), "charrette_appdata");
    DOCS_ROOT = path.join(DATA_ROOT, "docs");
    docsDirFor = (projectSlug) => path.join(DOCS_ROOT, projectSlug);
  }
});

// src/core/projects.ts
import path2 from "node:path";
function isInside(child, parent) {
  if (!parent) return false;
  const c = norm(child);
  const p = norm(parent);
  return c === p || c.startsWith(p + path2.sep);
}
function projectForCwd(dir, projects) {
  let best = null;
  let bestLen = -1;
  for (const project of projects) {
    for (const prefix of project.paths) {
      if (!isInside(dir, prefix)) continue;
      const len = norm(prefix).length;
      if (len > bestLen) {
        bestLen = len;
        best = project;
      }
    }
  }
  return best;
}
function projectFromDocsPath(absFile, docsRoot) {
  if (!isInside(path2.dirname(absFile), docsRoot)) return null;
  const [first, ...rest] = path2.relative(docsRoot, absFile).split(/[\\/]/);
  return rest.length > 0 && first ? first : null;
}
function resolveProject({ explicit, absFile, docsRoot, existing, fallback }) {
  if (explicit) return explicit;
  return projectFromDocsPath(absFile, docsRoot) ?? existing ?? fallback;
}
var norm;
var init_projects = __esm({
  "src/core/projects.ts"() {
    "use strict";
    norm = (p) => {
      const unified = p.replace(/[\\/]+$/, "").split(/[\\/]/).join(path2.sep);
      return process.platform === "win32" ? unified.toLowerCase() : unified;
    };
  }
});

// src/core/paths.ts
import fs2 from "node:fs";
import path3 from "node:path";
function repoRootOf(start) {
  let dir = start;
  for (; ; ) {
    if (fs2.existsSync(path3.join(dir, ".git"))) return dir;
    const parent = path3.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}
function kindFromName(file) {
  const parts = path3.basename(file).split(".");
  return parts.length >= 3 ? parts[parts.length - 2].toLowerCase() : "";
}
function titleOf(text, file) {
  const m = isHtml(file) ? text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? text.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] : text.match(/^#\s+(.+)$/m)?.[1];
  return (m ?? path3.basename(file)).trim();
}
function toStored(abs, root) {
  const rel = path3.relative(root, abs);
  return rel && !rel.startsWith("..") && !path3.isAbsolute(rel) ? rel.split(path3.sep).join("/") : abs;
}
var isHtml, isPdf, formatOf, projectRoot, readDoc, toAbs;
var init_paths = __esm({
  "src/core/paths.ts"() {
    "use strict";
    isHtml = (file) => /\.html?$/i.test(file);
    isPdf = (file) => /\.pdf$/i.test(file);
    formatOf = (file) => isHtml(file) ? "html" : isPdf(file) ? "pdf" : "markdown";
    projectRoot = (file) => path3.basename(repoRootOf(path3.dirname(file)));
    readDoc = (p) => fs2.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
    toAbs = (stored, root) => path3.isAbsolute(stored) ? stored : path3.resolve(root, ...stored.split("/"));
  }
});

// src/core/db.ts
import fs3 from "node:fs";
import path4 from "node:path";
import { fileURLToPath } from "node:url";
function findToolRoot() {
  if (process.env.AIVIEW_ROOT) return process.env.AIVIEW_ROOT;
  let dir = path4.dirname(fileURLToPath(import.meta.url));
  for (; ; ) {
    if (fs3.existsSync(path4.join(dir, "package.json"))) return dir;
    const parent = path4.dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}
function openIndex(dbPath = SQLITE_PATH, root = STORE_ROOT) {
  if (dbPath === SQLITE_PATH) {
    ensureHome();
    adoptLegacyIndex(TOOL_ROOT, SQLITE_PATH);
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    -- The server writes on every file change while the CLI writes too; without a
    -- busy timeout a concurrent verb fails outright with SQLITE_BUSY.
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      project TEXT NOT NULL,
      title TEXT,
      kind TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `);
  const cols = db.prepare("PRAGMA table_info(documents)").all().map((c) => c.name);
  if (!cols.includes("tags")) db.exec("ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  if (!cols.includes("kind")) db.exec("ALTER TABLE documents ADD COLUMN kind TEXT NOT NULL DEFAULT ''");
  if (!cols.includes("group_slug")) db.exec("ALTER TABLE documents ADD COLUMN group_slug TEXT");
  db.exec("CREATE TABLE IF NOT EXISTS groups (slug TEXT PRIMARY KEY, title TEXT)");
  db.exec(
    "CREATE TABLE IF NOT EXISTS projects (slug TEXT PRIMARY KEY, title TEXT, paths TEXT NOT NULL DEFAULT '[]')"
  );
  db.exec("CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending (
      id INTEGER PRIMARY KEY,
      document_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL
    )
  `);
  db.exec("DROP TABLE IF EXISTS revisions");
  const parse = (row) => ({
    ...row,
    tags: JSON.parse(row.tags),
    abs_path: toAbs(row.file_path, root)
  });
  const parseProject = (row) => ({
    slug: row.slug,
    title: row.title,
    paths: JSON.parse(row.paths)
  });
  const upsertProject = (slug, patch = {}) => {
    const existing = db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug);
    const paths = [.../* @__PURE__ */ new Set([...existing ? JSON.parse(existing.paths) : [], ...patch.addPaths ?? []])];
    const title = patch.title || existing?.title || null;
    db.prepare(
      `INSERT INTO projects (slug, title, paths) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET title = excluded.title, paths = excluded.paths`
    ).run(slug, title, JSON.stringify(paths));
    return parseProject(db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug));
  };
  const upsertGroup = (slug, title) => {
    db.prepare(
      `INSERT INTO groups (slug, title) VALUES (?, ?)
       ON CONFLICT(slug) DO UPDATE SET title = CASE WHEN excluded.title IS NOT NULL THEN excluded.title ELSE groups.title END`
    ).run(slug, title ?? null);
    return db.prepare("SELECT * FROM groups WHERE slug = ?").get(slug);
  };
  return {
    register(absFile, { kind = "", tags: extraTags = [], started = "", group = "", groupTitle = "", project = "" } = {}) {
      if (!fs3.existsSync(absFile)) throw new Error(`no such file: ${absFile}`);
      const file = toStored(absFile, root);
      const content = isPdf(absFile) ? "" : readDoc(absFile);
      const existing = db.prepare("SELECT * FROM documents WHERE file_path = ?").get(file);
      const finalKind = (kind || existing?.kind || kindFromName(file)).toLowerCase();
      if (!finalKind)
        throw new Error(
          "kind is mandatory: name the file <name>.<kind>.md or pass --kind <kind> (e.g. brainstorm, mockup, pr-analysis)"
        );
      const tags = [.../* @__PURE__ */ new Set([...existing ? JSON.parse(existing.tags) : [], ...extraTags])].filter(
        (t2) => t2 !== finalKind
      );
      const t = now();
      const startedAt = started ? new Date(started).toISOString() : existing?.created_at ?? t;
      const groupSlug = group || existing?.group_slug || null;
      if (group) upsertGroup(group, groupTitle || void 0);
      const proj = resolveProject({
        explicit: project,
        absFile,
        docsRoot: DOCS_ROOT,
        existing: existing?.project,
        fallback: projectRoot(absFile)
      });
      upsertProject(proj);
      db.prepare(
        `INSERT INTO documents (file_path, project, title, kind, tags, group_slug, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(file_path) DO UPDATE SET last_seen_at = excluded.last_seen_at, title = excluded.title,
           kind = excluded.kind, tags = excluded.tags, group_slug = excluded.group_slug,
           project = excluded.project, created_at = excluded.created_at`
      ).run(file, proj, titleOf(content, absFile), finalKind, JSON.stringify(tags), groupSlug, startedAt, t);
      return parse(db.prepare("SELECT * FROM documents WHERE file_path = ?").get(file));
    },
    update(id, patch) {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
      if (!row) return void 0;
      const kind = patch.kind ? patch.kind.toLowerCase() : row.kind;
      const tags = [
        .../* @__PURE__ */ new Set([...JSON.parse(row.tags), ...patch.addTags ?? []])
      ].filter((t) => t !== kind && !(patch.removeTags ?? []).includes(t));
      const group = patch.group === void 0 ? row.group_slug : patch.group;
      if (patch.group) upsertGroup(patch.group, patch.groupTitle || void 0);
      else if (patch.groupTitle && row.group_slug) upsertGroup(row.group_slug, patch.groupTitle);
      const createdAt = patch.started ? new Date(patch.started).toISOString() : row.created_at;
      db.prepare(
        "UPDATE documents SET kind = ?, tags = ?, group_slug = ?, created_at = ?, last_seen_at = ? WHERE id = ?"
      ).run(kind, JSON.stringify(tags), group, createdAt, now(), row.id);
      return parse(db.prepare("SELECT * FROM documents WHERE id = ?").get(row.id));
    },
    move(id, newAbs) {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
      if (!row) return void 0;
      const proj = resolveProject({
        absFile: newAbs,
        docsRoot: DOCS_ROOT,
        existing: row.project,
        fallback: projectRoot(newAbs)
      });
      upsertProject(proj);
      db.prepare("UPDATE documents SET file_path = ?, project = ?, last_seen_at = ? WHERE id = ?").run(
        toStored(newAbs, root),
        proj,
        now(),
        row.id
      );
      return parse(db.prepare("SELECT * FROM documents WHERE id = ?").get(row.id));
    },
    get(id) {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id));
      return row ? parse(row) : void 0;
    },
    getByPath(absFile) {
      const row = db.prepare("SELECT * FROM documents WHERE file_path = ?").get(toStored(absFile, root));
      return row ? parse(row) : void 0;
    },
    all() {
      return db.prepare("SELECT * FROM documents ORDER BY created_at DESC, id DESC").all().map(parse).map((d) => {
        let stat = null;
        try {
          stat = fs3.statSync(d.abs_path);
        } catch {
          stat = null;
        }
        return {
          ...d,
          exists: stat !== null,
          updated_at: stat ? new Date(stat.mtimeMs).toISOString() : null,
          format: formatOf(d.file_path)
        };
      });
    },
    allGroups() {
      return db.prepare("SELECT * FROM groups ORDER BY slug").all();
    },
    upsertGroup,
    allProjects() {
      return db.prepare("SELECT * FROM projects ORDER BY slug").all().map(parseProject);
    },
    upsertProject,
    removeProject(slug) {
      const { n } = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE project = ?").get(slug);
      if (n > 0) return { removed: false, documents: n };
      const info = db.prepare("DELETE FROM projects WHERE slug = ?").run(slug);
      return { removed: info.changes > 0, documents: 0 };
    },
    activeProject() {
      const row = db.prepare("SELECT value FROM state WHERE key = 'active_project'").get();
      const slug = row?.value ?? ALL_PROJECTS;
      if (slug === ALL_PROJECTS) return slug;
      const exists = db.prepare("SELECT 1 FROM projects WHERE slug = ?").get(slug);
      return exists ? slug : ALL_PROJECTS;
    },
    setActiveProject(slug) {
      db.prepare(
        "INSERT INTO state (key, value) VALUES ('active_project', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(slug);
      return slug;
    },
    addPending(documentId, label, note = "") {
      const started = (/* @__PURE__ */ new Date()).toISOString();
      db.prepare("INSERT INTO pending (document_id, label, note, started_at) VALUES (?, ?, ?, ?)").run(
        documentId,
        label,
        note,
        started
      );
      return Number(db.prepare("SELECT last_insert_rowid() AS id").get().id);
    },
    donePending(id) {
      const row = db.prepare("SELECT document_id FROM pending WHERE id = ?").get(id);
      if (!row) return null;
      db.prepare("DELETE FROM pending WHERE id = ?").run(id);
      return row.document_id;
    },
    clearPending(documentId) {
      db.prepare("DELETE FROM pending WHERE document_id = ?").run(documentId);
    },
    pendingFor(documentId) {
      return db.prepare("SELECT id, document_id, label, note, started_at FROM pending WHERE document_id = ? ORDER BY id").all(documentId);
    },
    allPending() {
      return db.prepare("SELECT id, document_id, label, note, started_at FROM pending ORDER BY document_id, id").all();
    },
    remove(id) {
      const row = db.prepare("SELECT id FROM documents WHERE id = ?").get(Number(id));
      if (!row) return false;
      db.prepare("DELETE FROM documents WHERE id = ?").run(row.id);
      return true;
    },
    touch(id) {
      db.prepare("UPDATE documents SET last_seen_at = ? WHERE id = ?").run(now(), id);
    },
    close() {
      db.close();
    }
  };
}
var DatabaseSync, TOOL_ROOT, SQLITE_PATH, STORE_ROOT, ALL_PROJECTS, now;
var init_db = __esm({
  async "src/core/db.ts"() {
    "use strict";
    init_home();
    init_projects();
    init_paths();
    process.removeAllListeners("warning");
    process.on("warning", (w) => {
      if (w.name !== "ExperimentalWarning") console.warn(w);
    });
    ({ DatabaseSync } = await import("node:sqlite"));
    TOOL_ROOT = findToolRoot();
    SQLITE_PATH = path4.join(DATA_ROOT, "aiview.sqlite");
    STORE_ROOT = DATA_ROOT;
    ALL_PROJECTS = "*";
    now = () => (/* @__PURE__ */ new Date()).toISOString();
  }
});

// src/core/serverstate.ts
import fs4 from "node:fs";
import path5 from "node:path";
function writeServerFiles(port) {
  ensureHome();
  fs4.writeFileSync(PID_FILE, String(process.pid));
  fs4.writeFileSync(PORT_FILE, String(port));
}
function clearServerFiles() {
  if (readInt(PID_FILE) === process.pid) {
    try {
      fs4.rmSync(PID_FILE, { force: true });
      fs4.rmSync(PORT_FILE, { force: true });
    } catch {
    }
  }
}
function readServerStatus() {
  const pid = readInt(PID_FILE);
  const port = readInt(PORT_FILE);
  if (pid === null || port === null) return { running: false, pid: null, port: null, stale: pid !== null || port !== null };
  if (!alive(pid)) return { running: false, pid, port, stale: true };
  return { running: true, pid, port, stale: false };
}
var PID_FILE, PORT_FILE, readInt, alive;
var init_serverstate = __esm({
  "src/core/serverstate.ts"() {
    "use strict";
    init_home();
    PID_FILE = path5.join(DATA_ROOT, "aiview.pid");
    PORT_FILE = path5.join(DATA_ROOT, "aiview.port");
    readInt = (f) => {
      try {
        const n = Number(fs4.readFileSync(f, "utf8").trim());
        return Number.isInteger(n) && n > 0 ? n : null;
      } catch {
        return null;
      }
    };
    alive = (pid) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
  }
});

// src/core/watcher.ts
import { EventEmitter } from "node:events";
import fs5 from "node:fs";
import path6 from "node:path";
var DocWatcher;
var init_watcher = __esm({
  "src/core/watcher.ts"() {
    "use strict";
    DocWatcher = class extends EventEmitter {
      watched = /* @__PURE__ */ new Map();
      timers = /* @__PURE__ */ new Map();
      resolve;
      debounceMs;
      constructor(resolve, debounceMs = 150) {
        super();
        this.resolve = resolve;
        this.debounceMs = debounceMs;
      }
      ensureWatch(doc) {
        const dir = path6.dirname(doc.abs_path);
        if (this.watched.has(dir)) return;
        try {
          const w = fs5.watch(dir, (_event, name) => {
            if (!name) return;
            const hit = this.resolve(dir, String(name));
            if (!hit) return;
            clearTimeout(this.timers.get(hit.id));
            this.timers.set(
              hit.id,
              setTimeout(() => this.emit("changed", { id: hit.id }), this.debounceMs)
            );
          });
          this.watched.set(dir, w);
        } catch (e) {
          console.error(`watch failed for ${dir}: ${e.message}`);
        }
      }
      close() {
        for (const t of this.timers.values()) clearTimeout(t);
        this.timers.clear();
        for (const w of this.watched.values()) w.close();
        this.watched.clear();
      }
    };
  }
});

// src/server/sse.ts
function createSseHub() {
  const clients = /* @__PURE__ */ new Set();
  return {
    add(res) {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive"
      });
      res.write(`data: ${JSON.stringify({ type: "hello" })}

`);
      clients.add(res);
      res.on("close", () => clients.delete(res));
    },
    broadcast(event) {
      for (const res of clients) res.write(`data: ${JSON.stringify(event)}

`);
    }
  };
}
var init_sse = __esm({
  "src/server/sse.ts"() {
    "use strict";
  }
});

// src/server/index.ts
var server_exports = {};
__export(server_exports, {
  startServer: () => startServer
});
import { spawn } from "node:child_process";
import fs6 from "node:fs";
import http from "node:http";
import path7 from "node:path";
function openBrowser(url) {
  const [c, args2] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(c, args2, { detached: true, stdio: "ignore" }).unref();
  } catch (e) {
    console.error(`could not open browser: ${e.message}`);
  }
}
function startServer(index, { port, open, startDoc, toolRoot = TOOL_ROOT, writeState = true }) {
  const sse = createSseHub();
  const watcher = new DocWatcher(
    (dir, name) => index.all().find((d) => path7.dirname(d.abs_path) === dir && path7.basename(d.abs_path) === name)
  );
  watcher.on("changed", ({ id }) => {
    index.touch(id);
    sse.broadcast({ type: "changed", id });
  });
  for (const d of index.all()) if (d.exists) watcher.ensureWatch(d);
  const send = (res, status, body, type = "application/json; charset=utf-8") => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  const json = (res, obj, status = 200) => send(res, status, JSON.stringify(obj));
  const distDir = path7.join(toolRoot, "dist");
  const useDist = fs6.existsSync(path7.join(distDir, "index.html"));
  const serveStatic = (res, p) => {
    if (!useDist)
      return send(res, 404, `aiview UI not built. Run: npm install && npm run build  (in ${toolRoot})`, "text/plain");
    const f = path7.resolve(distDir, "." + p.replaceAll("..", ""));
    if (f.startsWith(distDir) && fs6.existsSync(f) && fs6.statSync(f).isFile())
      return send(res, 200, fs6.readFileSync(f), MIME[path7.extname(f).toLowerCase()] ?? "application/octet-stream");
    return send(res, 200, fs6.readFileSync(path7.join(distDir, "index.html")), "text/html; charset=utf-8");
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
        start: startDoc?.id ?? null
      });
    if (p === "/api/index-changed" && req.method === "POST") {
      req.resume();
      req.on("end", () => {
        sse.broadcast({ type: "index" });
        json(res, { ok: true });
      });
      return;
    }
    if (p === "/api/active" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 4096) req.destroy();
      });
      req.on("end", () => {
        let slug;
        try {
          slug = JSON.parse(body).project;
        } catch {
          return json(res, { error: "bad json" }, 400);
        }
        if (typeof slug !== "string" || !slug) return json(res, { error: "project required" }, 400);
        if (slug !== ALL_PROJECTS && !index.allProjects().some((x) => x.slug === slug))
          return json(res, { error: `no such project: ${slug}` }, 404);
        index.setActiveProject(slug);
        sse.broadcast({ type: "project", slug });
        json(res, { project: slug });
      });
      return;
    }
    if (p === "/api/pending-changed" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 4096) req.destroy();
      });
      req.on("end", () => {
        let id;
        try {
          id = JSON.parse(body).id;
        } catch {
          return json(res, { error: "bad json" }, 400);
        }
        if (typeof id !== "number") return json(res, { error: "id required" }, 400);
        sse.broadcast({ type: "changed", id });
        json(res, { ok: true });
      });
      return;
    }
    const a = p.match(/^\/api\/asset\/(\d+)\/(.+)$/);
    if (a) {
      const doc = index.get(Number(a[1]));
      if (!doc) return send(res, 404, "not found", "text/plain");
      const base = path7.dirname(doc.abs_path);
      const f = path7.resolve(base, decodeURIComponent(a[2]));
      if (f !== base && !f.startsWith(base + path7.sep)) return send(res, 403, "forbidden", "text/plain");
      if (!fs6.existsSync(f) || !fs6.statSync(f).isFile()) return send(res, 404, "not found", "text/plain");
      return send(res, 200, fs6.readFileSync(f), MIME[path7.extname(f).toLowerCase()] ?? "application/octet-stream");
    }
    const r = p.match(/^\/api\/raw\/(\d+)$/);
    if (r) {
      const doc = index.get(Number(r[1]));
      if (!doc || !fs6.existsSync(doc.abs_path)) return send(res, 404, "not found", "text/plain");
      watcher.ensureWatch(doc);
      const type = isPdf(doc.file_path) ? "application/pdf" : isHtml(doc.file_path) ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
      return send(res, 200, fs6.readFileSync(doc.abs_path), type);
    }
    const m = p.match(/^\/api\/document\/(\d+)$/);
    if (m) {
      const doc = index.get(Number(m[1]));
      if (!doc) return json(res, { error: "not found" }, 404);
      const pending = index.pendingFor(doc.id);
      if (!fs6.existsSync(doc.abs_path))
        return json(res, { document: doc, content: null, pending });
      watcher.ensureWatch(doc);
      if (isPdf(doc.file_path))
        return json(res, { document: doc, format: "pdf", content: null, pending });
      return json(res, {
        document: doc,
        format: formatOf(doc.file_path),
        content: readDoc(doc.abs_path),
        pending
      });
    }
    if (p.startsWith("/api/")) return send(res, 404, "not found", "text/plain");
    serveStatic(res, p);
  });
  server.on("close", () => watcher.close());
  server.on("error", (err) => {
    console.error(
      err.code === "EADDRINUSE" ? `aiview: port ${port} is already in use. Retry with --port <n> or set AIVIEW_PORT.` : `aiview: server error: ${err.message}`
    );
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    const actualPort = server.address().port;
    if (writeState) {
      writeServerFiles(actualPort);
      process.on("exit", clearServerFiles);
    }
    const url = `http://localhost:${actualPort}/${startDoc ? `#doc=${startDoc.id}` : ""}`;
    console.log(`aiview  ${startDoc ? startDoc.title : "(index)"}
  url   ${url}`);
    if (open) openBrowser(url);
  });
  return server;
}
var MIME;
var init_server = __esm({
  async "src/server/index.ts"() {
    "use strict";
    await init_db();
    init_paths();
    init_serverstate();
    init_watcher();
    init_sse();
    MIME = {
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
      ".ico": "image/x-icon"
    };
  }
});

// src/cli/index.ts
await init_db();
init_projects();
init_home();
init_serverstate();
import { spawn as spawn2, spawnSync } from "node:child_process";
import fs7 from "node:fs";
import path8 from "node:path";

// src/cli/args.ts
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "--port",
  "--tag",
  "--untag",
  "--kind",
  "--started",
  "--group",
  "--group-title",
  "--project",
  "--title",
  "--path"
]);
function parseArgs(argv) {
  const [verb, ...rest] = argv;
  return {
    verb,
    rest,
    positional: rest.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(rest[i - 1] ?? "")),
    flag: (name) => {
      const i = rest.indexOf(name);
      return i >= 0 ? rest[i + 1] : void 0;
    },
    flags: (name) => rest.flatMap((a, i) => a === name && rest[i + 1] ? [rest[i + 1]] : []),
    has: (name) => rest.includes(name)
  };
}

// src/cli/index.ts
var args = parseArgs(process.argv.slice(2));
var asJson = args.has("--json");
var USAGE = [
  "usage: aiview <verb> [--json]",
  "  open <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO] [--port p] [--open]",
  "  add <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO]",
  "  update <file|#id> [--kind k] [--tag t]... [--untag t]... [--group g|--ungroup] [--group-title T] [--started ISO]",
  "  list [--kind k] [--tag t]... [--project p | --all]   # defaults to the active project",
  "  project <add|list|rm> [slug] [--title T] [--path P]...",
  "  use <slug|*>                             # set the active project",
  "  remove <file|#id>...",
  "  move <file|#id>... [--project <slug>]    # refile: file + index together",
  "  serve [file] [--port 4321] [--open] [--detach]",
  "  pending add <file|#id> --label L [--note N]   # work the reader is waiting on",
  "  pending done <#pendingId>                     # the work landed; the card goes away",
  "  pending list [<file|#id>] | clear <file|#id>",
  "  status",
  "  path <filename> [--project <slug>]       # where this document belongs, joined for this OS",
  "  init                                     # create the data home; report where everything lives"
].join("\n");
var registerOpts = () => ({
  kind: args.flag("--kind") ?? "",
  tags: args.flags("--tag"),
  started: args.flag("--started") ?? "",
  group: args.flag("--group") ?? "",
  groupTitle: args.flag("--group-title") ?? "",
  project: args.flag("--project") ?? ""
});
function postToServer(route, body) {
  const st = readServerStatus();
  if (!st.running || st.port === null) return false;
  const b = JSON.stringify(body);
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      `const b=${JSON.stringify(b)};const q=require('node:http').request(
         {host:'127.0.0.1',port:${st.port},path:${JSON.stringify(route)},method:'POST',
          headers:{'content-type':'application/json','content-length':Buffer.byteLength(b)}},
         r=>{r.resume();r.on('end',()=>process.exit(r.statusCode===200?0:1))});
       q.on('error',()=>process.exit(1));q.end(b);`
    ],
    { timeout: 5e3 }
  );
  return r.status === 0;
}
function setActive(index, slug) {
  if (!postToServer("/api/active", { project: slug })) index.setActiveProject(slug);
  return slug;
}
function notifyPendingChanged(documentId) {
  postToServer("/api/pending-changed", { id: documentId });
}
function notifyIndexChanged() {
  postToServer("/api/index-changed", {});
}
var MUTATES_INDEX = /* @__PURE__ */ new Set(["add", "open", "update", "remove", "move", "project"]);
var docLine = (d) => `#${d.id}  ${d.kind} [${d.tags.join(", ")}]${d.group_slug ? `  group:${d.group_slug}` : ""}  started ${d.created_at}  ${d.title}`;
var emit = (json, human) => {
  if (asJson) console.log(JSON.stringify(json));
  else if (typeof human === "string") console.log(human);
  else human();
};
function ensureDist() {
  if (fs7.existsSync(path8.join(TOOL_ROOT, "dist", "index.html"))) return;
  if (!fs7.existsSync(path8.join(TOOL_ROOT, "app", "index.html"))) return;
  console.error("aiview: dist/ missing \u2014 building the UI once\u2026");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["run", "build"], { cwd: TOOL_ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`aiview: UI build failed. Run: npm install && npm run build  (in ${TOOL_ROOT})`);
    process.exit(1);
  }
}
function spawnDetachedServer(port) {
  try {
    fs7.rmSync(PORT_FILE, { force: true });
  } catch {
  }
  const child = spawn2(process.execPath, [process.argv[1], "serve", "--port", String(port)], {
    detached: true,
    stdio: "ignore",
    cwd: TOOL_ROOT
  });
  child.unref();
  const t0 = Date.now();
  for (; ; ) {
    const st = readServerStatus();
    if (st.running && st.port !== null) return st.port;
    if (Date.now() - t0 > 1e4) {
      console.error(`aiview: server did not come up within 10s (port ${port} may be in use \u2014 retry with --port <n>)`);
      process.exit(1);
    }
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},120)"]);
  }
}
function resolveRef(ref) {
  const index = openIndex();
  try {
    return /^#?\d+$/.test(ref) ? index.get(Number(ref.replace("#", ""))) : index.getByPath(path8.resolve(ref));
  } finally {
    index.close();
  }
}
function cmdStatus() {
  const index = openIndex();
  const documents = index.all().length;
  const project = index.activeProject();
  const projectDocs = project === ALL_PROJECTS ? DOCS_ROOT : docsDirFor(project);
  const cwdProject = projectForCwd(process.cwd(), index.allProjects())?.slug ?? null;
  index.close();
  const server = readServerStatus();
  emit(
    { home: DATA_ROOT, docs: DOCS_ROOT, project, projectDocs, cwdProject, sqlite: SQLITE_PATH, tool: TOOL_ROOT, documents, server },
    () => {
      console.log(`home       ${DATA_ROOT}`);
      console.log(`docs       ${DOCS_ROOT}`);
      console.log(`project    ${project === ALL_PROJECTS ? "(all)" : project}`);
      console.log(`write to   ${projectDocs}`);
      if (cwdProject) console.log(`cwd is in  ${cwdProject}`);
      console.log(`sqlite     ${SQLITE_PATH}`);
      console.log(`tool       ${TOOL_ROOT}`);
      console.log(`documents  ${documents}`);
      console.log(
        `server     ${server.running ? `up (pid ${server.pid}, port ${server.port})` : server.stale ? "down (stale pidfile)" : "down"}`
      );
    }
  );
}
function cmdPath() {
  const name = args.positional[0];
  if (!name) {
    console.error("usage: aiview path <filename> [--project <slug>]");
    process.exit(1);
  }
  const index = openIndex();
  const slug = args.flag("--project") ?? index.activeProject();
  const known = index.allProjects().map((p) => p.slug);
  index.close();
  if (slug === ALL_PROJECTS) {
    console.error(`no active project \u2014 run: aiview use <slug>, or pass --project${known.length ? `
known: ${known.join(", ")}` : ""}`);
    process.exit(1);
  }
  if (!known.includes(slug)) {
    console.error(`no such project: ${slug}${known.length ? `
known: ${known.join(", ")}` : ""}`);
    process.exit(1);
  }
  const dir = docsDirFor(slug);
  fs7.mkdirSync(dir, { recursive: true });
  const full = path8.join(dir, path8.basename(name));
  emit({ path: full, dir, project: slug }, full);
}
function cmdInit() {
  ensureHome();
  adoptLegacyIndex(TOOL_ROOT, SQLITE_PATH);
  emit({ home: DATA_ROOT, docs: DOCS_ROOT, sqlite: SQLITE_PATH, tool: TOOL_ROOT }, () => {
    console.log(`data home  ${DATA_ROOT}      (yours: index, server files, documents \u2014 never versioned)`);
    console.log(`documents  ${path8.join(DOCS_ROOT, "<project>")}`);
    console.log(`tool       ${TOOL_ROOT}      (the checkout: rebuildable, safe to delete)`);
  });
}
function cmdAdd() {
  if (!args.positional[0]) {
    console.error("usage: aiview add <file.md> [--kind k] [--tag t]...");
    process.exit(1);
  }
  const index = openIndex();
  const d = index.register(path8.resolve(args.positional[0]), registerOpts());
  index.close();
  emit(d, docLine(d));
}
function cmdUpdate() {
  if (!args.positional[0]) {
    console.error("usage: aiview update <file|#id> [--kind k] [--tag t] [--untag t] [--group g|--ungroup] [--group-title T] [--started ISO]");
    process.exit(1);
  }
  if (args.flag("--project")) {
    console.error(`project is a directory, not metadata \u2014 use: aiview move ${args.positional[0]} --project <slug>`);
    process.exit(1);
  }
  const target = resolveRef(args.positional[0]);
  if (!target) {
    console.error(`not in index: ${args.positional[0]}`);
    process.exit(1);
  }
  const patch = {
    kind: args.flag("--kind"),
    addTags: args.flags("--tag"),
    removeTags: args.flags("--untag"),
    group: args.has("--ungroup") ? null : args.flag("--group") ?? void 0,
    groupTitle: args.flag("--group-title"),
    started: args.flag("--started")
  };
  const index = openIndex();
  const d = index.update(target.id, patch);
  index.close();
  emit(d, docLine(d));
}
function cmdList() {
  const want = args.flags("--tag");
  const wantKind = args.flag("--kind") ?? "";
  const index = openIndex();
  const scope = args.has("--all") ? ALL_PROJECTS : args.flag("--project") ?? index.activeProject();
  const docs = index.all().filter(
    (d) => (scope === ALL_PROJECTS || d.project === scope) && (!wantKind || d.kind === wantKind) && (!want.length || want.every((t) => d.tags.includes(t)))
  );
  index.close();
  emit(docs, () => {
    for (const d of docs)
      console.log(
        `started ${d.created_at}  ${d.kind.padEnd(12)} [${d.tags.join(", ")}]  ${d.title}${d.exists ? "" : "  (missing)"}
    ${d.file_path}`
      );
  });
}
function cmdRemove() {
  if (!args.positional.length) {
    console.error("usage: aiview remove <file|#id>...");
    process.exit(1);
  }
  const index = openIndex();
  const removed = [];
  for (const ref of args.positional) {
    const row = /^#?\d+$/.test(ref) ? index.get(Number(ref.replace("#", ""))) : index.getByPath(path8.resolve(ref));
    if (!row) {
      console.error(`not in index: ${ref}`);
      continue;
    }
    index.remove(row.id);
    removed.push(row);
    if (!asJson) console.log(`removed #${row.id}  ${row.title}  (file untouched)`);
  }
  index.close();
  if (asJson) console.log(JSON.stringify({ removed }));
}
function cmdProject() {
  const sub = args.positional[0] ?? "list";
  const index = openIndex();
  try {
    if (sub === "list") {
      const projects = index.allProjects();
      const docs = index.all();
      const active = index.activeProject();
      const count = (slug2) => docs.filter((d) => d.project === slug2).length;
      emit(
        projects.map((p) => ({ ...p, documents: count(p.slug), active: p.slug === active })),
        () => {
          for (const p of projects)
            console.log(
              `${p.slug === active ? "*" : " "} ${p.slug.padEnd(14)} ${String(count(p.slug)).padStart(3)} docs  ${docsDirFor(p.slug)}${p.paths.length ? `
    covers ${p.paths.join(", ")}` : ""}`
            );
        }
      );
      return;
    }
    const slug = args.positional[1];
    if (!slug) {
      console.error(`usage: aiview project ${sub} <slug>`);
      process.exit(1);
    }
    if (sub === "add") {
      const p = index.upsertProject(slug, { title: args.flag("--title"), addPaths: args.flags("--path") });
      fs7.mkdirSync(docsDirFor(slug), { recursive: true });
      emit({ ...p, docs: docsDirFor(slug) }, `${p.slug}  ${docsDirFor(slug)}${p.paths.length ? `
  covers ${p.paths.join(", ")}` : ""}`);
      return;
    }
    if (sub === "rm") {
      const r = index.removeProject(slug);
      if (!r.removed) {
        console.error(
          r.documents > 0 ? `${slug} still has ${r.documents} document${r.documents === 1 ? "" : "s"}. Move or remove them first.` : `no such project: ${slug}`
        );
        process.exit(1);
      }
      emit(r, `removed project ${slug}  (its directory is left on disk)`);
      return;
    }
    console.error("usage: aiview project <add|list|rm> [slug] [--title T] [--path P]...");
    process.exit(1);
  } finally {
    index.close();
  }
}
function cmdUse() {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: aiview use <slug|*>");
    process.exit(1);
  }
  const index = openIndex();
  try {
    if (slug !== ALL_PROJECTS && !index.allProjects().some((p) => p.slug === slug)) {
      const known = index.allProjects().map((p) => p.slug);
      console.error(`no such project: ${slug}${known.length ? `
known: ${known.join(", ")}` : ""}`);
      process.exit(1);
    }
    setActive(index, slug);
    emit(
      { project: slug, docs: slug === ALL_PROJECTS ? DOCS_ROOT : docsDirFor(slug) },
      slug === ALL_PROJECTS ? `all projects  ${DOCS_ROOT}` : `${slug}  ${docsDirFor(slug)}`
    );
  } finally {
    index.close();
  }
}
function cmdMove() {
  if (!args.positional.length) {
    console.error("usage: aiview move <file|#id>... [--project <slug>]");
    process.exit(1);
  }
  const target = args.flag("--project");
  const index = openIndex();
  if (target && !index.allProjects().some((p) => p.slug === target)) {
    const known = index.allProjects().map((p) => p.slug);
    console.error(`no such project: ${target}${known.length ? `
known: ${known.join(", ")}` : ""}`);
    index.close();
    process.exit(1);
  }
  const moved = [];
  for (const ref of args.positional) {
    const row = /^#?\d+$/.test(ref) ? index.get(Number(ref.replace("#", ""))) : index.getByPath(path8.resolve(ref));
    if (!row) {
      console.error(`not in index: ${ref}`);
      continue;
    }
    const from = row.abs_path;
    const dir = docsDirFor(target ?? row.project);
    const dest = path8.join(dir, path8.basename(from));
    if (dest === from) {
      console.error(`already there: ${from}`);
      continue;
    }
    const orphaned = !fs7.existsSync(from) && fs7.existsSync(dest);
    if (!fs7.existsSync(from) && !orphaned) {
      console.error(`missing file, not moved: ${from}`);
      continue;
    }
    if (fs7.existsSync(dest) && !orphaned) {
      console.error(`target exists, skipped: ${dest}`);
      continue;
    }
    fs7.mkdirSync(dir, { recursive: true });
    if (!orphaned) {
      try {
        fs7.renameSync(from, dest);
      } catch (e) {
        if (e.code !== "EXDEV") throw e;
        fs7.copyFileSync(from, dest);
        fs7.rmSync(from);
      }
    }
    const d = index.move(row.id, dest);
    moved.push(d);
    if (!asJson) console.log(`moved #${d.id}  ${from}
           -> ${dest}`);
  }
  index.close();
  if (asJson) console.log(JSON.stringify({ moved }));
}
function cmdOpen() {
  if (!args.positional[0]) {
    console.error("usage: aiview open <file> [--kind k] [--tag t]... [--group g] [--port p] [--open]");
    process.exit(1);
  }
  ensureDist();
  const index = openIndex();
  const d = index.register(path8.resolve(args.positional[0]), registerOpts());
  setActive(index, d.project);
  index.close();
  const st = readServerStatus();
  const port = st.running && st.port !== null ? st.port : spawnDetachedServer(Number(args.flag("--port") ?? process.env.AIVIEW_PORT ?? 4321));
  const url = `http://localhost:${port}/#doc=${d.id}`;
  if (args.has("--open")) {
    const [c, a] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    try {
      spawn2(c, a, { detached: true, stdio: "ignore" }).unref();
    } catch {
    }
  }
  emit({ id: d.id, url, server: readServerStatus() }, url);
}
async function cmdServe() {
  if (args.has("--detach")) {
    ensureDist();
    if (args.positional[0]) {
      const index2 = openIndex();
      index2.register(path8.resolve(args.positional[0]), registerOpts());
      index2.close();
    }
    const st = readServerStatus();
    const port = st.running && st.port !== null ? st.port : spawnDetachedServer(Number(args.flag("--port") ?? process.env.AIVIEW_PORT ?? 4321));
    emit({ server: readServerStatus() }, `aiview server up on http://localhost:${port}/`);
    return;
  }
  ensureDist();
  const { startServer: startServer2 } = await init_server().then(() => server_exports);
  const index = openIndex();
  const startDoc = args.positional[0] ? index.register(path8.resolve(args.positional[0]), registerOpts()) : null;
  startServer2(index, {
    port: Number(args.flag("--port") ?? process.env.AIVIEW_PORT ?? 4321),
    open: args.has("--open"),
    startDoc
  });
}
function cmdPending() {
  const sub = args.positional[0];
  const index = openIndex();
  const needDoc = (ref2) => {
    if (!ref2) {
      console.error("usage: aiview pending <add|done|list|clear> ...");
      process.exit(1);
    }
    const doc = resolveRef(ref2);
    if (!doc) {
      console.error(`no such document: ${ref2}`);
      process.exit(1);
    }
    return doc;
  };
  if (sub === "add") {
    const doc = needDoc(args.positional[1]);
    const label = args.flag("--label");
    if (!label) {
      console.error("usage: aiview pending add <file|#id> --label L [--note N]");
      process.exit(1);
    }
    const id = index.addPending(doc.id, label, args.flag("--note") ?? "");
    index.close();
    notifyPendingChanged(doc.id);
    emit({ id, document: doc.id, label }, `pending #${id}  ${label}  (doc #${doc.id})`);
    return;
  }
  if (sub === "done") {
    const raw = (args.positional[1] ?? "").replace(/^#/, "");
    const id = Number(raw);
    if (!raw || Number.isNaN(id)) {
      console.error("usage: aiview pending done <#pendingId>");
      process.exit(1);
    }
    const docId = index.donePending(id);
    index.close();
    if (docId === null) {
      console.error(`no such pending item: #${id}`);
      process.exit(1);
    }
    notifyPendingChanged(docId);
    emit({ id, document: docId }, `done #${id}`);
    return;
  }
  if (sub === "clear") {
    const doc = needDoc(args.positional[1]);
    index.clearPending(doc.id);
    index.close();
    notifyPendingChanged(doc.id);
    emit({ document: doc.id, cleared: true }, `cleared pending for #${doc.id}`);
    return;
  }
  const ref = args.positional[1];
  const rows = ref ? index.pendingFor(needDoc(ref).id) : index.allPending();
  index.close();
  emit(rows, () => {
    if (!rows.length) return console.log("nothing pending");
    for (const r of rows) console.log(`#${r.id}  doc #${r.document_id}  ${r.label}${r.note ? ` \u2014 ${r.note}` : ""}  since ${r.started_at}`);
  });
}
switch (args.verb) {
  case "pending":
    cmdPending();
    break;
  case "status":
    cmdStatus();
    break;
  case "path":
    cmdPath();
    break;
  case "init":
    cmdInit();
    break;
  case "add":
    cmdAdd();
    break;
  case "update":
    cmdUpdate();
    break;
  case "list":
    cmdList();
    break;
  case "remove":
    cmdRemove();
    break;
  case "move":
    cmdMove();
    break;
  case "project":
    cmdProject();
    break;
  case "use":
    cmdUse();
    break;
  case "open":
    cmdOpen();
    break;
  case "serve":
    await cmdServe();
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}
if (MUTATES_INDEX.has(args.verb ?? "")) notifyIndexChanged();

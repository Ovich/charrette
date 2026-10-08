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

// src/board/home.ts
import os from "node:os";
import path from "node:path";
var DATA_ROOT, SQLITE_PATH;
var init_home = __esm({
  "src/board/home.ts"() {
    "use strict";
    DATA_ROOT = process.env.CHARRETTE_HOME ? path.resolve(process.env.CHARRETTE_HOME) : path.join(os.homedir(), "charrette_appdata");
    SQLITE_PATH = path.join(DATA_ROOT, "swarm.sqlite");
  }
});

// src/server/state.ts
import fs2 from "node:fs";
import path3 from "node:path";
function writeServerFiles(port) {
  fs2.mkdirSync(DATA_ROOT, { recursive: true });
  fs2.writeFileSync(PID_FILE, String(process.pid));
  fs2.writeFileSync(PORT_FILE, String(port));
}
function clearServerFiles() {
  if (readInt(PID_FILE) !== process.pid) return;
  try {
    fs2.rmSync(PID_FILE, { force: true });
    fs2.rmSync(PORT_FILE, { force: true });
  } catch {
  }
}
function readServerStatus() {
  const pid = readInt(PID_FILE);
  const port = readInt(PORT_FILE);
  if (pid === null || port === null) return { running: false, pid: null, port: null, stale: pid !== null || port !== null };
  if (!alive(pid)) return { running: false, pid, port, stale: true };
  return { running: true, pid, port, stale: false };
}
var PID_FILE, PORT_FILE, DEFAULT_PORT, readInt, alive, portFrom;
var init_state = __esm({
  "src/server/state.ts"() {
    "use strict";
    init_home();
    PID_FILE = path3.join(DATA_ROOT, "swarm.pid");
    PORT_FILE = path3.join(DATA_ROOT, "swarm.port");
    DEFAULT_PORT = 4322;
    readInt = (f) => {
      try {
        const n = Number(fs2.readFileSync(f, "utf8").trim());
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
    portFrom = (flag) => Number(flag ?? process.env.SWARM_PORT ?? DEFAULT_PORT);
  }
});

// src/server/sse.ts
function createSseHub(heartbeatMs = HEARTBEAT_MS) {
  const clients = /* @__PURE__ */ new Set();
  const drop = (res) => {
    if (clients.delete(res)) res.destroy();
  };
  const send = (res, event) => {
    if (res.writableEnded || res.destroyed) return drop(res);
    try {
      res.write(`data: ${JSON.stringify(event)}

`, (err) => {
        if (err) drop(res);
      });
    } catch {
      drop(res);
    }
  };
  const beat = setInterval(() => {
    for (const res of [...clients]) send(res, { type: "ping" });
  }, heartbeatMs);
  beat.unref?.();
  return {
    add(res) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      clients.add(res);
      res.on("close", () => clients.delete(res));
      res.on("error", () => drop(res));
      send(res, { type: "hello" });
    },
    // the set is copied: a failed write drops its client from it
    broadcast(event) {
      for (const res of [...clients]) send(res, event);
    },
    size: () => clients.size,
    close() {
      clearInterval(beat);
      for (const res of [...clients]) drop(res);
    }
  };
}
var HEARTBEAT_MS;
var init_sse = __esm({
  "src/server/sse.ts"() {
    "use strict";
    HEARTBEAT_MS = 15e3;
  }
});

// src/server/index.ts
var server_exports = {};
__export(server_exports, {
  startServer: () => startServer
});
import { spawn } from "node:child_process";
import fs3 from "node:fs";
import http from "node:http";
import path4 from "node:path";
function openBrowser(url) {
  const [c, a] = process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(c, a, { detached: true, stdio: "ignore" }).unref();
  } catch {
  }
}
function startServer(board, options) {
  const { port, open, toolRoot = defaultToolRoot(), writeState = true, heartbeatMs } = options;
  const sse = createSseHub(heartbeatMs);
  const off = board.onChange((repo) => sse.broadcast({ type: "changed", repo }));
  const send = (res, status, body, type) => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  const json = (res, obj, status = 200) => send(res, status, JSON.stringify(obj), MIME[".json"]);
  const distDir = path4.join(toolRoot, "dist");
  const serveStatic = (res, p) => {
    const index = path4.join(distDir, "index.html");
    if (!fs3.existsSync(index)) return send(res, 404, `swarm's page is not built. Run: npm install && npm run build  (in ${toolRoot})`, "text/plain; charset=utf-8");
    const f = path4.resolve(distDir, "." + decodeURIComponent(p).replaceAll("..", ""));
    if (f.startsWith(distDir) && fs3.existsSync(f) && fs3.statSync(f).isFile()) return send(res, 200, fs3.readFileSync(f), MIME[path4.extname(f).toLowerCase()] ?? "application/octet-stream");
    return send(res, 200, fs3.readFileSync(index), MIME[".html"]);
  };
  const server = http.createServer((req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      return json(res, { error: `${req.method} is not accepted: the page only reads` }, 405);
    }
    const url = new URL(req.url ?? "/", "http://x");
    const p = url.pathname;
    try {
      if (p === "/events") return sse.add(res);
      if (p === "/api/repos") return json(res, board.repos());
      if (p === "/api/board") {
        const repo = url.searchParams.get("repo") ?? "";
        if (!board.repos().some((r) => r.repo === repo)) return json(res, { error: `no repository ${repo}` }, 404);
        return json(res, board.snapshot(repo));
      }
      if (p.startsWith("/api/")) return json(res, { error: `no route ${p}` }, 404);
      return serveStatic(res, p);
    } catch (e) {
      return json(res, { error: e.message }, 500);
    }
  });
  server.on("close", () => {
    off();
    sse.close();
  });
  server.on("error", (err) => {
    console.error(err.code === "EADDRINUSE" ? `swarm: port ${port} is already in use. Retry with --port <n> or set SWARM_PORT.` : `swarm: server error: ${err.message}`);
    process.exit(1);
  });
  server.listen(port, "127.0.0.1", () => {
    const actual = server.address().port;
    if (writeState) {
      writeServerFiles(actual);
      process.on("exit", clearServerFiles);
      for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(0));
    }
    const url = `http://localhost:${actual}/`;
    console.log(`swarm  the page
  url   ${url}`);
    if (open) openBrowser(url);
  });
  return server;
}
var MIME, defaultToolRoot;
var init_server = __esm({
  "src/server/index.ts"() {
    "use strict";
    init_sse();
    init_state();
    MIME = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".mjs": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".map": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2"
    };
    defaultToolRoot = () => process.env.SWARM_ROOT ?? path4.dirname(path4.resolve(process.argv[1] ?? "."));
  }
});

// src/cli/index.ts
import { spawn as spawn2, spawnSync } from "node:child_process";
import fs4 from "node:fs";
import path5 from "node:path";

// src/board/board.ts
init_home();
import fs from "node:fs";
import path2 from "node:path";

// src/board/mentions.ts
function planCode(plan) {
  const words = plan.split(/[-_\s.]+/).filter((w) => w && !/^\d+$/.test(w));
  if (words.length === 0) return plan.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
var MENTION = /(?<![\w@])@([A-Za-z0-9][\w.\-]*(?:[\/·][A-Za-z0-9][\w.\-]*)?)/g;
var nameHandle = (nick) => nick.replace(/\s+/g, "").toLowerCase();
function parseMentions(body, senderPlan, plans, names) {
  const out = /* @__PURE__ */ new Set();
  for (const m of body.matchAll(MENTION)) {
    const token = m[1].replace(/[.\-]+$/, "");
    const named = names?.get(token.toLowerCase());
    if (named) {
      out.add(named);
    } else if (token.includes("/")) {
      const [plan, slice] = token.split("/");
      out.add(`${plan}/${slice === "all" ? "*" : slice}`);
    } else if (token.includes("\xB7")) {
      const [code, slice] = token.split("\xB7");
      for (const plan of plans) if (planCode(plan) === code.toUpperCase()) out.add(`${plan}/${slice === "all" ? "*" : slice}`);
    } else if (token === "all") {
      out.add(`${senderPlan}/*`);
    } else {
      out.add(`${senderPlan}/${token}`);
    }
  }
  return [...out];
}

// src/board/names.ts
var ADJECTIVES = [
  "Sleepy",
  "Grumpy",
  "Brave",
  "Clumsy",
  "Dizzy",
  "Fuzzy",
  "Gentle",
  "Hasty",
  "Jolly",
  "Lucky",
  "Mighty",
  "Nimble",
  "Plucky",
  "Quiet",
  "Rusty",
  "Sneaky",
  "Tidy",
  "Witty",
  "Zesty",
  "Bouncy",
  "Cheeky",
  "Dapper",
  "Eager",
  "Fancy",
  "Giddy",
  "Humble",
  "Lofty",
  "Merry",
  "Peppy",
  "Snappy"
];
var ANIMALS = [
  "Otter",
  "Badger",
  "Walrus",
  "Penguin",
  "Llama",
  "Ferret",
  "Puffin",
  "Wombat",
  "Gecko",
  "Moose",
  "Panda",
  "Lemur",
  "Narwhal",
  "Hedgehog",
  "Koala",
  "Yak",
  "Toucan",
  "Beaver",
  "Platypus",
  "Raccoon",
  "Alpaca",
  "Bison",
  "Capybara",
  "Dingo",
  "Emu",
  "Flamingo",
  "Gibbon",
  "Heron",
  "Ibis",
  "Jackal"
];
function funnyName(taken, random = Math.random) {
  const used = new Set([...taken].map((t) => t.toLowerCase()));
  const pick = (xs) => xs[Math.floor(random() * xs.length) % xs.length];
  const free = ADJECTIVES.flatMap((a) => ANIMALS.map((b) => `${a} ${b}`)).filter((n) => !used.has(n.toLowerCase()));
  if (free.length) return pick(free);
  for (let i = 2; ; i++) {
    const n = `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${i}`;
    if (!used.has(n.toLowerCase())) return n;
  }
}

// src/board/board.ts
var SLICE_STATES = /* @__PURE__ */ new Set(["ready", "running", "done", "blocked"]);
var ORCHESTRATOR = "orchestrator";
var WAIT_POLL_MS = 1e3;
var LINE_WIDTH = 100;
var STALE_MS = 10 * 60 * 1e3;
var CLOSED_LISTED = 10;
var EVENTS_SHOWN = 500;
var CASELESS = process.platform === "win32";
function messageLine(m) {
  const first = m.body.split(/\r?\n/)[0];
  const text = first.length > LINE_WIDTH ? `${first.slice(0, LINE_WIDTH - 1)}\u2026` : first;
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}: ${text}`;
}
async function openBoard(dbPath = SQLITE_PATH) {
  process.removeAllListeners("warning");
  process.on("warning", (w) => {
    if (w.name !== "ExperimentalWarning") console.warn(w);
  });
  const { DatabaseSync } = await import("node:sqlite");
  fs.mkdirSync(path2.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    -- The CLI and the server write concurrently; without a busy timeout a
    -- concurrent verb fails outright with SQLITE_BUSY.
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY,
      repo TEXT NOT NULL,
      plan TEXT NOT NULL,
      title TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS slices (
      run INTEGER NOT NULL,
      id TEXT NOT NULL,
      title TEXT NOT NULL,
      blockers TEXT NOT NULL DEFAULT '[]',
      state TEXT NOT NULL DEFAULT 'ready',
      ord INTEGER NOT NULL,
      PRIMARY KEY (run, id)
    );
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY,
      run INTEGER NOT NULL,
      slice TEXT NOT NULL,
      worktree TEXT,
      doing TEXT NOT NULL DEFAULT '',
      files TEXT NOT NULL DEFAULT '[]',
      since_seq INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL,
      ended_at TEXT,
      last_call TEXT,
      UNIQUE (run, slice)
    );
    CREATE TABLE IF NOT EXISTS messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      repo TEXT NOT NULL,
      author INTEGER NOT NULL,
      body TEXT NOT NULL,
      about TEXT,
      kind TEXT NOT NULL DEFAULT 'msg',
      mentions TEXT NOT NULL DEFAULT '[]',
      at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_repo ON messages (repo, seq);
    CREATE TABLE IF NOT EXISTS deliveries (
      participant INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      PRIMARY KEY (participant, seq)
    );
    -- claims are global by repository-relative path, across every run on a repository (D12, D20);
    -- a path may have several holders (D40). since_seq: the thread's last seq when it was claimed
    CREATE TABLE IF NOT EXISTS claims (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'inside',
      since_seq INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (repo, path, participant)
    );
    -- every claim made, kept past its release: who held a path during a run (D63)
    CREATE TABLE IF NOT EXISTS claim_log (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant)
    );
    -- a holder of a shared path already told of another holder (D41): once per runner and path
    CREATE TABLE IF NOT EXISTS notices (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      other INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant, other)
    );
    CREATE TABLE IF NOT EXISTS merge_locks (
      repo TEXT PRIMARY KEY,
      participant INTEGER NOT NULL,
      at TEXT NOT NULL
    );
    -- a runner refused the merge lock since its holder took it: mentioned when it is released (D65)
    CREATE TABLE IF NOT EXISTS lock_waiters (
      repo TEXT NOT NULL,
      participant INTEGER NOT NULL,
      PRIMARY KEY (repo, participant)
    );
    -- a path written outside its writer's claim, by reconcileWrites; lives while a claim on it does (D39)
    CREATE TABLE IF NOT EXISTS flags (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant)
    );
    -- a version per repository, moved by every write: what onChange compares (D39)
    CREATE TABLE IF NOT EXISTS changes (
      repo TEXT PRIMARY KEY,
      version INTEGER NOT NULL
    );
    -- the identities and hook_seen tables, left in stores from before D58, are no longer read or written
  `);
  const upkeep = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  upkeep("participants", "worktree", "worktree TEXT");
  upkeep("participants", "last_call", "last_call TEXT");
  upkeep("participants", "calls", "calls INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "waiting", "waiting INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "listening", "listening INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "nick", "nick TEXT");
  upkeep("participants", "wait_gen", "wait_gen INTEGER NOT NULL DEFAULT 0");
  upkeep("messages", "by_board", "by_board INTEGER NOT NULL DEFAULT 0");
  upkeep("runs", "link", "link TEXT");
  upkeep("slices", "link", "link TEXT");
  const claimKey = db.prepare("PRAGMA table_info(claims)").all().find((c) => c.name === "participant");
  if (claimKey && claimKey.pk === 0) {
    db.exec(`
      BEGIN;
      ALTER TABLE claims RENAME TO claims_before_d40;
      CREATE TABLE claims (
        repo TEXT NOT NULL,
        path TEXT NOT NULL,
        participant INTEGER NOT NULL,
        kind TEXT NOT NULL DEFAULT 'inside',
        since_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (repo, path, participant)
      );
      INSERT INTO claims (repo, path, participant, kind) SELECT repo, path, participant, kind FROM claims_before_d40;
      DROP TABLE claims_before_d40;
      COMMIT;
    `);
  }
  const signal = `${dbPath}.signal`;
  if (!fs.existsSync(signal)) fs.writeFileSync(signal, "0");
  let touches = 0;
  const touch = () => fs.writeFileSync(signal, `${process.pid}:${++touches}`);
  const now = () => (/* @__PURE__ */ new Date()).toISOString();
  let depth = 0;
  let dirty = false;
  const transaction = (fn) => {
    if (depth > 0) return fn();
    db.exec("BEGIN IMMEDIATE");
    depth++;
    let ok = false;
    try {
      const out = fn();
      db.exec("COMMIT");
      ok = true;
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {
      depth--;
      if (dirty) {
        dirty = false;
        if (ok) touch();
      }
    }
  };
  const bump = (repo) => {
    db.prepare("INSERT INTO changes (repo, version) VALUES (?, 1) ON CONFLICT (repo) DO UPDATE SET version = version + 1").run(repo);
    if (depth > 0) dirty = true;
    else touch();
  };
  const clearFlags = () => {
    db.prepare("DELETE FROM flags WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = flags.repo AND c.path = flags.path)").run();
    db.prepare(
      `DELETE FROM notices WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.participant)
         OR NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.other)`
    ).run();
  };
  const runRow = (id) => {
    const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
    if (!r) throw new Error(`unknown run ${id}`);
    return r;
  };
  const toRun = (r) => ({
    id: Number(r.id),
    repo: String(r.repo),
    plan: String(r.plan),
    title: String(r.title),
    link: r.link == null ? null : String(r.link),
    state: r.state === "closed" ? "closed" : "open",
    slices: db.prepare("SELECT * FROM slices WHERE run = ? ORDER BY ord").all(Number(r.id)).map((s) => ({
      id: String(s.id),
      title: String(s.title),
      link: s.link == null ? null : String(s.link),
      blockers: JSON.parse(String(s.blockers)),
      state: String(s.state)
    }))
  });
  const nickOf = (r) => String(r.slice) === ORCHESTRATOR ? ORCHESTRATOR : r.nick == null ? String(r.slice) : String(r.nick);
  const PARTICIPANT_SQL = `SELECT p.*, r.repo, r.plan FROM participants p JOIN runs r ON r.id = p.run`;
  const toParticipant = (r) => ({
    id: Number(r.id),
    run: Number(r.run),
    repo: String(r.repo),
    plan: String(r.plan),
    slice: String(r.slice),
    name: `${r.plan}/${r.slice}`,
    nick: nickOf(r),
    ended: r.ended_at != null,
    worktree: r.worktree == null ? null : String(r.worktree),
    listening: Number(r.listening) === 1
  });
  const participantById = (id) => toParticipant(db.prepare(`${PARTICIPANT_SQL} WHERE p.id = ?`).get(id));
  const toMessage = (r) => ({
    seq: Number(r.seq),
    repo: String(r.repo),
    from: participantById(Number(r.author)).name,
    body: String(r.body),
    about: r.about == null ? null : String(r.about),
    kind: String(r.kind),
    mentions: JSON.parse(String(r.mentions)),
    at: String(r.at)
  });
  const lastSeq = () => Number(db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM messages").get().s);
  const openPlans = (repo) => db.prepare("SELECT DISTINCT plan FROM runs WHERE repo = ? AND state = 'open'").all(repo).map((r) => String(r.plan));
  const activeNames = (repo) => {
    const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL AND p.slice != '${ORCHESTRATOR}'`).all(repo);
    return new Map(rows.map((r) => [nameHandle(nickOf(r)), `${r.plan}/${r.slice}`]));
  };
  const insertMessage = (p, body, about, kind, named) => {
    const mentions = named ?? (kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo), activeNames(p.repo)));
    const r = db.prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at, by_board) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(p.repo, p.id, body, about, kind, JSON.stringify(mentions), now(), named ? 1 : 0);
    const seq = Number(r.lastInsertRowid);
    bump(p.repo);
    return board.read(seq);
  };
  const live = (p) => {
    const fresh = participantById(p.id);
    if (fresh.ended) throw new Error(`runner ${p.name} has ended`);
    return fresh;
  };
  const isLive = (id) => db.prepare("SELECT 1 FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ? AND p.ended_at IS NULL AND r.state = 'open'").get(id) !== void 0;
  const fold = (s) => CASELESS ? s.toLowerCase() : s;
  const slashes = (rel) => rel.split(/[\\/]+/).filter((x) => x && x !== ".").join("/");
  const roots = (repo) => {
    const out = /* @__PURE__ */ new Set();
    if (path2.basename(repo).toLowerCase() === ".git") out.add(path2.resolve(path2.dirname(repo)));
    const rows = db.prepare("SELECT DISTINCT p.worktree FROM participants p JOIN runs r ON r.id = p.run WHERE r.repo = ? AND p.worktree IS NOT NULL").all(repo);
    for (const r of rows) out.add(path2.resolve(String(r.worktree)));
    return [...out].sort((a, b) => b.length - a.length);
  };
  const relPath = (repo, file) => {
    if (!path2.isAbsolute(file) && !file.startsWith("/")) return slashes(file) || null;
    const abs = fold(path2.resolve(file));
    for (const root of roots(repo)) {
      const r = fold(root);
      if (abs.startsWith(r.endsWith(path2.sep) ? r : r + path2.sep)) return slashes(path2.resolve(file).slice(root.length)) || null;
    }
    return null;
  };
  const holdersOf = (repo, rel) => db.prepare("SELECT participant, kind, since_seq FROM claims WHERE repo = ? AND path = ? ORDER BY rowid").all(repo, rel).map((r) => ({ participant: Number(r.participant), kind: String(r.kind), since: Number(r.since_seq) })).filter((c) => isLive(c.participant));
  const hold = (p, rel, kind) => transaction(() => {
    const r = db.prepare(
      `INSERT INTO claims (repo, path, participant, kind, since_seq) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (repo, path, participant) DO UPDATE SET kind = excluded.kind WHERE claims.kind = 'inside' AND excluded.kind = 'interface'`
    ).run(p.repo, rel, p.id, kind, lastSeq());
    db.prepare("INSERT OR IGNORE INTO claim_log (repo, path, participant) VALUES (?, ?, ?)").run(p.repo, rel, p.id);
    if (Number(r.changes) === 0) return false;
    bump(p.repo);
    return true;
  });
  const take = (p, rel, kind) => transaction(() => {
    const held = holdersOf(p.repo, rel).filter((c) => c.participant !== p.id);
    if (held.length) return { held, taken: false };
    return { held, taken: hold(p, rel, kind) };
  });
  const takeUnlessHeld = (p, rel, kind) => void take(p, rel, kind);
  const doingOf = (id) => String(db.prepare("SELECT doing FROM participants WHERE id = ?").get(id).doing) || "no note";
  const hasPostedAbout = (p, rel, holders) => {
    const since = Math.min(...holders.map((h) => h.since));
    const rows = db.prepare("SELECT seq, body, about, mentions FROM messages WHERE repo = ? AND author = ? AND seq > ? AND kind != 'event' AND by_board = 0").all(p.repo, p.id, since);
    const base = rel.split("/").pop();
    const names = (r) => {
      const about = r.about == null ? "" : fold(slashes(String(r.about)));
      const f = fold(rel);
      if (about && (about === f || f.endsWith(`/${about}`))) return true;
      const body = fold(String(r.body));
      return body.includes(f) || body.includes(fold(base));
    };
    return rows.some((r) => {
      if (!names(r)) return false;
      const mentions = JSON.parse(String(r.mentions));
      return holders.some((h) => {
        const o = participantById(h.participant);
        return Number(r.seq) > h.since && (mentions.includes(o.name) || mentions.includes(`${o.plan}/*`));
      });
    });
  };
  const releaseAll = (id) => {
    const owner = db.prepare("SELECT r.repo FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ?").get(id);
    const claims = Number(db.prepare("DELETE FROM claims WHERE participant = ?").run(id).changes);
    const locks = Number(db.prepare("DELETE FROM merge_locks WHERE participant = ?").run(id).changes);
    clearFlags();
    if (owner && claims + locks > 0) bump(String(owner.repo));
  };
  const takeLockWaiters = (repo) => {
    const rows = db.prepare("SELECT participant FROM lock_waiters WHERE repo = ? ORDER BY rowid").all(repo);
    db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(repo);
    return rows.map((r) => Number(r.participant)).filter(isLive).map((id) => participantById(id).name);
  };
  const askedAbout = (me, author, m) => {
    const about = fold(relPath(me.repo, m.about) ?? slashes(m.about));
    const mine = db.prepare("SELECT path FROM claims WHERE repo = ? AND participant = ? AND since_seq < ?").all(me.repo, me.id, m.seq);
    const rel = mine.map((r) => String(r.path)).find((x) => fold(x) === about || fold(x).endsWith(`/${about}`));
    if (!rel) return null;
    const theirs = db.prepare("SELECT 1 FROM claims WHERE repo = ? AND path = ? AND participant = ? AND since_seq < ?").get(me.repo, rel, author, m.seq);
    return theirs ? null : rel;
  };
  const deliverTo = (p, fromWait, mentionsOnly = false) => {
    const me = participantById(p.id);
    const named = (m) => m.mentions.includes(me.name) || m.mentions.includes(`${me.plan}/*`);
    const messages = transaction(() => {
      const unseen = db.prepare(
        `SELECT m.* FROM messages m
           WHERE m.repo = ? AND m.seq > ? AND m.author != ?
             AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.participant = ? AND d.seq = m.seq)
           ORDER BY m.seq`
      ).all(me.repo, Number(db.prepare("SELECT since_seq FROM participants WHERE id = ?").get(me.id).since_seq), me.id, me.id);
      const rows = mentionsOnly ? unseen.filter((r) => r.kind === "urgent" || named(toMessage(r))) : unseen;
      const mark = db.prepare("INSERT INTO deliveries (participant, seq) VALUES (?, ?)");
      for (const r of rows) mark.run(me.id, Number(r.seq));
      db.prepare("UPDATE participants SET last_call = ? WHERE id = ?").run(now(), me.id);
      if (!fromWait) {
        db.prepare("UPDATE participants SET calls = calls + 1 WHERE id = ?").run(me.id);
        const r = db.prepare("UPDATE participants SET waiting = 0 WHERE id = ? AND waiting = 1").run(me.id);
        if (Number(r.changes) > 0) bump(me.repo);
      }
      return rows.map((r) => {
        const m = toMessage(r);
        const rel = r.by_board || m.kind !== "msg" || !m.about || !named(m) ? null : askedAbout(me, Number(r.author), m);
        return rel ? { ...m, answer: `answer with an agreement on who changes what: swarm agree "<who changes what in ${rel}>" --about ${rel}` } : m;
      });
    });
    return {
      full: messages.filter(named),
      lines: messages.filter((m) => !named(m)).map(messageLine)
    };
  };
  const listedRuns = () => db.prepare(
    `SELECT * FROM runs WHERE state = 'open'
           OR id IN (SELECT id FROM runs WHERE state = 'closed' ORDER BY closed_at DESC, id DESC LIMIT ?)
         ORDER BY id`
  ).all(CLOSED_LISTED);
  const runSummary = (r) => {
    const id = Number(r.id);
    const count = (sql) => Number(db.prepare(sql).get(id).n);
    const open = r.state === "open";
    return {
      run: id,
      plan: String(r.plan),
      code: planCode(String(r.plan)),
      title: String(r.title),
      link: r.link == null ? null : String(r.link),
      open,
      runners: open ? count(`SELECT COUNT(*) AS n FROM participants WHERE run = ? AND slice != '${ORCHESTRATOR}' AND ended_at IS NULL`) : 0,
      done: count("SELECT COUNT(*) AS n FROM slices WHERE run = ? AND state = 'done'"),
      of: count("SELECT COUNT(*) AS n FROM slices WHERE run = ?")
    };
  };
  const repoName = (repo) => {
    const base = path2.basename(repo);
    return base.toLowerCase() === ".git" ? path2.basename(path2.dirname(repo)) : base.replace(/\.git$/i, "");
  };
  const listeners = /* @__PURE__ */ new Set();
  let watching = null;
  let versions = /* @__PURE__ */ new Map();
  const readVersions = () => new Map(db.prepare("SELECT repo, version FROM changes").all().map((r) => [String(r.repo), Number(r.version)]));
  const declared = (id) => JSON.parse(String(db.prepare("SELECT files FROM participants WHERE id = ?").get(id).files));
  const board = {
    openRun({ repo, plan, title, link, slices }) {
      const id = transaction(() => {
        const r = db.prepare("INSERT INTO runs (repo, plan, title, link, opened_at) VALUES (?, ?, ?, ?, ?)").run(repo, plan, title, link ?? null, now());
        const run = Number(r.lastInsertRowid);
        const ins = db.prepare("INSERT INTO slices (run, id, title, blockers, link, ord) VALUES (?, ?, ?, ?, ?, ?)");
        slices.forEach((s, i) => ins.run(run, s.id, s.title, JSON.stringify(s.blockers ?? []), s.link ?? null, i));
        db.prepare("INSERT INTO participants (run, slice, since_seq, joined_at) VALUES (?, ?, ?, ?)").run(run, ORCHESTRATOR, lastSeq(), now());
        bump(repo);
        return run;
      });
      return toRun(runRow(id));
    },
    setSliceState(run, slice, state) {
      runRow(run);
      if (!SLICE_STATES.has(state)) throw new Error(`unknown slice state ${state}`);
      transaction(() => {
        const r = db.prepare("UPDATE slices SET state = ? WHERE run = ? AND id = ?").run(state, run, slice);
        if (Number(r.changes) === 0) throw new Error(`unknown slice ${slice} in run ${run}`);
        bump(String(runRow(run).repo));
        if (state !== "done") return;
        const p = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, slice);
        if (p) releaseAll(Number(p.id));
      });
    },
    closeRun(run) {
      runRow(run);
      transaction(() => {
        db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run);
        bump(String(runRow(run).repo));
        db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run);
        for (const p of db.prepare("SELECT id FROM participants WHERE run = ?").all(run)) releaseAll(Number(p.id));
      });
    },
    runs() {
      return db.prepare("SELECT * FROM runs WHERE state = 'open' ORDER BY id").all().map(toRun);
    },
    join({ run, slice, doing, files, worktree }) {
      const r = runRow(run);
      if (r.state !== "open") throw new Error(`run ${run} is closed`);
      if (slice === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      const where = worktree ? path2.resolve(worktree) : null;
      return transaction(() => {
        const id = transaction(() => {
          const existing = db.prepare("SELECT id, nick FROM participants WHERE run = ? AND slice = ?").get(run, slice);
          const fresh = () => {
            const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL`).all(String(r.repo));
            return funnyName(rows.map(nickOf));
          };
          if (existing) {
            db.prepare("UPDATE participants SET doing = ?, files = ?, worktree = ?, ended_at = NULL, nick = COALESCE(nick, ?) WHERE id = ?").run(
              doing,
              JSON.stringify(files),
              where,
              existing.nick == null ? fresh() : null,
              Number(existing.id)
            );
            return Number(existing.id);
          }
          const ins = db.prepare("INSERT INTO participants (run, slice, worktree, doing, files, since_seq, joined_at, nick) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(run, slice, where, doing, JSON.stringify(files), lastSeq(), now(), fresh());
          return Number(ins.lastInsertRowid);
        });
        const runner = participantById(id);
        transaction(() => {
          for (const f of files) {
            const rel = relPath(runner.repo, f.path);
            if (rel) takeUnlessHeld(runner, rel, f.interface ? "interface" : "inside");
          }
        });
        insertMessage(runner, `joined: ${doing}`, null, "event");
        return { runner, roster: board.roster(runner.repo) };
      });
    },
    participant(name) {
      const i = name.lastIndexOf("/");
      if (i <= 0) return null;
      const plan = name.slice(0, i);
      const slice = name.slice(i + 1);
      const r = db.prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? ORDER BY (r.state = 'open') DESC, r.id DESC LIMIT 1`).get(plan, slice);
      return r ? toParticipant(r) : null;
    },
    identify({ worktree }) {
      if (!worktree) return null;
      const here = fold(path2.resolve(worktree));
      const rows = db.prepare(`${PARTICIPANT_SQL} WHERE p.worktree IS NOT NULL AND p.ended_at IS NULL AND r.state = 'open'`).all().filter(
        (r) => {
          const root = fold(String(r.worktree));
          return here === root || here.startsWith(root.endsWith(path2.sep) ? root : root + path2.sep);
        }
      );
      if (!rows.length) return null;
      const deepest = Math.max(...rows.map((r) => String(r.worktree).length));
      const best = rows.filter((r) => String(r.worktree).length === deepest);
      return best.length === 1 ? toParticipant(best[0]) : null;
    },
    setDoing(p, doing) {
      const fresh = live(p);
      db.prepare("UPDATE participants SET doing = ? WHERE id = ?").run(doing, fresh.id);
      insertMessage(fresh, `doing: ${doing}`, null, "event");
    },
    end(p) {
      const fresh = live(p);
      transaction(() => {
        const held = db.prepare("SELECT 1 FROM merge_locks WHERE repo = ? AND participant = ?").get(fresh.repo, fresh.id) !== void 0;
        const waiters = held ? takeLockWaiters(fresh.repo).filter((n) => n !== fresh.name) : [];
        if (waiters.length) insertMessage(fresh, `ended
the merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`, null, "event", waiters);
        else insertMessage(fresh, "ended", null, "event");
        db.prepare("UPDATE participants SET ended_at = ? WHERE id = ?").run(now(), fresh.id);
        releaseAll(fresh.id);
      });
    },
    roster(repo) {
      const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL ORDER BY r.id, p.id`).all(repo);
      const cutoff = Date.now() - STALE_MS;
      return rows.map((r) => ({
        name: `${r.plan}/${r.slice}`,
        nick: nickOf(r),
        run: Number(r.run),
        plan: String(r.plan),
        slice: String(r.slice),
        doing: String(r.doing),
        files: JSON.parse(String(r.files)),
        stale: Date.parse(String(r.last_call ?? r.joined_at)) < cutoff
      }));
    },
    post(p, body, opts = {}) {
      const fresh = live(p);
      return insertMessage(fresh, body, opts.about ?? null, opts.kind ?? "msg");
    },
    read(seq) {
      const r = db.prepare("SELECT * FROM messages WHERE seq = ?").get(seq);
      if (!r) throw new Error(`unknown message #${seq}`);
      return toMessage(r);
    },
    deliver(p) {
      return deliverTo(p, false);
    },
    wait(p, opts = {}) {
      const { timeoutMs, mentionsOnly = false } = opts;
      const column = mentionsOnly ? "listening" : "waiting";
      const gen = transaction(() => {
        const me = participantById(p.id);
        db.prepare("UPDATE participants SET wait_gen = wait_gen + 1, waiting = ?, listening = ? WHERE id = ?").run(mentionsOnly ? 0 : 1, mentionsOnly ? 1 : 0, me.id);
        bump(me.repo);
        return Number(db.prepare("SELECT wait_gen FROM participants WHERE id = ?").get(me.id).wait_gen);
      });
      const current = () => Number(db.prepare("SELECT wait_gen FROM participants WHERE id = ?").get(p.id).wait_gen) === gen;
      return new Promise((resolve, reject) => {
        let settled = false;
        let watcher;
        let poll;
        let timer;
        const finish = (d) => {
          if (settled) return;
          settled = true;
          watcher?.close();
          clearInterval(poll);
          clearTimeout(timer);
          try {
            transaction(() => {
              const r = db.prepare(`UPDATE participants SET ${column} = 0 WHERE id = ? AND wait_gen = ? AND ${column} = 1`).run(p.id, gen);
              if (Number(r.changes) > 0) bump(participantById(p.id).repo);
            });
          } catch {
          }
          if (d instanceof Error) reject(d);
          else resolve(d);
        };
        const check = () => {
          if (settled) return;
          try {
            if (participantById(p.id).ended) return finish({ full: [], lines: [] });
            const d = transaction(() => current() ? deliverTo(p, true, mentionsOnly) : null);
            if (!d) return finish({ full: [], lines: [], superseded: true });
            if (d.full.length || d.lines.length) finish(d);
          } catch (e) {
            finish(e);
          }
        };
        watcher = fs.watch(signal, check);
        poll = setInterval(check, WAIT_POLL_MS);
        if (timeoutMs !== void 0) timer = setTimeout(() => finish({ full: [], lines: [] }), timeoutMs);
        check();
      });
    },
    checkEdit(p, file, opts = {}) {
      const kind = opts.interface ? "interface" : "inside";
      const me = live(p);
      const rel = relPath(me.repo, file);
      if (!rel) return { allowed: true, sharedWith: [], notice: null };
      return transaction(() => {
        const all = holdersOf(me.repo, rel);
        const others = all.filter((c) => c.participant !== me.id);
        if (!others.length) {
          hold(me, rel, kind);
          return { allowed: true, sharedWith: [], notice: null };
        }
        const people = others.map((c) => participantById(c.participant));
        if (!all.some((c) => c.participant === me.id)) {
          if (!hasPostedAbout(me, rel, others)) {
            const who = people.map((o) => `${o.name} (${o.nick}: ${doingOf(o.id)})`).join(", ");
            const at = people.map((o) => `@${o.name}`).join(" ");
            return {
              allowed: false,
              refusal: `${rel} is also held by ${who}. You may share it, but first tell ${people.length > 1 ? "them" : "its holder"} what you change in it: \`swarm post "${at} \u2026" --about ${rel}\`; ${people.length > 1 ? "they answer" : "its holder answers"} with an agreement on who changes what (\`swarm agree \u2026 --about ${rel}\`), and that agreement goes. Then claim again.`
            };
          }
        }
        hold(me, rel, kind);
        const sharedWith = people.map((o) => ({ runner: o.name, doing: doingOf(o.id) }));
        const told = db.prepare("INSERT OR IGNORE INTO notices (repo, path, participant, other) VALUES (?, ?, ?, ?)");
        const fresh = people.filter((o) => Number(told.run(me.repo, rel, me.id, o.id).changes) > 0);
        const notice = fresh.length ? fresh.map((o) => `${rel} is also held by ${o.name}: ${doingOf(o.id)}`).join("; ") : null;
        return { allowed: true, sharedWith, notice };
      });
    },
    reconcileWrites(p, changed) {
      const me = live(p);
      const flags = [];
      return transaction(() => {
        const flag = db.prepare("INSERT OR IGNORE INTO flags (repo, path, participant) VALUES (?, ?, ?)");
        for (const file of changed) {
          const rel = relPath(me.repo, file);
          if (!rel) continue;
          if (holdersOf(me.repo, rel).some((c) => c.participant === me.id)) {
            take(me, rel, "inside");
            continue;
          }
          const { held: others, taken } = take(me, rel, "inside");
          if (taken || others.length) flag.run(me.repo, rel, me.id);
          if (!others.length) continue;
          const holder = participantById(others[0].participant);
          const m = insertMessage(
            me,
            `@${holder.name} @${me.name} flag: ${me.name} wrote ${rel} outside its claim; ${holder.name} holds it. Settle it here.`,
            rel,
            "msg",
            [holder.name, me.name]
          );
          flags.push({ path: rel, holder: holder.name, seq: m.seq });
        }
        return flags;
      });
    },
    release(p, file) {
      const me = live(p);
      const rel = relPath(me.repo, file);
      if (!rel) return;
      transaction(() => {
        const r = db.prepare("DELETE FROM claims WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
        if (Number(r.changes) === 0) return;
        clearFlags();
        bump(me.repo);
      });
    },
    lockMerge(p) {
      const me = live(p);
      return transaction(() => {
        const r = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo);
        if (r && Number(r.participant) !== me.id && isLive(Number(r.participant))) {
          db.prepare("INSERT OR IGNORE INTO lock_waiters (repo, participant) VALUES (?, ?)").run(me.repo, me.id);
          return { granted: false, holder: participantById(Number(r.participant)).name };
        }
        if (r && Number(r.participant) === me.id) return { granted: true };
        db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(me.repo);
        db.prepare("INSERT OR REPLACE INTO merge_locks (repo, participant, at) VALUES (?, ?, ?)").run(me.repo, me.id, now());
        bump(me.repo);
        return { granted: true };
      });
    },
    merged(p, sha, files) {
      const me = live(p);
      const rels = [...new Set(files.map((f) => relPath(me.repo, f)).filter((x) => x !== null))];
      const wanted = new Set(rels);
      const told = /* @__PURE__ */ new Set();
      const iface = /* @__PURE__ */ new Set();
      const sharers = [];
      let waiters = [];
      transaction(() => {
        transaction(() => {
          const lock = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo);
          if (lock && Number(lock.participant) !== me.id && isLive(Number(lock.participant))) {
            throw new Error(`the merge lock is held by ${participantById(Number(lock.participant)).name}, not ${me.name}`);
          }
          db.prepare("DELETE FROM merge_locks WHERE repo = ?").run(me.repo);
          waiters = takeLockWaiters(me.repo).filter((n) => n !== me.name);
        });
        for (const rel of rels) {
          for (const c of holdersOf(me.repo, rel)) {
            if (c.kind === "interface") iface.add(rel);
            if (c.participant !== me.id) told.add(participantById(c.participant).name);
          }
        }
        const everyone = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL`).all(me.repo);
        for (const o of everyone) {
          for (const f of declared(Number(o.id))) {
            const rel = relPath(me.repo, f.path);
            if (!rel || !wanted.has(rel)) continue;
            if (f.interface) iface.add(rel);
            if (Number(o.id) !== me.id) told.add(`${o.plan}/${o.slice}`);
          }
        }
        const all = iface.size ? openPlans(me.repo).map((plan) => `${plan}/*`) : [];
        const lines = [`merged ${sha}: rebase onto ${sha}.`];
        if (told.size) lines.push(`${[...told].map((n) => `@${n}`).join(" ")}: you hold or declared a file it changed.`);
        if (iface.size) lines.push(`@all interface changed: ${[...iface].join(", ")}.`);
        if (waiters.length) lines.push(`the merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`);
        lines.push(`files: ${rels.join(", ") || "-"}`);
        insertMessage(me, lines.join("\n"), null, "event", [.../* @__PURE__ */ new Set([...told, ...waiters, ...all])]);
        for (const rel of rels) {
          const ids = new Set(holdersOf(me.repo, rel).map((c) => c.participant));
          const held = db.prepare("SELECT l.participant FROM claim_log l JOIN participants p ON p.id = l.participant WHERE l.repo = ? AND l.path = ? AND p.run = ? ORDER BY l.rowid").all(me.repo, rel, me.run);
          for (const r of held) ids.add(Number(r.participant));
          ids.delete(me.id);
          for (const id of ids) {
            sharers.push({ path: rel, runner: participantById(id).name });
          }
        }
      });
      return sharers;
    },
    repos() {
      const byRepo = /* @__PURE__ */ new Map();
      for (const r of listedRuns()) {
        const list = byRepo.get(String(r.repo)) ?? [];
        list.push(runSummary(r));
        byRepo.set(String(r.repo), list);
      }
      const latest = (runs) => Math.max(...runs.map((x) => x.run));
      return [...byRepo.entries()].map(([repo, runs]) => ({ repo, name: repoName(repo), runs })).sort((a, b) => Number(b.runs.some((x) => x.open)) - Number(a.runs.some((x) => x.open)) || latest(b.runs) - latest(a.runs));
    },
    snapshot(repo) {
      const runRows = listedRuns().filter((r) => r.repo === repo);
      if (!runRows.length) throw new Error(`no repository ${repo}`);
      const runIds = runRows.map((r) => Number(r.id));
      const marks = runIds.map(() => "?").join(", ");
      const lockRow = db.prepare("SELECT participant, at FROM merge_locks WHERE repo = ?").get(repo);
      const lockHolder = lockRow && isLive(Number(lockRow.participant)) ? Number(lockRow.participant) : null;
      const sliceRows = db.prepare(`SELECT * FROM slices WHERE run IN (${marks}) ORDER BY run, ord`).all(...runIds);
      const sliceOf = new Map(sliceRows.map((s) => [`${s.run}/${s.id}`, s]));
      const people = db.prepare(`${PARTICIPANT_SQL} WHERE p.run IN (${marks}) ORDER BY p.run, p.id`).all(...runIds);
      const runOpen = new Map(runRows.map((r) => [Number(r.id), r.state === "open"]));
      const cutoff = Date.now() - STALE_MS;
      const claimsOf = db.prepare("SELECT path, kind FROM claims WHERE participant = ? ORDER BY rowid");
      const live2 = db.prepare("SELECT c.path, c.kind, c.participant, p.slice, r.plan FROM claims c JOIN participants p ON p.id = c.participant JOIN runs r ON r.id = p.run WHERE c.repo = ? ORDER BY c.rowid").all(repo).filter((c) => isLive(Number(c.participant)));
      const files = /* @__PURE__ */ new Map();
      for (const c of live2) {
        const f = files.get(String(c.path)) ?? { path: String(c.path), holders: [], interface: false };
        f.holders.push(`${c.plan}/${c.slice}`);
        f.interface ||= c.kind === "interface";
        files.set(f.path, f);
      }
      const sharedBy = (path6, id) => live2.some((c) => String(c.path) === path6 && Number(c.participant) !== id);
      const roster = people.map((r) => {
        const id = Number(r.id);
        const slice = String(r.slice);
        const orchestrator = slice === ORCHESTRATOR;
        const s = sliceOf.get(`${r.run}/${slice}`);
        const ended = r.ended_at != null;
        const state = orchestrator ? runOpen.get(Number(r.run)) ? "watching" : "done" : s?.state === "done" ? "done" : ended ? "ended" : lockHolder === id ? "merging" : Number(r.waiting) === 1 ? "waiting" : "working";
        return {
          runner: `${r.plan}/${slice}`,
          nick: nickOf(r),
          plan: String(r.plan),
          slice,
          title: orchestrator ? "" : String(s?.title ?? slice),
          doing: String(r.doing),
          state,
          stale: !ended && !orchestrator && Date.parse(String(r.last_call ?? r.joined_at)) < cutoff,
          files: claimsOf.all(id).map((c) => ({ path: String(c.path), interface: c.kind === "interface", shared: sharedBy(String(c.path), id) })),
          joined: String(r.joined_at),
          calls: Number(r.calls ?? 0),
          listening: !ended && Number(r.listening) === 1
        };
      });
      const events = db.prepare("SELECT * FROM (SELECT * FROM messages WHERE repo = ? ORDER BY seq DESC LIMIT ?) ORDER BY seq").all(repo, EVENTS_SHOWN).map((r) => {
        const m = toMessage(r);
        return { seq: m.seq, at: m.at, kind: m.kind, from: m.from, body: m.body, about: m.about };
      });
      const nameOf = new Map(people.map((r) => [`${r.run}/${r.slice}`, `${r.plan}/${r.slice}`]));
      const queues = {};
      for (const run of runRows) {
        queues[String(run.plan)] = sliceRows.filter((s) => Number(s.run) === Number(run.id)).map((s) => ({
          slice: String(s.id),
          title: String(s.title),
          link: s.link == null ? null : String(s.link),
          state: String(s.state),
          blockers: JSON.parse(String(s.blockers)),
          runner: nameOf.get(`${run.id}/${s.id}`) ?? null
        }));
      }
      const flags = db.prepare("SELECT f.path, p.slice, r.plan FROM flags f JOIN participants p ON p.id = f.participant JOIN runs r ON r.id = p.run WHERE f.repo = ? ORDER BY f.rowid").all(repo).map((f) => ({ path: String(f.path), runner: `${f.plan}/${f.slice}` }));
      return {
        repo,
        name: repoName(repo),
        runs: runRows.map(runSummary),
        lock: lockHolder !== null ? { holder: participantById(lockHolder).name, since: String(lockRow.at) } : null,
        roster,
        events,
        queues,
        files: [...files.values()],
        flags
      };
    },
    onChange(listener) {
      listeners.add(listener);
      if (!watching) {
        versions = readVersions();
        const check = () => {
          let next;
          try {
            next = readVersions();
          } catch {
            return;
          }
          const moved = [...next].filter(([repo, v]) => versions.get(repo) !== v).map(([repo]) => repo);
          versions = next;
          for (const repo of moved) for (const l of [...listeners]) l(repo);
        };
        const watcher = fs.watch(signal, check);
        const poll = setInterval(check, WAIT_POLL_MS);
        watcher.unref?.();
        poll.unref?.();
        watching = { close: () => (watcher.close(), clearInterval(poll)) };
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size && watching) {
          watching.close();
          watching = null;
        }
      };
    },
    close() {
      watching?.close();
      watching = null;
      listeners.clear();
      db.close();
    }
  };
  return board;
}

// src/cli/index.ts
init_home();
init_state();

// src/cli/args.ts
var VALUE_FLAGS = /* @__PURE__ */ new Set([
  "--plan",
  "--title",
  "--slices",
  "--run",
  "--slice",
  "--state",
  "--doing",
  "--file",
  "--as",
  "--about",
  "--timeout",
  "--repo",
  "--port",
  "--onto"
]);
var LIST_FLAGS = /* @__PURE__ */ new Set(["--files"]);
function parseArgs(argv) {
  const [verb, ...rest] = argv;
  const listed = /* @__PURE__ */ new Set();
  let inList = false;
  rest.forEach((a, i) => {
    if (a.startsWith("--")) inList = LIST_FLAGS.has(a);
    else if (inList) listed.add(i);
  });
  return {
    verb,
    rest,
    positional: rest.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(rest[i - 1] ?? "") && !listed.has(i)),
    flag: (name) => {
      const i = rest.indexOf(name);
      return i >= 0 ? rest[i + 1] : void 0;
    },
    flags: (name) => rest.flatMap((a, i) => a === name && rest[i + 1] ? [rest[i + 1]] : []),
    list: (name) => {
      const out = [];
      let on = false;
      for (const a of rest) {
        if (a.startsWith("--")) on = a === name;
        else if (on) out.push(...a.split(",").map((x) => x.trim()).filter(Boolean));
      }
      return out;
    },
    has: (name) => rest.includes(name)
  };
}

// src/cli/format.ts
var fullText = (m) => {
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}  ${m.at}
${m.body}${m.answer ? `
${m.answer}` : ""}`;
};

// src/cli/index.ts
var args = parseArgs(process.argv.slice(2));
var asJson = args.has("--json");
var USAGE = [
  "usage: swarm <verb> [--json]",
  "  open    --plan <slug> --title <t> --slices <file.json> [--link <url>]   # opens a run, prints its id then the page's URL (orchestrator)",
  '          # the slices file: [{"id", "title", "blockers": [...], "link"?: "<slice document URL>"}]',
  "  slice   <id> --run <id> --state ready|running|done|blocked      # (orchestrator)",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --slice <id> --doing <t> [--files "<path>:interface,<path>:inside,\u2026"]   # prints the roster, then the command that starts your listener',
  "  doing   [--as <runner>] <text>",
  "  post    [--as <runner>] <body> [--about <path>]                 # prints the seq",
  "  agree   [--as <runner>] <terms> [--about <path>]                # prints the seq",
  "  read    <seq>",
  "  deliver [--as <runner>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <runner>] [--timeout <ms>] [--mentions]           # blocks until a message for you, then says how to re-arm; nothing on timeout or end; a newer wait supersedes it",
  "          # --mentions: only a mention of you or an urgent post ends it; the rest stays for deliver",
  "  roster  [--repo <path>]",
  "  claim   [--as <runner>] <path> [--interface]                    # before editing a file: exit 0 claimed, 3 held until you post about it",
  "  release [--as <runner>] <path>                                  # gives up a claim",
  "  merge-lock --onto <branch> [--as <runner>]                      # one merge at a time per repository; claims or flags what your branch wrote unclaimed",
  "  merged  [--as <runner>] <sha> --files <path>...                 # releases the lock, tells who must rebase and who was refused the lock, names whom to tell of a resolved conflict",
  "  end     [--as <runner>]                                         # claims or flags what you wrote unclaimed, then releases your claims and the lock",
  "  serve   [--port <p>] [--open] [--detach]                        # the page, on :4322 (SWARM_PORT)",
  "  status                                                          # data home, the page's server, open runs",
  "a runner is <plan>/<slice>, the orchestrator <plan>/orchestrator; without --as, the runner joined from this worktree"
].join("\n");
var CliError = class extends Error {
};
var fail = (msg) => {
  throw new CliError(msg);
};
var emit = (json, human) => {
  if (asJson) console.log(JSON.stringify(json));
  else if (typeof human === "string") {
    if (human) console.log(human);
  } else human();
};
var git = (cwd, ...argv) => {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
function repoOf(dir) {
  const common = git(dir, "rev-parse", "--git-common-dir");
  if (!common) fail(`not in a git repository: ${dir}`);
  const abs = path5.resolve(dir, common);
  try {
    return fs4.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
function worktreeOf(dir) {
  const top = git(dir, "rev-parse", "--show-toplevel");
  return top ? path5.resolve(top) : null;
}
function changedIn(worktree) {
  const r = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return fail(`git status failed in ${worktree}: ${r.stderr.trim()}`);
  const parts = r.stdout.split("\0");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    out.push(e.slice(3));
    if (/[RC]/.test(e.slice(0, 2)) && parts[i + 1]) out.push(parts[++i]);
  }
  return out;
}
function branchChangedIn(worktree, onto) {
  const base = git(worktree, "merge-base", onto, "HEAD") ?? fail(`no merge base between ${onto} and HEAD in ${worktree}: is --onto the branch you merge into?`);
  const r = spawnSync("git", ["diff", "--name-only", "-z", "--no-renames", `${base}..HEAD`], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return fail(`git diff failed in ${worktree}: ${r.stderr.trim()}`);
  const committed = r.stdout.split("\0").filter(Boolean);
  return [.../* @__PURE__ */ new Set([...committed, ...changedIn(worktree)])];
}
var printReconciled = (reconciled, flags) => {
  for (const file of reconciled) console.log(`reconciled ${file}`);
  for (const f of flags) console.log(`#${f.seq} flagged: you wrote ${f.path} outside your claim; ${f.holder} holds it. Settle it with @${f.holder} on the thread.`);
};
function spawnDetachedServer(port) {
  try {
    fs4.rmSync(PORT_FILE, { force: true });
  } catch {
  }
  const child = spawn2(process.execPath, [process.argv[1], "serve", "--port", String(port)], {
    detached: true,
    stdio: "ignore",
    cwd: DATA_ROOT
  });
  child.unref();
  const t0 = Date.now();
  for (; ; ) {
    const st = readServerStatus();
    if (st.running && st.port !== null) return st.port;
    if (Date.now() - t0 > 1e4) return null;
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},120)"]);
  }
}
function ensureServer() {
  const st = readServerStatus();
  if (st.running && st.port !== null) return st.port;
  fs4.mkdirSync(DATA_ROOT, { recursive: true });
  return spawnDetachedServer(portFrom(args.flag("--port")));
}
var pageUrl = (port) => `http://localhost:${port}/`;
var need = (flag) => args.flag(flag) ?? fail(`${flag} is required
${USAGE}`);
var runArg = () => {
  const raw = need("--run");
  const id = Number(raw);
  if (!Number.isInteger(id)) fail(`--run takes a run id, got ${raw}`);
  return id;
};
function caller(board) {
  const as = args.flag("--as");
  if (as) return board.participant(as) ?? fail(`unknown runner ${as}`);
  const wt = worktreeOf(process.cwd());
  const p = wt ? board.identify({ worktree: wt }) : null;
  return p ?? fail("who is calling? no single runner joined from this worktree; pass --as <plan>/<slice>");
}
var rosterLine = (r) => {
  const files = r.files.map((f) => f.interface ? `${f.path} (interface)` : f.path).join(", ");
  const who = r.slice === "orchestrator" ? r.name : `${r.nick} \xB7 ${r.name}`;
  return `${who}${r.stale ? " (stale)" : ""}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}`;
};
var printDelivery = (d) => {
  for (const m of d.full) console.log(fullText(m));
  for (const l of d.lines) console.log(l);
};
var shellWord = (w) => /^[\w@%+=:,./-]+$/.test(w) ? w : `"${w.replace(/(["\\$`])/g, "\\$1")}"`;
var self = () => ["node", shellWord(process.argv[1].replace(/\\/g, "/"))];
var listenNow = (runner) => `start your listener now, in the background (your harness's background task): ${[...self(), "wait", "--mentions", "--as", shellWord(runner)].join(" ")}`;
var emitHeard = (p, json, human) => {
  const next = !p.ended && !p.listening ? listenNow(p.name) : null;
  emit(next ? { ...json, next } : json, () => {
    if (typeof human === "string") console.log(human);
    else human();
    if (next) console.log(next);
  });
};
function parseFile(spec) {
  const m = spec.match(/^(.*):(interface|inside)$/);
  return m ? { path: m[1], interface: m[2] === "interface" } : { path: spec, interface: false };
}
function readSlices(file) {
  let raw;
  try {
    raw = JSON.parse(fs4.readFileSync(path5.resolve(file), "utf8"));
  } catch (e) {
    return fail(`cannot read slices from ${file}: ${e.message}`);
  }
  const list = Array.isArray(raw) ? raw : raw.slices;
  if (!Array.isArray(list)) return fail(`${file}: expected an array of {id, title, blockers}`);
  return list.map((s) => {
    if (typeof s.id !== "string") fail(`${file}: a slice without an id`);
    return {
      id: String(s.id),
      title: String(s.title ?? s.id),
      blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [],
      link: typeof s.link === "string" && s.link ? s.link : null
    };
  });
}
async function main(board) {
  switch (args.verb) {
    case "open": {
      const plan = need("--plan");
      const run = board.openRun({ repo: repoOf(process.cwd()), plan, title: need("--title"), link: args.flag("--link") ?? null, slices: readSlices(need("--slices")) });
      const port = ensureServer();
      const url = port === null ? null : pageUrl(port);
      if (url === null) console.error(`swarm: the page did not start (port ${portFrom(args.flag("--port"))} may be in use; swarm serve --detach --port <n>). The run is open.`);
      emit({ run: run.id, repo: run.repo, plan: run.plan, url }, url ? `${run.id}
${url}` : String(run.id));
      break;
    }
    case "slice": {
      const id = args.positional[0] ?? fail(`slice: which slice?
${USAGE}`);
      const run = runArg();
      const state = need("--state");
      board.setSliceState(run, id, state);
      emit({ run, slice: id, state }, `${id} ${state}`);
      break;
    }
    case "close": {
      const run = runArg();
      board.closeRun(run);
      emit({ run, state: "closed" }, `run ${run} closed`);
      break;
    }
    case "join": {
      const { runner, roster } = board.join({
        run: runArg(),
        slice: need("--slice"),
        doing: need("--doing"),
        files: [...args.list("--files"), ...args.flags("--file")].map(parseFile),
        worktree: worktreeOf(process.cwd()) ?? void 0
      });
      const next = listenNow(runner.name);
      emit({ runner: runner.name, nick: runner.nick, roster, next }, () => {
        console.log(`you are ${runner.name}, ${runner.nick}: @${runner.slice} or @${runner.nick.replace(/\s+/g, "")} mentions you`);
        for (const r of roster) console.log(rosterLine(r));
        console.log(next);
      });
      break;
    }
    case "doing": {
      const p = caller(board);
      const text = args.positional.join(" ") || fail("doing: what?");
      board.setDoing(p, text);
      emitHeard(p, { runner: p.name, doing: text }, `${p.name} doing: ${text}`);
      break;
    }
    case "post":
    case "agree": {
      const p = caller(board);
      const body = args.positional.join(" ") || fail(`${args.verb}: nothing to say`);
      const m = board.post(p, body, { about: args.flag("--about"), kind: args.verb === "agree" ? "agreement" : "msg" });
      emitHeard(p, { seq: m.seq, mentions: m.mentions }, `#${m.seq}`);
      break;
    }
    case "read": {
      const raw = (args.positional[0] ?? fail("read: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`read takes a seq, got ${raw}`);
      const m = board.read(seq);
      emit(m, fullText(m));
      break;
    }
    case "deliver": {
      const d = board.deliver(caller(board));
      emit(d, () => printDelivery(d));
      break;
    }
    case "wait": {
      const p = caller(board);
      const raw = args.flag("--timeout");
      const timeout = raw === void 0 ? void 0 : Number(raw);
      if (timeout !== void 0 && !(timeout >= 0)) fail(`--timeout takes milliseconds, got ${raw}`);
      const mentionsOnly = args.has("--mentions");
      const d = await board.wait(p, { timeoutMs: timeout, mentionsOnly });
      if (d.superseded) {
        emit(d, "superseded by a newer wait");
        break;
      }
      if (!d.full.length && !d.lines.length) {
        emit(d, "");
        break;
      }
      const again = [...self(), "wait"];
      if (mentionsOnly) again.push("--mentions");
      if (args.flag("--as")) again.push("--as", shellWord(args.flag("--as")));
      if (raw !== void 0) again.push("--timeout", raw);
      if (asJson) again.push("--json");
      const next = `answer on the thread if needed, then start this listener again, in the background while you work, in the foreground when you are waiting: ${again.join(" ")}`;
      emit({ next, ...d }, () => {
        console.log(next);
        printDelivery(d);
      });
      break;
    }
    case "roster": {
      const repo = repoOf(path5.resolve(args.flag("--repo") ?? process.cwd()));
      const roster = board.roster(repo);
      emit({ repo, roster }, () => {
        for (const r of roster) console.log(rosterLine(r));
      });
      break;
    }
    case "claim": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("claim: which path?");
      const verdict = board.checkEdit(p, path5.resolve(file), { interface: args.has("--interface") });
      if (!verdict.allowed) process.exitCode = 3;
      emitHeard(p, verdict, () => {
        if (!verdict.allowed) return console.log(verdict.refusal);
        const also = verdict.notice ? verdict.sharedWith.map((o) => `${o.runner} \xB7 ${board.participant(o.runner)?.nick ?? "?"}: ${o.doing}`).join("; ") : "";
        console.log(also ? `claimed ${file}, also held by ${also}` : `claimed ${file}`);
      });
      break;
    }
    case "release": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("release: which path?");
      board.release(p, path5.resolve(file));
      emit({ runner: p.name, released: file }, `${p.name} released ${file}`);
      break;
    }
    case "merge-lock": {
      const p = caller(board);
      const onto = need("--onto");
      const reconciled = p.worktree ? branchChangedIn(p.worktree, onto) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      const r = board.lockMerge(p);
      emit({ runner: p.name, ...r, reconciled, flags }, () => {
        printReconciled(reconciled, flags);
        console.log(r.granted ? "granted: merge, then swarm merged <sha> --files <path>..." : `held by ${r.holder}: swarm wait --mentions for its merged event`);
      });
      break;
    }
    case "merged": {
      const p = caller(board);
      const sha = args.positional[0] ?? fail("merged: which sha?");
      const files = args.list("--files");
      const sharers = board.merged(p, sha, files.map((f) => path5.resolve(f)));
      const tell = sharers.map(
        (o) => `if you resolved a conflict in ${o.path}, tell them: swarm post "@${o.runner} I resolved ${o.path}: <how>" --about ${o.path}`
      );
      emit({ runner: p.name, sha, files, tell }, () => {
        console.log(`merged ${sha}: lock released`);
        for (const line of tell) console.log(line);
      });
      break;
    }
    case "end": {
      const p = caller(board);
      const reconciled = p.worktree ? changedIn(p.worktree) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      board.end(p);
      emit({ runner: p.name, ended: true, reconciled, flags }, () => {
        printReconciled(reconciled, flags);
        console.log(`${p.name} ended`);
      });
      break;
    }
    case "status": {
      const runs = board.runs();
      const server = readServerStatus();
      emit({ home: DATA_ROOT, sqlite: SQLITE_PATH, server, runs: runs.length }, () => {
        console.log(`home    ${DATA_ROOT}`);
        console.log(`sqlite  ${SQLITE_PATH}`);
        console.log(
          server.running ? `page    running  pid ${server.pid}  ${pageUrl(server.port)}` : `page    not running${server.stale ? " (stale pid file)" : ""}: swarm serve --detach`
        );
        if (!runs.length) console.log("no open run");
        for (const r of runs) {
          console.log(`run ${r.id}  ${r.plan}  ${r.title}  ${r.repo}`);
          for (const s of r.slices) console.log(`  ${s.id} ${s.state}  ${s.title}${s.blockers.length ? `  blocked by ${s.blockers.join(", ")}` : ""}`);
        }
      });
      break;
    }
    default:
      fail(USAGE);
  }
}
if (!args.verb) {
  console.error(USAGE);
  process.exit(1);
}
if (args.verb === "serve" && args.has("--detach")) {
  const st = readServerStatus();
  const port = st.running && st.port !== null ? st.port : (fs4.mkdirSync(DATA_ROOT, { recursive: true }), spawnDetachedServer(portFrom(args.flag("--port"))));
  if (port === null) {
    console.error(`swarm: the server did not come up within 10 s (port ${portFrom(args.flag("--port"))} may be in use; retry with --port <n>)`);
    process.exitCode = 1;
  } else {
    const server = readServerStatus();
    emit({ server, url: pageUrl(port), already: st.running }, st.running ? `swarm's page already running on ${pageUrl(port)} (pid ${server.pid})` : `swarm's page up on ${pageUrl(port)}`);
  }
} else if (args.verb === "serve") {
  const { startServer: startServer2 } = await Promise.resolve().then(() => (init_server(), server_exports));
  startServer2(await openBoard(), { port: portFrom(args.flag("--port")), open: args.has("--open") });
} else {
  const board = await openBoard();
  try {
    await main(board);
  } catch (e) {
    console.error(e instanceof CliError ? e.message : `swarm: ${e.message}`);
    process.exitCode = 1;
  } finally {
    board.close();
  }
}

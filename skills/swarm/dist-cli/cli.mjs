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
import fs4 from "node:fs";
import http from "node:http";
import path5 from "node:path";
function startServer(board, options) {
  const { port, toolRoot: toolRoot2 = defaultToolRoot(), writeState = true, heartbeatMs } = options;
  const sse = createSseHub(heartbeatMs);
  const off = board.onChange((repo) => sse.broadcast({ type: "changed", repo }));
  const send = (res, status, body, type) => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  const json = (res, obj, status = 200) => send(res, status, JSON.stringify(obj), MIME[".json"]);
  const distDir = path5.join(toolRoot2, "dist");
  const serveStatic = (res, p) => {
    const index = path5.join(distDir, "index.html");
    if (!fs4.existsSync(index)) return send(res, 404, `swarm's page is not built. Run: npm install && npm run build  (in ${toolRoot2})`, "text/plain; charset=utf-8");
    const f = path5.resolve(distDir, "." + decodeURIComponent(p).replaceAll("..", ""));
    if (f.startsWith(distDir) && fs4.existsSync(f) && fs4.statSync(f).isFile()) return send(res, 200, fs4.readFileSync(f), MIME[path5.extname(f).toLowerCase()] ?? "application/octet-stream");
    return send(res, 200, fs4.readFileSync(index), MIME[".html"]);
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
      if (p === "/api/board" || p === "/api/run") {
        const run2 = url.searchParams.get(p === "/api/run" ? "id" : "run");
        const key = url.searchParams.get("repo");
        const repos = board.repos();
        let repo;
        if (run2 !== null) {
          repo = repos.find((r) => r.runs.some((x) => x.run === Number(run2)))?.repo;
          if (!repo) return json(res, { error: `no run ${run2}` }, 404);
        } else if (key !== null) {
          repo = repos.find((r) => r.repo === key)?.repo;
          if (!repo) return json(res, { error: `no repository ${key}` }, 404);
        } else {
          repo = repos[0]?.repo;
          if (!repo) return json(res, { error: "no repository on the board" }, 404);
        }
        return json(res, { repos, snapshot: board.snapshot(repo) });
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
    defaultToolRoot = () => process.env.SWARM_ROOT ?? path5.dirname(path5.resolve(process.argv[1] ?? "."));
  }
});

// src/cli/index.ts
import { spawn, spawnSync as spawnSync2 } from "node:child_process";
import fs5 from "node:fs";
import path6 from "node:path";

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
var isCodeShaped = (token) => /^[A-Za-z]{2}$/.test(token);
var plansOfCode = (code, plans) => plans.filter((plan) => planCode(plan) === code.toUpperCase());
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
    } else if (token === "swarm") {
      out.add(`${senderPlan}/*`);
    } else if (token === "all") {
      continue;
    } else if (isCodeShaped(token) && plansOfCode(token, plans).length) {
      for (const plan of plansOfCode(token, plans)) out.add(`${plan}/*`);
    } else {
      out.add(`${senderPlan}/${token}`);
    }
  }
  return [...out];
}
var editDistance = (a, b) => {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row.push(Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    prev = row;
  }
  return prev[b.length];
};
function unmatchedMentions(body, senderPlan, plans, names) {
  const handleOf = new Map([...names ?? /* @__PURE__ */ new Map()].map(([handle, runner]) => [runner, handle]));
  const members = /* @__PURE__ */ new Set([...handleOf.keys(), ...[senderPlan, ...plans].map((p) => `${p}/orchestrator`)]);
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const m of body.matchAll(MENTION)) {
    const token = m[1].replace(/[.\-]+$/, "");
    if (seen.has(token)) continue;
    seen.add(token);
    if (names?.has(token.toLowerCase())) continue;
    if (token === "all") {
      out.push({ name: token, closest: ["swarm"] });
      continue;
    }
    const targets = parseMentions(`@${token}`, senderPlan, plans, names);
    if (targets.length && targets.every((t) => t.endsWith("/*") || members.has(t))) continue;
    if (isCodeShaped(token)) {
      const codes = [...new Set(plans.map(planCode))];
      out.push({ name: token, closest: codes.sort((a, b) => editDistance(token.toUpperCase(), a) - editDistance(token.toUpperCase(), b)).slice(0, 3) });
      continue;
    }
    const wanted = token.split(/[/·]/).pop().toLowerCase();
    const gap = (member) => Math.min(editDistance(wanted, member.slice(member.lastIndexOf("/") + 1).toLowerCase()), editDistance(wanted, handleOf.get(member) ?? member));
    out.push({ name: token, closest: [...members].sort((a, b) => gap(a) - gap(b)).slice(0, 3) });
  }
  return out;
}

// src/board/kinds.ts
var run = (...events) => events.map((event) => ({ event, scope: "run" }));
var PROFILES = {
  plan: { kind: "plan", claims: true, mergeLock: true, worktree: true, member: "runner", defaults: { member: [], orchestrator: run("merged", "ended", "stale") } },
  brainstorm: { kind: "brainstorm", claims: false, mergeLock: false, worktree: false, member: "seat", defaults: { member: [], orchestrator: run("agreement", "endorsement", "ended", "stale") } }
};
function profileOf(kind) {
  const profile = PROFILES[kind];
  if (!profile || !Object.hasOwn(PROFILES, kind)) throw new Error(`unknown kind ${kind}: the kinds are ${Object.keys(PROFILES).join(", ")}`);
  return profile;
}

// src/board/events.ts
var word = (w) => /^[\w@%+=:,./-]+$/.test(w) ? w : `"${w.replace(/(["\\$`])/g, "\\$1")}"`;
var EVENTS = {
  // a seat backs another member's agreement (D36)
  agreement: {
    name: "agreement",
    next: (m, me, cli) => profileOf(me.kind).member === "seat" && m.from !== me.name ? `back it: ${cli} endorse ${m.seq} --as ${word(me.name)}` : null
  },
  endorsement: { name: "endorsement" },
  merged: { name: "merged" },
  joined: { name: "joined" },
  ended: { name: "ended" },
  stale: { name: "stale" },
  // an orchestrator silent STALE_MS, posted once in its run (D15); "back" when it calls again
  quiet: { name: "quiet" },
  back: { name: "back" },
  // when a run opens: its kind, group and title (D69)
  opened: { name: "opened" },
  closed: { name: "closed" },
  urgent: { name: "urgent", always: true },
  // a write outside the writer's claim on a path another holds (D10); mentions: the holder, then the writer
  flag: {
    name: "flag",
    next: (m, me, cli) => {
      const [holder, writer] = m.mentions;
      if (!m.about || !holder || !writer) return null;
      if (me.name === holder) return `settle it: ${cli} agree ${word(`@${writer} <who changes what>`)} --about ${word(m.about)}`;
      if (me.name === writer) return `settle it: ${cli} post ${word(`@${holder} <what you change>`)} --about ${word(m.about)}`;
      return null;
    }
  }
};
var NAMES = Object.keys(EVENTS);
var isEvent = (s) => Object.hasOwn(EVENTS, s);
function eventOf(m) {
  if (m.event && isEvent(m.event)) return m.event;
  return m.kind === "agreement" || m.kind === "endorsement" || m.kind === "urgent" ? m.kind : null;
}
function parseSubscriptions(spec) {
  const parts = (Array.isArray(spec) ? spec : [spec]).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const prefix = /^(any|main):/.exec(p)?.[0];
    const name = prefix ? p.slice(prefix.length) : p;
    if (!isEvent(name)) throw new Error(`unknown event ${name}: the events are ${NAMES.join(", ")}`);
    const sub = { event: name, scope: prefix ? "any" : "run" };
    if (!out.some((o) => o.event === sub.event && o.scope === sub.scope)) out.push(sub);
  }
  return out;
}
function formatSubscriptions(subs) {
  return subs.map((s) => s.scope === "any" ? `any:${s.event}` : s.event).join(", ");
}
function mentions(m, me) {
  return m.mentions.includes(me.name) || m.mentions.includes(`${me.plan}/*`);
}
function wakes(m, me, subs) {
  if (m.from === me.name) return false;
  if (mentions(m, me)) return true;
  const e = eventOf(m);
  if (!e) return false;
  if (EVENTS[e].always) return true;
  return subs.some((s) => s.event === e && (s.scope === "any" || m.run === me.run));
}

// src/board/claims.ts
function claimsOf(deps) {
  const { db, transaction, bump, now, lastSeq, participantById, isLive, insertMessage, relPath, fold, slashes, doingOf } = deps;
  const clearFlags = () => {
    db.prepare("DELETE FROM flags WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = flags.repo AND c.path = flags.path)").run();
    db.prepare(
      `DELETE FROM notices WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.participant)
         OR NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.other)`
    ).run();
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
      const mentions2 = JSON.parse(String(r.mentions));
      return holders.some((h) => {
        const o = participantById(h.participant);
        return Number(r.seq) > h.since && (mentions2.includes(o.name) || mentions2.includes(`${o.plan}/*`));
      });
    });
  };
  const noticeOf = (me, rel, people) => {
    const told = db.prepare("INSERT OR IGNORE INTO notices (repo, path, participant, other) VALUES (?, ?, ?, ?)");
    const fresh = people.filter((o) => Number(told.run(me.repo, rel, me.id, o.id).changes) > 0);
    return fresh.length ? fresh.map((o) => `${rel} is also held by ${o.name}: ${doingOf(o.id)}`).join("; ") : null;
  };
  const releaseAll = (id) => {
    const owner = db.prepare("SELECT r.repo FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ?").get(id);
    const claims = Number(db.prepare("DELETE FROM claims WHERE participant = ?").run(id).changes);
    const locks = Number(db.prepare("DELETE FROM merge_locks WHERE participant = ?").run(id).changes);
    db.prepare("DELETE FROM claim_requests WHERE participant = ?").run(id);
    clearFlags();
    if (owner && claims + locks > 0) bump(String(owner.repo));
  };
  const takeLockWaiters = (repo) => {
    const rows = db.prepare("SELECT participant FROM lock_waiters WHERE repo = ? ORDER BY rowid").all(repo);
    db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(repo);
    return rows.map((r) => Number(r.participant)).filter(isLive).map((id) => participantById(id).name);
  };
  const declared = (id) => JSON.parse(String(db.prepare("SELECT files FROM participants WHERE id = ?").get(id).files));
  return {
    clearFlags,
    releaseAll,
    lockWaitersFreedBy(p) {
      const held = db.prepare("SELECT 1 FROM merge_locks WHERE repo = ? AND participant = ?").get(p.repo, p.id) !== void 0;
      return held ? takeLockWaiters(p.repo).filter((n) => n !== p.name) : [];
    },
    claimByPost(me, m) {
      if (m.kind !== "msg" && m.kind !== "agreement" || !m.about) return null;
      const about = fold(relPath(me.repo, m.about) ?? slashes(m.about));
      return transaction(() => {
        const asked = db.prepare("SELECT path, kind FROM claim_requests WHERE repo = ? AND participant = ?").all(me.repo, me.id).find((r) => {
          const x = fold(String(r.path));
          return x === about || x.endsWith(`/${about}`);
        });
        if (!asked) return null;
        const rel = String(asked.path);
        const others = holdersOf(me.repo, rel).filter((c) => c.participant !== me.id);
        if (!others.length || !hasPostedAbout(me, rel, others)) return null;
        hold(me, rel, String(asked.kind) === "interface" ? "interface" : "inside");
        db.prepare("DELETE FROM claim_requests WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
        const people = others.map((c) => participantById(c.participant));
        return { path: rel, sharedWith: people.map((o) => o.name) };
      });
    },
    claimDeclared(p, files) {
      transaction(() => {
        for (const f of files) {
          const rel = relPath(p.repo, f.path);
          if (rel) take(p, rel, f.interface ? "interface" : "inside");
        }
      });
    },
    askedAbout(me, author, m) {
      const about = fold(relPath(me.repo, m.about) ?? slashes(m.about));
      const mine = db.prepare("SELECT path FROM claims WHERE repo = ? AND participant = ? AND since_seq < ?").all(me.repo, me.id, m.seq);
      const rel = mine.map((r) => String(r.path)).find((x) => fold(x) === about || fold(x).endsWith(`/${about}`));
      if (!rel) return null;
      const theirs = db.prepare("SELECT 1 FROM claims WHERE repo = ? AND path = ? AND participant = ? AND since_seq < ?").get(me.repo, rel, author, m.seq);
      return theirs ? null : rel;
    },
    heldInOtherRun(p, rel) {
      const f = fold(rel);
      const rows = db.prepare("SELECT l.path FROM claim_log l JOIN participants q ON q.id = l.participant WHERE l.repo = ? AND q.run != ?").all(p.repo, p.run);
      return rows.some((r) => {
        const x = fold(String(r.path));
        return x === f || x.endsWith(`/${f}`);
      });
    },
    holds(p, about) {
      const f = fold(relPath(p.repo, about) ?? slashes(about));
      if (!f) return false;
      const rows = db.prepare("SELECT path FROM claims WHERE repo = ? AND participant = ?").all(p.repo, p.id);
      return rows.some((r) => {
        const x = fold(String(r.path));
        return x === f || x.endsWith(`/${f}`);
      });
    },
    checkEdit(me, file, opts = {}) {
      const kind = opts.interface ? "interface" : "inside";
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
            db.prepare(
              `INSERT INTO claim_requests (repo, path, participant, kind) VALUES (?, ?, ?, ?)
               ON CONFLICT (repo, path, participant) DO UPDATE SET kind = CASE WHEN claim_requests.kind = 'interface' THEN 'interface' ELSE excluded.kind END`
            ).run(me.repo, rel, me.id, kind);
            const who = people.map((o) => `${o.name} (${o.nick}: ${doingOf(o.id)})`).join(", ");
            const at = people.map((o) => `@${o.name}`).join(" ");
            return {
              allowed: false,
              refusal: `${rel} is also held by ${who}. You may share it, but first tell ${people.length > 1 ? "them" : "its holder"} what you change in it: \`swarm post "${at} \u2026" --about ${rel}\`; ${people.length > 1 ? "they answer" : "its holder answers"} with an agreement on who changes what (\`swarm agree \u2026 --about ${rel}\`), and that agreement goes. Then claim again.`
            };
          }
        }
        hold(me, rel, kind);
        db.prepare("DELETE FROM claim_requests WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
        const sharedWith = people.map((o) => ({ runner: o.name, doing: doingOf(o.id) }));
        return { allowed: true, sharedWith, notice: noticeOf(me, rel, people) };
      });
    },
    reconcileWrites(me, changed) {
      const flags = [];
      return transaction(() => {
        const flag = db.prepare("INSERT OR IGNORE INTO flags (repo, path, participant) VALUES (?, ?, ?)");
        const posted = db.prepare("INSERT OR IGNORE INTO flag_posts (repo, path, participant, holder) VALUES (?, ?, ?, ?)");
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
          if (Number(posted.run(me.repo, rel, me.id, holder.id).changes) === 0) continue;
          const m = insertMessage(
            me,
            `@${holder.name} @${me.name} flag: ${me.name} wrote ${rel} outside its claim; ${holder.name} holds it. Settle it here.`,
            rel,
            "event",
            [holder.name, me.name],
            { event: EVENTS.flag.name }
          );
          flags.push({ path: rel, holder: holder.name, seq: m.seq });
        }
        return flags;
      });
    },
    release(me, file) {
      const rel = relPath(me.repo, file);
      if (!rel) return;
      transaction(() => {
        const r = db.prepare("DELETE FROM claims WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
        if (Number(r.changes) === 0) return;
        clearFlags();
        bump(me.repo);
      });
    },
    lockMerge(me, onto) {
      return transaction(() => {
        const r = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo);
        if (r && Number(r.participant) !== me.id && isLive(Number(r.participant))) {
          db.prepare("INSERT OR IGNORE INTO lock_waiters (repo, participant) VALUES (?, ?)").run(me.repo, me.id);
          return { granted: false, holder: participantById(Number(r.participant)).name };
        }
        if (r && Number(r.participant) === me.id) {
          if (onto) db.prepare("UPDATE merge_locks SET onto = ? WHERE repo = ?").run(onto, me.repo);
          return { granted: true };
        }
        db.prepare("DELETE FROM lock_waiters WHERE repo = ?").run(me.repo);
        db.prepare("INSERT OR REPLACE INTO merge_locks (repo, participant, at, onto) VALUES (?, ?, ?, ?)").run(me.repo, me.id, now(), onto ?? null);
        bump(me.repo);
        return { granted: true };
      });
    },
    merged(me, sha, files) {
      const rels = [...new Set(files.map((f) => relPath(me.repo, f)).filter((x) => x !== null))];
      const wanted = new Set(rels);
      const told = /* @__PURE__ */ new Set();
      const iface = /* @__PURE__ */ new Set();
      const sharers = [];
      let waiters = [];
      let onto = null;
      transaction(() => {
        transaction(() => {
          const lock = db.prepare("SELECT participant, onto FROM merge_locks WHERE repo = ?").get(me.repo);
          if (lock && Number(lock.participant) !== me.id && isLive(Number(lock.participant))) {
            throw new Error(`the merge lock is held by ${participantById(Number(lock.participant)).name}, not ${me.name}`);
          }
          if (lock && Number(lock.participant) === me.id && lock.onto != null) onto = String(lock.onto);
          db.prepare("DELETE FROM merge_locks WHERE repo = ?").run(me.repo);
          db.prepare("UPDATE participants SET merged = 1 WHERE id = ?").run(me.id);
          waiters = takeLockWaiters(me.repo).filter((n) => n !== me.name);
        });
        for (const rel of rels) {
          for (const c of holdersOf(me.repo, rel)) {
            if (c.kind === "interface") iface.add(rel);
            if (c.participant !== me.id) told.add(participantById(c.participant).name);
          }
        }
        const everyone = db.prepare("SELECT p.id, p.slice, r.plan FROM participants p JOIN runs r ON r.id = p.run WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL").all(me.repo);
        for (const o of everyone) {
          for (const f of declared(Number(o.id))) {
            const rel = relPath(me.repo, f.path);
            if (!rel || !wanted.has(rel)) continue;
            if (f.interface) iface.add(rel);
            if (Number(o.id) !== me.id) told.add(`${o.plan}/${o.slice}`);
          }
        }
        const openPlans = db.prepare("SELECT DISTINCT plan, kind FROM runs WHERE repo = ? AND state = 'open'").all(me.repo).filter((r) => profileOf(String(r.kind)).claims).map((r) => String(r.plan));
        const all = iface.size ? openPlans.map((plan) => `${plan}/*`) : [];
        const lines = [`merged ${sha}${onto ? ` into ${onto}` : ""}: rebase your branch onto it.`];
        if (told.size) lines.push(`${[...told].map((n) => `@${n}`).join(" ")}: you hold or declared a file it changed.`);
        if (iface.size) lines.push(`@swarm interface changed: ${[...iface].join(", ")}.`);
        if (waiters.length) lines.push(`the merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`);
        lines.push(`files: ${rels.join(", ") || "-"}`);
        for (const rel of rels) {
          const ids = new Set(holdersOf(me.repo, rel).map((c) => c.participant));
          const held = db.prepare("SELECT l.participant FROM claim_log l JOIN participants p ON p.id = l.participant WHERE l.repo = ? AND l.path = ? AND p.run = ? ORDER BY l.rowid").all(me.repo, rel, me.run);
          for (const r of held) ids.add(Number(r.participant));
          ids.delete(me.id);
          for (const id of ids) sharers.push({ path: rel, runner: participantById(id).name });
        }
        const meta = { rebase: [...told], tell: [...new Set(sharers.map((o) => o.runner))] };
        insertMessage(me, lines.join("\n"), null, "event", [.../* @__PURE__ */ new Set([...told, ...waiters, ...all])], { event: EVENTS.merged.name, meta });
      });
      return sharers;
    }
  };
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
var RETENTION_DEFAULT_DAYS = 30;
var DAY_MS = 24 * 60 * 60 * 1e3;
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
    -- a claim refused as held: the post that settles it claims it (D7)
    CREATE TABLE IF NOT EXISTS claim_requests (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      kind TEXT NOT NULL,
      PRIMARY KEY (repo, path, participant)
    );
    -- a flag posted, once per writer, path and holder (D8)
    CREATE TABLE IF NOT EXISTS flag_posts (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      holder INTEGER NOT NULL,
      PRIMARY KEY (repo, path, participant, holder)
    );
    -- a version per repository, moved by every write: what onChange compares (D39)
    CREATE TABLE IF NOT EXISTS changes (
      repo TEXT PRIMARY KEY,
      version INTEGER NOT NULL
    );
    -- board settings (D32): retention-days
    CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
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
  upkeep("participants", "merged", "merged INTEGER NOT NULL DEFAULT 0");
  upkeep("messages", "by_board", "by_board INTEGER NOT NULL DEFAULT 0");
  upkeep("runs", "link", "link TEXT");
  upkeep("messages", "meta", "meta TEXT");
  upkeep("merge_locks", "onto", "onto TEXT");
  upkeep("slices", "link", "link TEXT");
  upkeep("runs", "kind", "kind TEXT NOT NULL DEFAULT 'plan'");
  upkeep("messages", "run", "run INTEGER");
  upkeep("messages", "endorses", "endorses INTEGER");
  upkeep("runs", "stale_flagged", "stale_flagged INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "quiet_flagged", "quiet_flagged INTEGER NOT NULL DEFAULT 0");
  upkeep("runs", "pruned_at", "pruned_at TEXT");
  upkeep("messages", "event", "event TEXT");
  upkeep("participants", "subs", "subs TEXT NOT NULL DEFAULT '[]'");
  upkeep("slices", "on_events", "on_events TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS messages_channel ON messages (repo, run, seq)");
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
  const runRow = (id) => {
    const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
    if (!r) throw new Error(`unknown run ${id}`);
    return r;
  };
  const toRun = (r) => ({
    id: Number(r.id),
    repo: String(r.repo),
    kind: profileOf(String(r.kind ?? "plan")).kind,
    plan: String(r.plan),
    group: String(r.plan),
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
  const nickOf = (r) => r.nick == null ? String(r.slice) : String(r.nick);
  const unusedNick = (repo) => {
    const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL`).all(repo);
    return funnyName(rows.map(nickOf));
  };
  const subsOf = (r) => JSON.parse(String(r.subs ?? "[]")).map((x) => ({ event: x.event, scope: x.scope === "run" ? "run" : "any" }));
  const PARTICIPANT_SQL = `SELECT p.*, r.repo, r.plan, r.kind FROM participants p JOIN runs r ON r.id = p.run`;
  const toParticipant = (r) => ({
    id: Number(r.id),
    run: Number(r.run),
    repo: String(r.repo),
    kind: profileOf(String(r.kind ?? "plan")).kind,
    plan: String(r.plan),
    slice: String(r.slice),
    name: `${r.plan}/${r.slice}`,
    nick: nickOf(r),
    ended: r.ended_at != null,
    worktree: r.worktree == null ? null : String(r.worktree),
    listening: Number(r.listening) === 1,
    subscriptions: subsOf(r)
  });
  const participantById = (id) => toParticipant(db.prepare(`${PARTICIPANT_SQL} WHERE p.id = ?`).get(id));
  const toMessage = (r) => {
    const author = participantById(Number(r.author));
    return {
      seq: Number(r.seq),
      repo: String(r.repo),
      from: author.name,
      body: String(r.body),
      about: r.about == null ? null : String(r.about),
      kind: String(r.kind),
      mentions: JSON.parse(String(r.mentions)),
      at: String(r.at),
      // an old main row (null) is labelled with its author's run (plan D13)
      run: r.run == null ? author.run : Number(r.run),
      endorses: r.endorses == null ? null : Number(r.endorses),
      event: r.event == null || !Object.hasOwn(EVENTS, String(r.event)) ? null : String(r.event),
      meta: r.meta == null ? null : JSON.parse(String(r.meta))
    };
  };
  const lastSeq = () => Number(db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM messages").get().s);
  const openPlans = (repo) => db.prepare("SELECT DISTINCT plan FROM runs WHERE repo = ? AND state = 'open'").all(repo).map((r) => String(r.plan));
  const activeNames = (repo) => {
    const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL AND p.slice != '${ORCHESTRATOR}'`).all(repo);
    return new Map(rows.map((r) => [nameHandle(nickOf(r)), `${r.plan}/${r.slice}`]));
  };
  const insertMessage = (p, body, about, kind, named, extra = {}) => {
    const mentions2 = named ?? (kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo), activeNames(p.repo)));
    const run2 = p.run;
    if (runRow(run2).state === "closed") throw new Error(`run ${run2} is closed`);
    const r = db.prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at, by_board, run, endorses, event, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(p.repo, p.id, body, about, kind, JSON.stringify(mentions2), now(), named ? 1 : 0, run2, extra.endorses ?? null, extra.event ?? null, extra.meta ? JSON.stringify(extra.meta) : null);
    const seq = Number(r.lastInsertRowid);
    bump(p.repo);
    return board.read(seq);
  };
  const gated = (p, verb) => {
    if (!profileOf(p.kind).claims) throw new Error(`${verb}: a ${p.kind} run has no claims`);
    return p;
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
  const doingOf = (id) => String(db.prepare("SELECT doing FROM participants WHERE id = ?").get(id).doing) || "no note";
  const claims = claimsOf({ db, transaction, bump, now, lastSeq, participantById, isLive, insertMessage, relPath, fold, slashes, doingOf });
  const deliverTo = (p, fromWait, mentionsOnly = false) => {
    const me = participantById(p.id);
    const named = (m) => mentions(m, me) || (m.kind === "agreement" || m.kind === "endorsement") && m.about != null && claims.holds(me, m.about);
    const messages = transaction(() => {
      const unseen = db.prepare(
        `SELECT m.* FROM messages m
           WHERE m.repo = ? AND m.seq > ? AND m.author != ?
             AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.participant = ? AND d.seq = m.seq)
           ORDER BY m.seq`
      ).all(me.repo, Number(db.prepare("SELECT since_seq FROM participants WHERE id = ?").get(me.id).since_seq), me.id, me.id);
      const woken = (r) => named(toMessage(r)) || wakes(toMessage(r), me, me.subscriptions);
      const heard = unseen.filter((r) => toMessage(r).run === me.run || woken(r));
      const rows = mentionsOnly ? heard.filter(woken) : heard;
      const mark = db.prepare("INSERT INTO deliveries (participant, seq) VALUES (?, ?)");
      for (const r of rows) mark.run(me.id, Number(r.seq));
      db.prepare("UPDATE participants SET last_call = ? WHERE id = ?").run(now(), me.id);
      if (!fromWait) {
        const r = db.prepare("UPDATE participants SET waiting = 0 WHERE id = ? AND waiting = 1").run(me.id);
        if (Number(r.changes) > 0) bump(me.repo);
      }
      return rows.map((r) => {
        const m = toMessage(r);
        const rel = r.by_board || m.kind !== "msg" || !m.about || !named(m) ? null : claims.askedAbout(me, Number(r.author), m);
        return rel ? { ...m, answer: `answer with an agreement on who changes what: swarm agree "<who changes what in ${rel}>" --about ${rel}` } : m;
      });
    });
    const full = (m) => named(m) || mentionsOnly && wakes(m, me, me.subscriptions);
    return {
      full: messages.filter(full),
      lines: messages.filter((m) => !full(m)).map(messageLine)
    };
  };
  const retentionDays = () => {
    const r = db.prepare("SELECT value FROM settings WHERE name = 'retention-days'").get();
    return r ? Number(r.value) : RETENTION_DEFAULT_DAYS;
  };
  const retentionCutoff = (at) => new Date(at.getTime() - retentionDays() * DAY_MS).toISOString();
  const listedRuns = () => db.prepare("SELECT * FROM runs WHERE pruned_at IS NULL AND (state = 'open' OR (state = 'closed' AND closed_at >= ?)) ORDER BY id").all(retentionCutoff(/* @__PURE__ */ new Date()));
  const runSummary = (r) => {
    const id = Number(r.id);
    const count = (sql) => Number(db.prepare(sql).get(id).n);
    const open = r.state === "open";
    return {
      run: id,
      kind: profileOf(String(r.kind ?? "plan")).kind,
      plan: String(r.plan),
      group: String(r.plan),
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
  const insertSlice = (run2, s, ord) => {
    if (s.on) parseSubscriptions(s.on);
    db.prepare("INSERT INTO slices (run, id, title, blockers, link, ord, on_events) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      run2,
      s.id,
      s.title,
      JSON.stringify(s.blockers ?? []),
      s.link ?? null,
      ord,
      s.on ? JSON.stringify(s.on) : null
    );
  };
  const setSubs = (p, subs) => {
    db.prepare("UPDATE participants SET subs = ? WHERE id = ?").run(JSON.stringify(subs), p.id);
    bump(p.repo);
    return subs;
  };
  const sameSub = (a, b) => a.event === b.event && a.scope === b.scope;
  const board = {
    openRun({ repo, kind = "plan", group, title, link, seats }) {
      const profile = profileOf(kind);
      const id = transaction(() => {
        const r = db.prepare("INSERT INTO runs (repo, kind, plan, title, link, opened_at) VALUES (?, ?, ?, ?, ?, ?)").run(repo, profile.kind, group, title, link ?? null, now());
        const run2 = Number(r.lastInsertRowid);
        seats.forEach((s, i) => insertSlice(run2, s, i));
        const orchestrator = db.prepare("INSERT INTO participants (run, slice, since_seq, joined_at, subs, nick) VALUES (?, ?, ?, ?, ?, ?)").run(
          run2,
          ORCHESTRATOR,
          lastSeq(),
          now(),
          JSON.stringify(profile.defaults.orchestrator),
          unusedNick(repo)
        );
        insertMessage(participantById(Number(orchestrator.lastInsertRowid)), `run ${run2} opened: ${profile.kind} ${group}, ${title}`, null, "event", void 0, {
          event: EVENTS.opened.name
        });
        bump(repo);
        return run2;
      });
      return toRun(runRow(id));
    },
    setSliceState(run2, slice, state) {
      runRow(run2);
      if (!SLICE_STATES.has(state)) throw new Error(`unknown slice state ${state}`);
      transaction(() => {
        const r = db.prepare("UPDATE slices SET state = ? WHERE run = ? AND id = ?").run(state, run2, slice);
        if (Number(r.changes) === 0) throw new Error(`unknown slice ${slice} in run ${run2}`);
        bump(String(runRow(run2).repo));
        if (state !== "done") return;
        const p = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run2, slice);
        if (p) claims.releaseAll(Number(p.id));
      });
    },
    addSlice(run2, spec) {
      const r = runRow(run2);
      if (r.state !== "open") throw new Error(`run ${run2} is closed`);
      if (spec.id === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      return transaction(() => {
        const ids = db.prepare("SELECT id FROM slices WHERE run = ?").all(run2).map((x) => String(x.id));
        if (ids.includes(spec.id)) throw new Error(`slice ${spec.id} is already in run ${run2}`);
        const unknown = (spec.blockers ?? []).filter((b) => !ids.includes(b));
        if (unknown.length) throw new Error(`unknown blocker ${unknown.join(", ")} in run ${run2}`);
        const ord = Number(db.prepare("SELECT COALESCE(MAX(ord), -1) AS o FROM slices WHERE run = ?").get(run2).o) + 1;
        insertSlice(run2, spec, ord);
        const orchestrator = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run2, ORCHESTRATOR);
        insertMessage(participantById(Number(orchestrator.id)), `added ${spec.id}: ${spec.title}`, null, "event");
        return toRun(runRow(run2)).slices.find((x) => x.id === spec.id);
      });
    },
    closeRun(run2) {
      runRow(run2);
      transaction(() => {
        const author = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run2, ORCHESTRATOR) ?? db.prepare("SELECT id FROM participants WHERE run = ? ORDER BY id LIMIT 1").get(run2);
        if (author) insertMessage(participantById(Number(author.id)), `run ${run2} closed`, null, "event", void 0, { event: EVENTS.closed.name });
        db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run2);
        bump(String(runRow(run2).repo));
        db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run2);
        for (const p of db.prepare("SELECT id FROM participants WHERE run = ?").all(run2)) claims.releaseAll(Number(p.id));
      });
    },
    prune(at = /* @__PURE__ */ new Date()) {
      return transaction(() => {
        const cutoff = retentionCutoff(at);
        const expired = db.prepare("SELECT id, repo FROM runs WHERE state = 'closed' AND closed_at < ? AND pruned_at IS NULL").all(cutoff);
        const touched = new Set(expired.map((r) => String(r.repo)));
        const runIds = expired.map((r) => Number(r.id));
        const inExpired = runIds.length ? `run IN (${runIds.join(", ")})` : "0";
        const doomed = db.prepare(
          `SELECT seq, repo FROM messages WHERE ${inExpired}
               OR (run IS NULL AND at < ? AND kind != 'agreement'
                   AND NOT (kind = 'endorsement' AND endorses IN (SELECT seq FROM messages WHERE run IS NULL AND kind = 'agreement')))`
        ).all(cutoff);
        const dropDeliveries = db.prepare("DELETE FROM deliveries WHERE seq = ?");
        const dropMessage = db.prepare("DELETE FROM messages WHERE seq = ?");
        for (const m of doomed) {
          dropDeliveries.run(Number(m.seq));
          dropMessage.run(Number(m.seq));
          touched.add(String(m.repo));
        }
        for (const run2 of runIds) {
          for (const r of db.prepare("SELECT id FROM participants WHERE run = ?").all(run2)) {
            const id = Number(r.id);
            for (const table of ["claim_log", "notices", "flags", "claims", "lock_waiters", "merge_locks", "deliveries", "claim_requests", "flag_posts"]) {
              db.prepare(`DELETE FROM ${table} WHERE participant = ?`).run(id);
            }
            db.prepare("DELETE FROM notices WHERE other = ?").run(id);
            if (!db.prepare("SELECT 1 FROM messages WHERE author = ? LIMIT 1").get(id)) db.prepare("DELETE FROM participants WHERE id = ?").run(id);
          }
          db.prepare("DELETE FROM slices WHERE run = ?").run(run2);
          db.prepare("UPDATE runs SET pruned_at = ? WHERE id = ?").run(at.toISOString(), run2);
        }
        for (const repo of touched) bump(repo);
        return { messages: doomed.length, runs: runIds.length };
      });
    },
    setting(name, value) {
      if (name !== "retention-days") throw new Error(`unknown setting ${name}`);
      if (value !== void 0) {
        if (!Number.isInteger(value) || value < 1) throw new Error(`${name} takes a positive whole number of days, got ${value}`);
        db.prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").run(name, String(value));
      }
      return retentionDays();
    },
    flagStale(at = /* @__PURE__ */ new Date()) {
      const silentBefore = at.getTime() - STALE_MS;
      return transaction(() => {
        const quiet = db.prepare("SELECT p.id, p.last_call, p.joined_at FROM participants p JOIN runs r ON r.id = p.run WHERE r.state = 'open' AND p.slice = ? AND p.ended_at IS NULL AND p.quiet_flagged = 0").all(ORCHESTRATOR);
        for (const o of quiet) {
          const silentSince = Date.parse(String(o.last_call ?? o.joined_at));
          if (silentSince >= silentBefore) continue;
          const minutes = Math.floor((at.getTime() - silentSince) / 6e4);
          insertMessage(participantById(Number(o.id)), `quiet ${minutes} min`, null, "event", [], { event: EVENTS.quiet.name });
          db.prepare("UPDATE participants SET quiet_flagged = 1 WHERE id = ?").run(Number(o.id));
        }
        const flagged = [];
        for (const r of db.prepare("SELECT id, plan FROM runs WHERE state = 'open' AND stale_flagged = 0 ORDER BY id").all()) {
          const id = Number(r.id);
          const members = db.prepare("SELECT id, slice, last_call, joined_at FROM participants WHERE run = ? AND ended_at IS NULL").all(id);
          if (!members.length || members.some((m) => Date.parse(String(m.last_call ?? m.joined_at)) >= silentBefore)) continue;
          const author = members.find((m) => String(m.slice) === ORCHESTRATOR) ?? members[0];
          const group = String(r.plan);
          insertMessage(participantById(Number(author.id)), `run ${id} (${group}) is stale: every member silent; close it or dispatch again`, null, "event", [`${group}/${ORCHESTRATOR}`], {
            event: EVENTS.stale.name
          });
          db.prepare("UPDATE runs SET stale_flagged = 1 WHERE id = ?").run(id);
          flagged.push(id);
        }
        return flagged;
      });
    },
    runs() {
      return db.prepare("SELECT * FROM runs WHERE state = 'open' ORDER BY id").all().map(toRun);
    },
    join({ run: run2, slice, doing, files, worktree, on }) {
      const r = runRow(run2);
      if (r.state !== "open") throw new Error(`run ${run2} is closed`);
      if (slice === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      const profile = profileOf(String(r.kind ?? "plan"));
      if (files.length && !profile.claims) throw new Error(`join: a ${profile.kind} run has no claims`);
      const where = worktree && profile.worktree ? path2.resolve(worktree) : null;
      return transaction(() => {
        const id = transaction(() => {
          const existing = db.prepare("SELECT id, nick FROM participants WHERE run = ? AND slice = ?").get(run2, slice);
          const seatRow = db.prepare("SELECT on_events FROM slices WHERE run = ? AND id = ?").get(run2, slice);
          const seatOn = seatRow?.on_events != null ? parseSubscriptions(JSON.parse(String(seatRow.on_events))) : null;
          const subs = JSON.stringify(on ?? seatOn ?? profile.defaults.member);
          const fresh = () => unusedNick(String(r.repo));
          if (existing) {
            db.prepare("UPDATE participants SET doing = ?, files = ?, worktree = ?, ended_at = NULL, merged = 0, subs = ?, nick = COALESCE(nick, ?) WHERE id = ?").run(
              doing,
              JSON.stringify(files),
              where,
              subs,
              existing.nick == null ? fresh() : null,
              Number(existing.id)
            );
            return Number(existing.id);
          }
          const ins = db.prepare("INSERT INTO participants (run, slice, worktree, doing, files, since_seq, joined_at, nick, subs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(run2, slice, where, doing, JSON.stringify(files), lastSeq(), now(), fresh(), subs);
          return Number(ins.lastInsertRowid);
        });
        const runner = participantById(id);
        claims.claimDeclared(runner, files);
        insertMessage(runner, `joined: ${doing}`, null, "event", void 0, { event: EVENTS.joined.name });
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
    subscribe(p, subs) {
      const fresh = live(p);
      return setSubs(fresh, [...fresh.subscriptions, ...subs.filter((s) => !fresh.subscriptions.some((o) => sameSub(o, s)))]);
    },
    unsubscribe(p, subs) {
      const fresh = live(p);
      return setSubs(fresh, fresh.subscriptions.filter((o) => !subs.some((s) => sameSub(o, s))));
    },
    end(p) {
      const fresh = live(p);
      transaction(() => {
        const waiters = claims.lockWaitersFreedBy(fresh);
        const ended = { event: EVENTS.ended.name };
        if (waiters.length) insertMessage(fresh, `ended
the merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`, null, "event", waiters, ended);
        else insertMessage(fresh, "ended", null, "event", void 0, ended);
        db.prepare("UPDATE participants SET ended_at = ?, doing = CASE merged WHEN 1 THEN 'merged and ended' ELSE 'ended' END WHERE id = ?").run(now(), fresh.id);
        claims.releaseAll(fresh.id);
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
        stale: Date.parse(String(r.last_call ?? r.joined_at)) < cutoff,
        subscriptions: subsOf(r),
        worktree: r.worktree == null ? null : String(r.worktree)
      }));
    },
    post(p, body, opts = {}) {
      const fresh = live(p);
      const m = insertMessage(fresh, body, opts.about ?? null, opts.kind ?? "msg");
      const claimed = profileOf(fresh.kind).claims ? claims.claimByPost(fresh, m) : null;
      return claimed ? { ...m, claimed } : m;
    },
    endorse(p, seq) {
      const fresh = live(p);
      const r = db.prepare("SELECT * FROM messages WHERE seq = ?").get(seq);
      if (!r) throw new Error(`unknown message #${seq}`);
      if (r.kind !== "agreement") throw new Error(`#${seq} is not an agreement`);
      if (Number(r.author) === fresh.id) throw new Error(`#${seq} is your own agreement`);
      const author = participantById(Number(r.author));
      const about = r.about == null ? null : String(r.about);
      return insertMessage(fresh, `endorses #${seq}`, about, "endorsement", [author.name], { endorses: seq });
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
      return claims.checkEdit(gated(live(p), "claim"), file, opts);
    },
    reconcileWrites(p, changed) {
      return claims.reconcileWrites(gated(live(p), "reconcile"), changed);
    },
    release(p, file) {
      claims.release(gated(live(p), "release"), file);
    },
    lockMerge(p, onto) {
      return claims.lockMerge(gated(live(p), "merge-lock"), onto);
    },
    merged(p, sha, files) {
      return claims.merged(gated(live(p), "merged"), sha, files);
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
      const claimsOf2 = db.prepare("SELECT path, kind FROM claims WHERE participant = ? ORDER BY rowid");
      const live2 = db.prepare("SELECT c.path, c.kind, c.participant, p.slice, r.plan FROM claims c JOIN participants p ON p.id = c.participant JOIN runs r ON r.id = p.run WHERE c.repo = ? ORDER BY c.rowid").all(repo).filter((c) => isLive(Number(c.participant)));
      const files = /* @__PURE__ */ new Map();
      for (const c of live2) {
        const f = files.get(String(c.path)) ?? { path: String(c.path), holders: [], interface: false };
        f.holders.push(`${c.plan}/${c.slice}`);
        f.interface ||= c.kind === "interface";
        files.set(f.path, f);
      }
      const everClaimed = db.prepare("SELECT 1 FROM claim_log WHERE repo = ? AND path = ? AND participant = ?");
      for (const r of people) {
        if (String(r.slice) === ORCHESTRATOR || !isLive(Number(r.id))) continue;
        const name = `${r.plan}/${r.slice}`;
        for (const d of JSON.parse(String(r.files))) {
          const f = files.get(relPath(repo, d.path) ?? d.path);
          if (f && !f.holders.includes(name) && !everClaimed.get(repo, f.path, Number(r.id))) f.holders.push(name);
        }
      }
      const sharedBy = (path7, id) => live2.some((c) => String(c.path) === path7 && Number(c.participant) !== id);
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
          files: claimsOf2.all(id).map((c) => ({ path: String(c.path), interface: c.kind === "interface", shared: sharedBy(String(c.path), id) })),
          joined: String(r.joined_at),
          ended: r.ended_at == null ? null : String(r.ended_at),
          calls: Number(r.calls ?? 0),
          listening: !ended && Number(r.listening) === 1,
          on: subsOf(r).map((x) => formatSubscriptions([x])),
          lastCall: String(r.last_call ?? r.joined_at)
        };
      });
      const events = db.prepare("SELECT * FROM (SELECT * FROM messages WHERE repo = ? ORDER BY seq DESC LIMIT ?) ORDER BY seq").all(repo, EVENTS_SHOWN).map((r) => {
        const m = toMessage(r);
        return {
          seq: m.seq,
          at: m.at,
          kind: m.kind,
          from: m.from,
          body: m.body,
          about: m.about,
          run: m.run,
          channel: m.run,
          event: m.event,
          mentions: m.mentions,
          meta: m.meta ?? null
        };
      });
      const nameOf = new Map(people.map((r) => [`${r.run}/${r.slice}`, `${r.plan}/${r.slice}`]));
      const queues = {};
      for (const run2 of runRows) {
        queues[String(run2.plan)] = sliceRows.filter((s) => Number(s.run) === Number(run2.id)).map((s) => ({
          slice: String(s.id),
          title: String(s.title),
          link: s.link == null ? null : String(s.link),
          state: String(s.state),
          blockers: JSON.parse(String(s.blockers)),
          runner: nameOf.get(`${run2.id}/${s.id}`) ?? null
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
  const countCall = (p) => {
    db.prepare("UPDATE participants SET calls = calls + 1, last_call = ? WHERE id = ?").run(now(), p.id);
    db.prepare("UPDATE runs SET stale_flagged = 0 WHERE id = ? AND stale_flagged = 1").run(p.run);
    if (Number(db.prepare("UPDATE participants SET quiet_flagged = 0 WHERE id = ? AND quiet_flagged = 1").run(p.id).changes) > 0 && runRow(p.run).state === "open")
      insertMessage(participantById(p.id), "back", null, "event", [], { event: EVENTS.back.name });
    bump(participantById(p.id).repo);
  };
  const counted = (verb) => (p, ...rest) => transaction(() => {
    const out = verb(p, ...rest);
    countCall(p);
    return out;
  });
  board.setDoing = counted(board.setDoing);
  board.subscribe = counted(board.subscribe);
  board.unsubscribe = counted(board.unsubscribe);
  board.end = counted(board.end);
  board.post = counted(board.post);
  board.endorse = counted(board.endorse);
  board.deliver = counted(board.deliver);
  board.wait = counted(board.wait);
  board.checkEdit = counted(board.checkEdit);
  board.release = counted(board.release);
  board.lockMerge = counted(board.lockMerge);
  board.merged = counted(board.merged);
  const read = board.read;
  board.read = (seq, by) => {
    const m = read(seq);
    if (by) transaction(() => countCall(by));
    return m;
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
  "--onto",
  "--kind",
  "--group",
  "--seats",
  "--seat",
  "--on",
  "--blockers",
  "--role",
  "--link"
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
var seqLine = (m) => `#${m.seq}`;
var fullText = (m) => {
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}  ${m.at}
${m.body}${m.answer ? `
${m.answer}` : ""}`;
};

// src/cli/aiview-document.ts
import { spawnSync } from "node:child_process";
import fs3 from "node:fs";
import path4 from "node:path";
function aiviewLauncher(toolRoot2) {
  const file = process.env.SWARM_AIVIEW ?? path4.join(toolRoot2, "..", "aiview", "aiview.mjs");
  return fs3.existsSync(file) ? file : null;
}
var callAiview = (launcher, cwd, argv) => {
  const r = spawnSync(process.execPath, [launcher, ...argv, "--json"], { cwd, encoding: "utf8" });
  if (r.status !== 0) return { ok: false, error: `aiview ${argv[0]} failed: ${(r.stderr || r.stdout).trim()}` };
  try {
    return { ok: true, out: JSON.parse(r.stdout.trim().split("\n").pop() ?? "") };
  } catch {
    return { ok: false, error: `aiview ${argv[0]}: unreadable output ${r.stdout.trim()}` };
  }
};
var BOARD_DOCUMENT_FILE = "swarm.swarm.json";
var boardUrlFor = (pageUrl2, repos) => {
  const url = new URL(pageUrl2);
  url.search = "";
  for (const repo of repos) url.searchParams.append("repo", repo);
  return url.toString();
};
var reposInUrl = (url) => {
  try {
    return new URL(url).searchParams.getAll("repo");
  } catch {
    return [];
  }
};
function registerBoardDocument(input) {
  const launcher = aiviewLauncher(input.toolRoot);
  if (!launcher) return { registered: false, reason: "aiview not found" };
  const aiview = (argv) => callAiview(launcher, input.cwd, argv);
  const status = aiview(["status"]);
  if (!status.ok) return { registered: false, reason: status.error };
  const project = status.out.cwdProject;
  if (!project) return { registered: false, reason: `no aiview project for ${input.cwd}` };
  const where = aiview(["path", BOARD_DOCUMENT_FILE, "--project", project]);
  if (!where.ok) return { registered: false, reason: where.error };
  const file = where.out.path;
  const existing = readBoardUrl(file);
  const repos = existing === null ? [] : reposInUrl(existing);
  if (existing === null || !repos.includes(input.repo)) {
    fs3.mkdirSync(path4.dirname(file), { recursive: true });
    fs3.writeFileSync(file, JSON.stringify({ url: boardUrlFor(input.pageUrl, [...repos, input.repo]) }, null, 2) + "\n");
  }
  const opened = aiview(existing === null ? ["open", file, "--kind", "swarm"] : ["open", file]);
  if (!opened.ok) return { registered: false, reason: opened.error };
  const retired = retireOtherSwarmDocuments(aiview, project, file);
  if (!retired.ok) return { registered: false, reason: retired.error };
  return { registered: true, url: opened.out.url, file, retired: retired.files };
}
function readBoardUrl(file) {
  try {
    const url = JSON.parse(fs3.readFileSync(file, "utf8")).url;
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}
function retireOtherSwarmDocuments(aiview, project, board) {
  const listed = aiview(["list", "--kind", "swarm", "--project", project]);
  if (!listed.ok) return listed;
  const others = listed.out.filter((d) => path4.resolve(d.abs_path ?? d.file_path) !== path4.resolve(board));
  if (!others.length) return { ok: true, files: [] };
  const removed = aiview(["remove", ...others.map((d) => `#${d.id}`)]);
  if (!removed.ok) return removed;
  return { ok: true, files: others.map((d) => d.file_path) };
}

// src/cli/unclaimed.ts
var COLLAPSE_OVER = 20;
function unclaimedLines(paths) {
  const folderOf = (p) => p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".";
  const byFolder = /* @__PURE__ */ new Map();
  for (const p of paths) byFolder.set(folderOf(p), [...byFolder.get(folderOf(p)) ?? [], p]);
  const lines = [];
  const told = /* @__PURE__ */ new Set();
  for (const p of paths) {
    const folder = folderOf(p);
    const inFolder = byFolder.get(folder);
    if (inFolder.length <= COLLAPSE_OVER) lines.push(`reconciled ${p}`);
    else if (!told.has(folder)) {
      told.add(folder);
      lines.push(`${inFolder.length} files under ${folder}/ written unclaimed`);
    }
  }
  return lines;
}

// src/cli/index.ts
var args = parseArgs(process.argv.slice(2));
var asJson = args.has("--json");
var USAGE = [
  "usage: swarm <verb> [--json]        (swarm --help code: the claim and merge verbs)",
  "  open    --kind plan|brainstorm --group <slug> --title <t> --seats <file.json> [--link <url>]   # opens a run, registers the project's board in aiview, prints the run id then the board's URL (orchestrator)",
  "          # --plan <slug> --slices <file.json>: the same as --kind plan --group <slug> --seats <file.json>",
  '          # the seats file: [{"id", "title", "role"?, "blockers": [...], "link"?: "<URL>", "on"?: ["agreement", \u2026]}]',
  "  slice   <id> --run <id> --state ready|running|done|blocked      # (orchestrator)",
  "  slice   add <id> --run <id> --title <t> [--blockers a,b] [--link <url>] [--role <r>] [--on <events>]   # adds a slice or seat mid-run (orchestrator)",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --seat <id> --doing <t> [--files "<path>:interface,<path>:inside,\u2026"]   # --slice <id> the same; prints the roster, then the command that starts your listener',
  "          # --on <events>: what wakes your wait --mentions besides mentions and urgent posts, e.g. agreement,any:merged; else the seat row's on, else the kind's defaults",
  "  subscribe   [--as <member>] <events>                            # prints your subscriptions after",
  "  unsubscribe [--as <member>] <events>",
  "  doing   [--as <member>] <text>",
  "  post    [--as <member>] <body> [--about <path|decision id>]   # prints the seq",
  "  agree   [--as <member>] <terms> [--about <path|decision id>]  # prints the seq",
  "  endorse [--as <member>] <seq>                                   # backs an agreement; prints the endorsement's seq",
  "  read    <seq>",
  "  deliver [--as <member>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <member>] [--timeout <ms>] [--mentions]           # blocks until a message for you, then says how to re-arm; nothing on timeout or end; a newer wait supersedes it",
  "          # --mentions: only a mention of you, an urgent post or an event you subscribed to ends it; the rest stays for deliver",
  "  roster  [--repo <path>]",
  "  end     [--as <member>]                                         # claims or flags what you wrote unclaimed, then releases your claims and the lock",
  "  serve   [--port <p>] [--detach]                 # the run pages aiview frames, on :4322 (SWARM_PORT)",
  "  status                                                          # data home, the page's server, open runs",
  "  config  retention [<days>]                                      # prints, or sets then prints, how many days closed runs and main's talk are kept",
  `events: ${Object.keys(EVENTS).join(", ")}; any:<event> for one posted in any run`,
  "a member is <group>/<seat>, the orchestrator <group>/orchestrator; without --as, the runner joined from this worktree"
].join("\n");
var CODE_USAGE = [
  "usage: swarm <verb> [--json]        the code verbs; refused on a run whose kind has no claims",
  "  claim   [--as <runner>] <path> [--interface] [--new]            # before editing a file: exit 0 claimed, 3 held until you post about it (the post claims it); --new: a file you create",
  "  release [--as <runner>] <path>                                  # gives up a claim",
  "  merge-lock --onto <branch> [--as <runner>]                      # one merge at a time per repository; claims or flags what your branch wrote unclaimed",
  "  merged  [--as <runner>] <sha> --files <path>...                 # releases the lock, tells who must rebase and who was refused the lock, names whom to tell of a resolved conflict"
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
  const r = spawnSync2("git", argv, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
function repoOf(dir) {
  const common = git(dir, "rev-parse", "--git-common-dir");
  if (!common) fail(`not in a git repository: ${dir}`);
  const abs = path6.resolve(dir, common);
  try {
    return fs5.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
function worktreeOf(dir) {
  const top = git(dir, "rev-parse", "--show-toplevel");
  return top ? path6.resolve(top) : null;
}
function changedIn(worktree) {
  const r = spawnSync2("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: worktree, encoding: "utf8" });
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
  const r = spawnSync2("git", ["diff", "--name-only", "-z", "--no-renames", `${base}..HEAD`], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return fail(`git diff failed in ${worktree}: ${r.stderr.trim()}`);
  const committed = r.stdout.split("\0").filter(Boolean);
  return [.../* @__PURE__ */ new Set([...committed, ...changedIn(worktree)])];
}
var printReconciled = (reconciled, flags) => {
  for (const line of unclaimedLines(reconciled)) console.log(line);
  for (const f of flags) console.log(`#${f.seq} flagged: you wrote ${f.path} outside your claim; ${f.holder} holds it. Settle it with @${f.holder} on the thread.`);
};
function spawnDetachedServer(port) {
  try {
    fs5.rmSync(PORT_FILE, { force: true });
  } catch {
  }
  const child = spawn(process.execPath, [process.argv[1], "serve", "--port", String(port)], {
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
    spawnSync2(process.execPath, ["-e", "setTimeout(()=>{},120)"]);
  }
}
function ensureServer() {
  const st = readServerStatus();
  if (st.running && st.port !== null) return st.port;
  fs5.mkdirSync(DATA_ROOT, { recursive: true });
  return spawnDetachedServer(portFrom(args.flag("--port")));
}
var pageUrl = (port) => `http://localhost:${port}/`;
var toolRoot = () => process.env.SWARM_ROOT ?? path6.dirname(path6.resolve(process.argv[1]));
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
  const on = r.subscriptions.length ? `  on: ${formatSubscriptions(r.subscriptions)}` : "";
  return `${who}${r.stale ? " (stale)" : ""}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}${on}`;
};
var withNext = (me, d) => ({
  ...d,
  full: d.full.map((m) => {
    const e = eventOf(m);
    const line = e ? EVENTS[e].next?.(m, me, self().join(" ")) ?? null : null;
    return line ? { ...m, endorse: line } : m;
  })
});
var printDelivery = (d) => {
  for (const m of d.full) {
    console.log(fullText(m));
    if (m.endorse) console.log(m.endorse);
  }
  for (const l of d.lines) console.log(l);
};
var shellWord = (w) => /^[\w@%+=:,./-]+$/.test(w) ? w : `"${w.replace(/(["\\$`])/g, "\\$1")}"`;
var self = () => ["node", shellWord(process.argv[1].replace(/\\/g, "/"))];
var listenNow = (runner) => `start your listener now, in the background (your harness's background task): ${[...self(), "wait", "--mentions", "--as", shellWord(runner)].join(" ")}`;
var unmatchedLines = (board, p, body) => {
  const roster = board.roster(p.repo);
  const runners = roster.filter((r) => r.slice !== "orchestrator");
  const plans = [...new Set(roster.map((r) => r.plan))];
  const names = new Map(runners.map((r) => [nameHandle(r.nick), r.name]));
  const nickOf = new Map(runners.map((r) => [r.name, r.nick.replace(/\s+/g, "")]));
  return unmatchedMentions(body, p.plan, plans, names).map(({ name, closest }) => {
    const guesses = closest.map((c) => nickOf.has(c) ? `@${c} or @${nickOf.get(c)}` : `@${c}`);
    return `@${name} matched nobody on the board${guesses.length ? `: did you mean ${guesses.join(", ")}?` : ""}`;
  });
};
var emitHeard = (p, json, human) => {
  const next = !p.ended && !p.listening ? listenNow(p.name) : null;
  emit(next ? { ...json, next } : json, () => {
    if (typeof human === "string") console.log(human);
    else human();
    if (next) console.log(next);
  });
};
function resolveClaimPath(file) {
  if (path6.isAbsolute(file)) return file;
  const here = path6.resolve(file);
  if (fs5.existsSync(here)) return here;
  const root = worktreeOf(process.cwd());
  const fromRoot = root ? path6.resolve(root, file) : null;
  if (fromRoot && fs5.existsSync(fromRoot)) return fromRoot;
  if (args.has("--new")) return here;
  return fail(`no such file: ${here}${fromRoot && fromRoot !== here ? ` nor ${fromRoot}` : ""}; pass --new if you are creating it`);
}
function repoRelative(abs) {
  const root = worktreeOf(process.cwd());
  const rel = root ? path6.relative(root, abs) : abs;
  return rel.split(path6.sep).join("/");
}
function aboutArg() {
  const about = args.flag("--about");
  if (about === void 0 || !/[\\/]/.test(about)) return about;
  return repoRelative(resolveClaimPath(about));
}
function parseFile(spec) {
  const m = spec.match(/^(.*):(interface|inside)$/);
  const d = m ? { path: m[1], interface: m[2] === "interface" } : { path: spec, interface: false };
  return { ...d, path: repoRelative(resolveClaimPath(d.path)) };
}
function readSlices(file) {
  let raw;
  try {
    raw = JSON.parse(fs5.readFileSync(path6.resolve(file), "utf8"));
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
      ...typeof s.role === "string" && s.role ? { role: s.role } : {},
      blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [],
      link: typeof s.link === "string" && s.link ? s.link : null,
      ...Array.isArray(s.on) ? { on: s.on.map(String) } : {}
    };
  });
}
function boardUpkeep(board) {
  try {
    board.prune();
    board.flagStale();
  } catch (e) {
    console.error(`swarm: upkeep failed: ${e.message}`);
  }
}
var UPKEEP_EVERY_MS = 60 * 60 * 1e3;
function openKindAndGroup() {
  const raw = args.flag("--kind") ?? "plan";
  let kind;
  try {
    kind = profileOf(raw).kind;
  } catch (e) {
    return fail(`open: ${e.message}`);
  }
  const plan = args.flag("--plan");
  if (plan !== void 0 && kind !== "plan") fail(`open: --plan means --kind plan; a ${kind} run takes --group <slug>`);
  const group = args.flag("--group") ?? plan ?? fail(`open: --group <slug> is required (or --plan <slug> for a plan run)
${USAGE}`);
  return { kind, group };
}
function joinedSeat() {
  const seat = args.flag("--seat");
  const slice = args.flag("--slice");
  if (seat !== void 0 && slice !== void 0 && seat !== slice) fail(`join: --seat ${seat} and --slice ${slice} name different members; pass one`);
  return seat ?? slice ?? fail(`--seat (or --slice) is required
${USAGE}`);
}
var SEAT_POSTS_DRAW = "posts render markdown and mermaid: compare in a table, draw a flow as a mermaid block";
var seatCommands = (as) => {
  const cli = self().join(" ");
  const who = `--as ${shellWord(as)}`;
  return [
    `${cli} post "\u2026" --about <D id> ${who}`,
    `${cli} agree "\u2026" --about <D id> ${who}`,
    `${cli} endorse <seq> ${who}`,
    `${cli} wait --mentions ${who}    # in the foreground, when waiting`
  ];
};
var subscriptionsArg = (spec) => {
  try {
    return parseSubscriptions(spec);
  } catch (e) {
    return fail(e.message);
  }
};
var NO_MAIN = "there is no Main any more: the conversation is one; mention who you mean (@IW, @IW\xB7SL3, @swarm)";
async function main(board) {
  if ((args.verb === "post" || args.verb === "agree" || args.verb === "endorse") && args.has("--main")) {
    console.error(NO_MAIN);
    process.exitCode = 2;
    return;
  }
  switch (args.verb) {
    case "config": {
      const setting = args.positional[0];
      if (setting !== "retention") fail(`config: the one setting is retention
${USAGE}`);
      const raw = args.positional[1];
      const value = raw === void 0 ? void 0 : Number(raw);
      const days = board.setting("retention-days", value);
      emit({ retention: days }, String(days));
      break;
    }
    case "open": {
      boardUpkeep(board);
      const { kind, group } = openKindAndGroup();
      const plan = group;
      const seatsFile = args.flag("--seats") ?? args.flag("--slices") ?? fail(`open: --seats <file.json> is required (or --slices)
${USAGE}`);
      const run2 = board.openRun({ repo: repoOf(process.cwd()), kind, group, title: need("--title"), link: args.flag("--link") ?? null, seats: readSlices(seatsFile) });
      const port = ensureServer();
      const page = port === null ? null : pageUrl(port);
      if (page === null) {
        console.error(`swarm: the page did not start (port ${portFrom(args.flag("--port"))} may be in use; swarm serve --detach --port <n>). The run is open.`);
        emit({ run: run2.id, repo: run2.repo, kind: run2.kind, group: run2.group, plan: run2.plan, url: null }, String(run2.id));
        break;
      }
      const doc = registerBoardDocument({ toolRoot: toolRoot(), cwd: process.cwd(), repo: run2.repo, pageUrl: page });
      if (!doc.registered) console.error(`swarm: ${doc.reason}: open the URL`);
      const url = doc.registered ? doc.url : boardUrlFor(page, [run2.repo]);
      emit({ run: run2.id, repo: run2.repo, kind: run2.kind, group: run2.group, plan: run2.plan, url }, `${run2.id}
${url}`);
      break;
    }
    case "slice": {
      if (args.positional[0] === "add") {
        const id2 = args.positional[1] ?? fail(`slice add: which id?
${USAGE}`);
        const run3 = runArg();
        const on = args.flag("--on");
        if (on !== void 0) subscriptionsArg(on);
        const role = args.flag("--role");
        const added = board.addSlice(run3, {
          id: id2,
          title: need("--title"),
          ...role ? { role } : {},
          blockers: args.list("--blockers"),
          link: args.flag("--link") ?? null,
          ...on !== void 0 ? { on: on.split(",").map((x) => x.trim()).filter(Boolean) } : {}
        });
        emit({ run: run3, slice: added }, `${id2} added`);
        break;
      }
      const id = args.positional[0] ?? fail(`slice: which slice?
${USAGE}`);
      const run2 = runArg();
      const state = need("--state");
      board.setSliceState(run2, id, state);
      emit({ run: run2, slice: id, state }, `${id} ${state}`);
      break;
    }
    case "close": {
      const run2 = runArg();
      board.closeRun(run2);
      emit({ run: run2, state: "closed" }, `run ${run2} closed`);
      break;
    }
    case "join": {
      const { runner, roster } = board.join({
        run: runArg(),
        slice: joinedSeat(),
        doing: need("--doing"),
        files: [...args.list("--files"), ...args.flags("--file")].map(parseFile),
        worktree: worktreeOf(process.cwd()) ?? void 0,
        ...args.flag("--on") !== void 0 ? { on: subscriptionsArg(args.flag("--on")) } : {}
      });
      const next = listenNow(runner.name);
      const shared = !profileOf(runner.kind).worktree;
      const as = shared ? `pass --as ${runner.name} on every call: this checkout is shared, the board cannot tell you apart` : null;
      const commands = shared ? seatCommands(runner.name) : null;
      const drawing = profileOf(runner.kind).member === "seat" ? SEAT_POSTS_DRAW : null;
      emit({ runner: runner.name, nick: runner.nick, roster, ...shared ? { as: runner.name, commands } : {}, ...drawing ? { drawing } : {}, next }, () => {
        console.log(`you are ${runner.name}, ${runner.nick}: @${runner.slice} or @${runner.nick.replace(/\s+/g, "")} mentions you`);
        for (const r of roster) console.log(rosterLine(r));
        if (as) console.log(as);
        for (const c of commands ?? []) console.log(c);
        if (drawing) console.log(drawing);
        console.log(next);
      });
      break;
    }
    case "subscribe":
    case "unsubscribe": {
      const p = caller(board);
      const subs = subscriptionsArg(args.positional.join(",") || fail(`${args.verb}: which events?`));
      const after = args.verb === "subscribe" ? board.subscribe(p, subs) : board.unsubscribe(p, subs);
      emitHeard(p, { runner: p.name, subscriptions: after }, `${p.name} wakes on: ${formatSubscriptions(after) || "mentions and urgent posts only"}`);
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
      const m = board.post(p, body, {
        about: aboutArg(),
        kind: args.verb === "agree" ? "agreement" : "msg"
      });
      const unmatched = unmatchedLines(board, p, body);
      emitHeard(p, { seq: m.seq, mentions: m.mentions, run: m.run, ...unmatched.length ? { unmatched } : {}, ...m.claimed ? { claimed: m.claimed } : {} }, () => {
        console.log(seqLine(m));
        if (m.claimed) console.log(`claimed ${m.claimed.path}, shared with ${m.claimed.sharedWith.join(", ")}`);
        for (const line of unmatched) console.log(line);
      });
      break;
    }
    case "endorse": {
      const p = caller(board);
      const raw = (args.positional[0] ?? fail("endorse: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`endorse takes a seq, got ${raw}`);
      const m = board.endorse(p, seq);
      emitHeard(p, { seq: m.seq, endorses: m.endorses, run: m.run }, seqLine(m));
      break;
    }
    case "read": {
      const raw = (args.positional[0] ?? fail("read: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`read takes a seq, got ${raw}`);
      let by;
      try {
        by = caller(board);
      } catch (e) {
        if (!(e instanceof CliError)) throw e;
      }
      const m = board.read(seq, by);
      emit(m, fullText(m));
      break;
    }
    case "deliver": {
      const me = caller(board);
      const d = withNext(me, board.deliver(me));
      emit(d, () => printDelivery(d));
      break;
    }
    case "wait": {
      const p = caller(board);
      const raw = args.flag("--timeout");
      const timeout = raw === void 0 ? void 0 : Number(raw);
      if (timeout !== void 0 && !(timeout >= 0)) fail(`--timeout takes milliseconds, got ${raw}`);
      const mentionsOnly = args.has("--mentions");
      const d = withNext(p, await board.wait(p, { timeoutMs: timeout, mentionsOnly }));
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
      const repo = repoOf(path6.resolve(args.flag("--repo") ?? process.cwd()));
      const roster = board.roster(repo);
      emit({ repo, roster }, () => {
        for (const r of roster) console.log(rosterLine(r));
      });
      break;
    }
    case "claim": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("claim: which path?");
      const abs = resolveClaimPath(file);
      const rel = repoRelative(abs);
      const verdict = board.checkEdit(p, abs, { interface: args.has("--interface") });
      if (!verdict.allowed) process.exitCode = 3;
      emitHeard(p, verdict, () => {
        if (!verdict.allowed) return console.log(verdict.refusal);
        const also = verdict.notice ? verdict.sharedWith.map((o) => `${o.runner} \xB7 ${board.participant(o.runner)?.nick ?? "?"}: ${o.doing}`).join("; ") : "";
        console.log(also ? `claimed ${rel}, also held by ${also}` : `claimed ${rel}`);
      });
      break;
    }
    case "release": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("release: which path?");
      const abs = resolveClaimPath(file);
      board.release(p, abs);
      emit({ runner: p.name, released: repoRelative(abs) }, `${p.name} released ${repoRelative(abs)}`);
      break;
    }
    case "merge-lock": {
      const p = caller(board);
      const onto = need("--onto");
      const reconciled = p.worktree ? branchChangedIn(p.worktree, onto) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      const r = board.lockMerge(p, onto);
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
      const sharers = board.merged(p, sha, files.map((f) => path6.resolve(f)));
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
      const membersOf = (r) => board.roster(r.repo).filter((m) => m.run === r.id).map((m) => ({ name: m.name, nick: m.nick, worktree: m.worktree }));
      const open = runs.map((r) => ({ run: r.id, kind: r.kind, group: r.plan, title: r.title, members: membersOf(r) }));
      emit({ home: DATA_ROOT, sqlite: SQLITE_PATH, server, runs: runs.length, open }, () => {
        console.log(`home    ${DATA_ROOT}`);
        console.log(`sqlite  ${SQLITE_PATH}`);
        console.log(
          server.running ? `page    running  pid ${server.pid}  ${pageUrl(server.port)}` : `page    not running${server.stale ? " (stale pid file)" : ""}: swarm serve --detach`
        );
        if (!runs.length) console.log("no open run");
        for (const r of runs) {
          console.log(`run ${r.id}  ${r.kind}  ${r.plan}  ${r.title}  ${r.repo}`);
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
if (args.verb === "--help") {
  console.log(args.positional[0] === "code" ? CODE_USAGE : USAGE);
  process.exit(0);
}
if (args.verb === "serve" && args.has("--detach")) {
  const st = readServerStatus();
  const port = st.running && st.port !== null ? st.port : (fs5.mkdirSync(DATA_ROOT, { recursive: true }), spawnDetachedServer(portFrom(args.flag("--port"))));
  if (port === null) {
    console.error(`swarm: the server did not come up within 10 s (port ${portFrom(args.flag("--port"))} may be in use; retry with --port <n>)`);
    process.exitCode = 1;
  } else {
    const server = readServerStatus();
    emit({ server, url: pageUrl(port), already: st.running }, st.running ? `swarm's page already running on ${pageUrl(port)} (pid ${server.pid})` : `swarm's page up on ${pageUrl(port)}`);
  }
} else if (args.verb === "serve") {
  const { startServer: startServer2 } = await Promise.resolve().then(() => (init_server(), server_exports));
  const board = await openBoard();
  boardUpkeep(board);
  setInterval(() => boardUpkeep(board), UPKEEP_EVERY_MS).unref();
  startServer2(board, { port: portFrom(args.flag("--port")) });
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

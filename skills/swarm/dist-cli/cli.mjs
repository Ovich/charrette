// src/cli/index.ts
import { spawnSync as spawnSync2 } from "node:child_process";
import fs3 from "node:fs";
import path4 from "node:path";

// src/board/board.ts
import fs from "node:fs";
import path2 from "node:path";

// src/board/home.ts
import os from "node:os";
import path from "node:path";
var DATA_ROOT = process.env.CHARRETTE_HOME ? path.resolve(process.env.CHARRETTE_HOME) : path.join(os.homedir(), "charrette_appdata");
var SQLITE_PATH = path.join(DATA_ROOT, "swarm.sqlite");
var ACTIVE_MARKER = path.join(DATA_ROOT, "swarm.active");

// src/board/mentions.ts
function planCode(plan) {
  const words = plan.split(/[-_\s.]+/).filter((w) => w && !/^\d+$/.test(w));
  if (words.length === 0) return plan.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
var MENTION = /(?<![\w@])@([A-Za-z0-9][\w.\-]*(?:[\/·][A-Za-z0-9][\w.\-]*)?)/g;
function parseMentions(body, senderPlan, plans) {
  const out = /* @__PURE__ */ new Set();
  for (const m of body.matchAll(MENTION)) {
    const token = m[1].replace(/[.\-]+$/, "");
    if (token.includes("/")) {
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

// src/board/board.ts
var SLICE_STATES = /* @__PURE__ */ new Set(["ready", "running", "done", "blocked"]);
var ORCHESTRATOR = "orchestrator";
var WAIT_POLL_MS = 1e3;
var LINE_WIDTH = 100;
var STALE_MS = 10 * 60 * 1e3;
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
    -- The CLI, the hooks and the server write concurrently; without a busy timeout a
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
    -- claims are global by repository-relative path, across every run on a repository (D12, D20)
    CREATE TABLE IF NOT EXISTS claims (
      repo TEXT NOT NULL,
      path TEXT NOT NULL,
      participant INTEGER NOT NULL,
      kind TEXT NOT NULL DEFAULT 'inside',
      PRIMARY KEY (repo, path)
    );
    CREATE TABLE IF NOT EXISTS merge_locks (
      repo TEXT PRIMARY KEY,
      participant INTEGER NOT NULL,
      at TEXT NOT NULL
    );
    -- who a Claude Code caller is: "agent:<id>" or "session:<id>" (D28)
    CREATE TABLE IF NOT EXISTS identities (
      key TEXT PRIMARY KEY,
      run INTEGER,
      plan TEXT,
      slice TEXT NOT NULL,
      at TEXT NOT NULL
    );
  `);
  const upkeep = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  upkeep("participants", "worktree", "worktree TEXT");
  upkeep("participants", "last_call", "last_call TEXT");
  const marker = path2.join(path2.dirname(dbPath), path2.basename(ACTIVE_MARKER));
  const syncMarker = () => {
    const open = Number(db.prepare("SELECT COUNT(*) AS n FROM runs WHERE state = 'open'").get().n);
    if (open > 0) {
      if (!fs.existsSync(marker)) fs.writeFileSync(marker, "");
    } else fs.rmSync(marker, { force: true });
  };
  syncMarker();
  const signal = `${dbPath}.signal`;
  if (!fs.existsSync(signal)) fs.writeFileSync(signal, "0");
  const touch = (seq) => fs.writeFileSync(signal, String(seq));
  const now = () => (/* @__PURE__ */ new Date()).toISOString();
  let depth = 0;
  const transaction = (fn) => {
    if (depth > 0) return fn();
    db.exec("BEGIN IMMEDIATE");
    depth++;
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    } finally {
      depth--;
    }
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
    state: r.state === "closed" ? "closed" : "open",
    slices: db.prepare("SELECT * FROM slices WHERE run = ? ORDER BY ord").all(Number(r.id)).map((s) => ({
      id: String(s.id),
      title: String(s.title),
      blockers: JSON.parse(String(s.blockers)),
      state: String(s.state)
    }))
  });
  const PARTICIPANT_SQL = `SELECT p.*, r.repo, r.plan FROM participants p JOIN runs r ON r.id = p.run`;
  const toParticipant = (r) => ({
    id: Number(r.id),
    run: Number(r.run),
    repo: String(r.repo),
    plan: String(r.plan),
    slice: String(r.slice),
    name: `${r.plan}/${r.slice}`,
    ended: r.ended_at != null,
    worktree: r.worktree == null ? null : String(r.worktree)
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
  const insertMessage = (p, body, about, kind, named) => {
    const mentions = named ?? (kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo)));
    const r = db.prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(p.repo, p.id, body, about, kind, JSON.stringify(mentions), now());
    const seq = Number(r.lastInsertRowid);
    touch(seq);
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
  const claimOf = (repo, rel) => {
    const r = db.prepare("SELECT participant, kind FROM claims WHERE repo = ? AND path = ?").get(repo, rel);
    return r ? { participant: Number(r.participant), kind: String(r.kind) } : null;
  };
  const takeUnlessHeld = (p, rel, kind) => transaction(() => {
    const held = claimOf(p.repo, rel);
    if (held && held.participant !== p.id && isLive(held.participant)) return held;
    if (held?.participant === p.id && (held.kind === "interface" || kind === "inside")) return null;
    db.prepare("INSERT OR REPLACE INTO claims (repo, path, participant, kind) VALUES (?, ?, ?, ?)").run(p.repo, rel, p.id, kind);
    return null;
  });
  const releaseAll = (id) => {
    db.prepare("DELETE FROM claims WHERE participant = ?").run(id);
    db.prepare("DELETE FROM merge_locks WHERE participant = ?").run(id);
  };
  const declared = (id) => JSON.parse(String(db.prepare("SELECT files FROM participants WHERE id = ?").get(id).files));
  const board = {
    openRun({ repo, plan, title, slices }) {
      const id = transaction(() => {
        const r = db.prepare("INSERT INTO runs (repo, plan, title, opened_at) VALUES (?, ?, ?, ?)").run(repo, plan, title, now());
        const run = Number(r.lastInsertRowid);
        const ins = db.prepare("INSERT INTO slices (run, id, title, blockers, ord) VALUES (?, ?, ?, ?, ?)");
        slices.forEach((s, i) => ins.run(run, s.id, s.title, JSON.stringify(s.blockers ?? []), i));
        db.prepare("INSERT INTO participants (run, slice, since_seq, joined_at) VALUES (?, ?, ?, ?)").run(run, ORCHESTRATOR, lastSeq(), now());
        return run;
      });
      syncMarker();
      return toRun(runRow(id));
    },
    setSliceState(run, slice, state) {
      runRow(run);
      if (!SLICE_STATES.has(state)) throw new Error(`unknown slice state ${state}`);
      transaction(() => {
        const r = db.prepare("UPDATE slices SET state = ? WHERE run = ? AND id = ?").run(state, run, slice);
        if (Number(r.changes) === 0) throw new Error(`unknown slice ${slice} in run ${run}`);
        if (state !== "done") return;
        const p = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, slice);
        if (p) releaseAll(Number(p.id));
      });
    },
    closeRun(run) {
      runRow(run);
      transaction(() => {
        db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run);
        db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run);
        for (const p of db.prepare("SELECT id FROM participants WHERE run = ?").all(run)) releaseAll(Number(p.id));
      });
      syncMarker();
    },
    runs() {
      return db.prepare("SELECT * FROM runs WHERE state = 'open' ORDER BY id").all().map(toRun);
    },
    join({ run, slice, doing, files, worktree }) {
      const r = runRow(run);
      if (r.state !== "open") throw new Error(`run ${run} is closed`);
      if (slice === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      const where = worktree ? path2.resolve(worktree) : null;
      const id = transaction(() => {
        const existing = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, slice);
        if (existing) {
          db.prepare("UPDATE participants SET doing = ?, files = ?, worktree = ?, ended_at = NULL WHERE id = ?").run(
            doing,
            JSON.stringify(files),
            where,
            Number(existing.id)
          );
          return Number(existing.id);
        }
        const ins = db.prepare("INSERT INTO participants (run, slice, worktree, doing, files, since_seq, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(run, slice, where, doing, JSON.stringify(files), lastSeq(), now());
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
    },
    participant(name) {
      const i = name.lastIndexOf("/");
      if (i <= 0) return null;
      const plan = name.slice(0, i);
      const slice = name.slice(i + 1);
      const r = db.prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? ORDER BY (r.state = 'open') DESC, r.id DESC LIMIT 1`).get(plan, slice);
      return r ? toParticipant(r) : null;
    },
    bind({ agentId, sessionId }, { run, plan, slice }) {
      const key = agentId ? `agent:${agentId}` : sessionId ? `session:${sessionId}` : null;
      if (!key) return;
      db.prepare("INSERT OR REPLACE INTO identities (key, run, plan, slice, at) VALUES (?, ?, ?, ?, ?)").run(key, run ?? null, plan ?? null, slice, now());
    },
    identify({ worktree, agentId, sessionId }) {
      const bound = (key) => {
        const id = db.prepare("SELECT * FROM identities WHERE key = ?").get(key);
        if (!id) return null;
        const r = id.run != null ? db.prepare(`${PARTICIPANT_SQL} WHERE p.run = ? AND p.slice = ?`).get(Number(id.run), String(id.slice)) : db.prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? AND r.state = 'open' ORDER BY r.id DESC LIMIT 1`).get(String(id.plan), String(id.slice));
        if (!r) return null;
        const p = toParticipant(r);
        return isLive(p.id) ? p : null;
      };
      const known = agentId ? bound(`agent:${agentId}`) : sessionId ? bound(`session:${sessionId}`) : null;
      if (known) return known;
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
      insertMessage(fresh, "ended", null, "event");
      transaction(() => {
        db.prepare("UPDATE participants SET ended_at = ? WHERE id = ?").run(now(), fresh.id);
        releaseAll(fresh.id);
      });
    },
    roster(repo) {
      const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL ORDER BY r.id, p.id`).all(repo);
      const cutoff = Date.now() - STALE_MS;
      return rows.map((r) => ({
        name: `${r.plan}/${r.slice}`,
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
      const me = participantById(p.id);
      const messages = transaction(() => {
        const rows = db.prepare(
          `SELECT m.* FROM messages m
             WHERE m.repo = ? AND m.seq > ? AND m.author != ?
               AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.participant = ? AND d.seq = m.seq)
             ORDER BY m.seq`
        ).all(me.repo, Number(db.prepare("SELECT since_seq FROM participants WHERE id = ?").get(me.id).since_seq), me.id, me.id);
        const mark = db.prepare("INSERT INTO deliveries (participant, seq) VALUES (?, ?)");
        for (const r of rows) mark.run(me.id, Number(r.seq));
        db.prepare("UPDATE participants SET last_call = ? WHERE id = ?").run(now(), me.id);
        return rows.map(toMessage);
      });
      const named = (m) => m.mentions.includes(me.name) || m.mentions.includes(`${me.plan}/*`);
      return {
        full: messages.filter(named),
        lines: messages.filter((m) => !named(m)).map(messageLine)
      };
    },
    wait(p, timeoutMs) {
      participantById(p.id);
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
          if (d instanceof Error) reject(d);
          else resolve(d);
        };
        const check = () => {
          if (settled) return;
          try {
            const d = board.deliver(p);
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
    checkEdit(p, file) {
      const me = live(p);
      const rel = relPath(me.repo, file);
      if (!rel) return { allowed: true };
      const held = takeUnlessHeld(me, rel, "inside");
      if (!held) return { allowed: true };
      const holder = participantById(held.participant);
      const note = String(db.prepare("SELECT doing FROM participants WHERE id = ?").get(holder.id).doing) || "no note";
      return {
        allowed: false,
        refusal: `${rel} is held by ${holder.name} (${note}). Do not write it. Run \`swarm wait\` to hear when it is released, or settle it on the board: \`swarm post "@${holder.name} \u2026"\`.`
      };
    },
    reconcileWrites(p, changed) {
      const me = live(p);
      const flags = [];
      for (const file of changed) {
        const rel = relPath(me.repo, file);
        if (!rel) continue;
        const held = takeUnlessHeld(me, rel, "inside");
        if (!held) continue;
        const holder = participantById(held.participant);
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
    },
    release(p, file) {
      const me = live(p);
      const rel = relPath(me.repo, file);
      if (rel) db.prepare("DELETE FROM claims WHERE repo = ? AND path = ? AND participant = ?").run(me.repo, rel, me.id);
    },
    lockMerge(p) {
      const me = live(p);
      return transaction(() => {
        const r = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo);
        if (r && Number(r.participant) !== me.id && isLive(Number(r.participant))) {
          return { granted: false, holder: participantById(Number(r.participant)).name };
        }
        db.prepare("INSERT OR REPLACE INTO merge_locks (repo, participant, at) VALUES (?, ?, ?)").run(me.repo, me.id, now());
        return { granted: true };
      });
    },
    merged(p, sha, files) {
      const me = live(p);
      const rels = [...new Set(files.map((f) => relPath(me.repo, f)).filter((x) => x !== null))];
      const wanted = new Set(rels);
      const told = /* @__PURE__ */ new Set();
      const iface = /* @__PURE__ */ new Set();
      transaction(() => {
        const lock = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo);
        if (lock && Number(lock.participant) !== me.id && isLive(Number(lock.participant))) {
          throw new Error(`the merge lock is held by ${participantById(Number(lock.participant)).name}, not ${me.name}`);
        }
        db.prepare("DELETE FROM merge_locks WHERE repo = ?").run(me.repo);
      });
      for (const rel of rels) {
        const c = claimOf(me.repo, rel);
        if (!c) continue;
        if (c.kind === "interface") iface.add(rel);
        if (c.participant !== me.id && isLive(c.participant)) told.add(participantById(c.participant).name);
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
      lines.push(`files: ${rels.join(", ") || "-"}`);
      insertMessage(me, lines.join("\n"), null, "event", [.../* @__PURE__ */ new Set([...told, ...all])]);
    },
    close() {
      db.close();
    }
  };
  return board;
}

// src/hook/hook.ts
import { spawnSync } from "node:child_process";
import fs2 from "node:fs";
import path3 from "node:path";

// src/cli/format.ts
var fullText = (m) => {
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}  ${m.at}
${m.body}`;
};
var deliveryText = (d) => [...d.full.map(fullText), ...d.lines].join("\n");

// src/hook/hook.ts
var EDITS = /* @__PURE__ */ new Set(["Edit", "Write", "NotebookEdit"]);
var readStdin = async () => {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
};
var SWARM_VERB = /(?:^|[\s;&|("'\/\\])swarm(?:\.mjs)?["']?\s+(join|open)\b([^\n;&|]*)/;
var flagIn = (args2, name) => args2.match(new RegExp(`--${name}[\\s=]+["']?([^\\s"']+)`))?.[1];
function swarmCall(command) {
  const m = command.match(SWARM_VERB);
  if (!m) return null;
  if (m[1] === "open") {
    const plan = flagIn(m[2], "plan");
    return plan ? { verb: "open", plan } : null;
  }
  const run = Number(flagIn(m[2], "run"));
  const slice = flagIn(m[2], "slice");
  return Number.isInteger(run) && slice ? { verb: "join", run, slice } : null;
}
function changedIn(worktree) {
  const r = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return [];
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
function pre(board, input) {
  const who = { agentId: input.agent_id, sessionId: input.session_id };
  if (input.tool_name === "Bash") {
    const call = swarmCall(String(input.tool_input.command ?? ""));
    if (call?.verb === "join") board.bind(who, { run: call.run, slice: call.slice });
    else if (call?.verb === "open") board.bind(who, { plan: call.plan, slice: "orchestrator" });
    return null;
  }
  if (!EDITS.has(input.tool_name)) return null;
  const file = input.tool_input.file_path ?? input.tool_input.notebook_path;
  if (typeof file !== "string" || !file) return null;
  const p = board.identify({ ...who, worktree: input.cwd });
  if (!p) return null;
  const verdict = board.checkEdit(p, path3.resolve(input.cwd || ".", file));
  if (verdict.allowed) return null;
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.refusal } };
}
function post(board, input) {
  const p = board.identify({ agentId: input.agent_id, sessionId: input.session_id, worktree: input.cwd });
  if (!p) return null;
  const flags = input.tool_name === "Bash" && p.worktree ? board.reconcileWrites(p, changedIn(p.worktree)) : [];
  const news = deliveryText(board.deliver(p));
  const flagged = flags.map((f) => `#${f.seq} flagged: you wrote ${f.path} outside your claim; ${f.holder} holds it. Settle it with @${f.holder} on the board.`);
  const text = [news, ...flagged].filter(Boolean).join("\n");
  if (!text) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `swarm board (you are ${p.name}; full text of a line: swarm read <n>):
${text}`
    }
  };
}
async function runHook(kind) {
  let board = null;
  try {
    if (kind !== "pre" && kind !== "post") return;
    const active = fs2.existsSync(ACTIVE_MARKER);
    if (!active && kind === "post") return;
    const raw = await readStdin();
    if (!active && !raw.includes("open")) return;
    const input = JSON.parse(raw);
    const call = input.tool_name === "Bash" ? swarmCall(String(input.tool_input?.command ?? "")) : null;
    if (!active && call?.verb !== "open") return;
    if (kind === "pre" && input.tool_name === "Bash" && !call) return;
    board = await openBoard();
    const out = kind === "pre" ? pre(board, input) : post(board, input);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
  } finally {
    try {
      board?.close();
    } catch {
    }
    process.exitCode = 0;
  }
}

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
  "--repo"
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

// src/cli/index.ts
var args = parseArgs(process.argv.slice(2));
var asJson = args.has("--json");
var USAGE = [
  "usage: swarm <verb> [--json]",
  "  open    --plan <slug> --title <t> --slices <file.json>          # opens a run, prints its id (orchestrator)",
  "  slice   <id> --run <id> --state ready|running|done|blocked      # (orchestrator)",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --slice <id> --doing <t> [--files "<path>:interface,<path>:inside,\u2026"]   # prints the roster',
  "  doing   [--as <runner>] <text>",
  "  post    [--as <runner>] <body> [--about <path>]                 # prints the seq",
  "  agree   [--as <runner>] <terms> [--about <path>]                # prints the seq",
  "  read    <seq>",
  "  deliver [--as <runner>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <runner>] [--timeout <ms>]                        # blocks until a message for you; nothing on timeout",
  "  roster  [--repo <path>]",
  "  release [--as <runner>] <path>                                  # gives up a claim",
  "  merge-lock [--as <runner>]                                      # one merge at a time per repository",
  "  merged  [--as <runner>] <sha> --files <path>...                 # releases the lock, tells who must rebase",
  "  end     [--as <runner>]                                         # releases your claims and the lock",
  "  hook    pre|post                                                # Claude Code's hooks: hook JSON on stdin",
  "  status                                                          # data home, open runs",
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
  const r = spawnSync2("git", argv, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
function repoOf(dir) {
  const common = git(dir, "rev-parse", "--git-common-dir");
  if (!common) fail(`not in a git repository: ${dir}`);
  const abs = path4.resolve(dir, common);
  try {
    return fs3.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
function worktreeOf(dir) {
  const top = git(dir, "rev-parse", "--show-toplevel");
  return top ? path4.resolve(top) : null;
}
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
  return `${r.name}${r.stale ? " (stale)" : ""}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}`;
};
var printDelivery = (d) => {
  for (const m of d.full) console.log(fullText(m));
  for (const l of d.lines) console.log(l);
};
function parseFile(spec) {
  const m = spec.match(/^(.*):(interface|inside)$/);
  return m ? { path: m[1], interface: m[2] === "interface" } : { path: spec, interface: false };
}
function readSlices(file) {
  let raw;
  try {
    raw = JSON.parse(fs3.readFileSync(path4.resolve(file), "utf8"));
  } catch (e) {
    return fail(`cannot read slices from ${file}: ${e.message}`);
  }
  const list = Array.isArray(raw) ? raw : raw.slices;
  if (!Array.isArray(list)) return fail(`${file}: expected an array of {id, title, blockers}`);
  return list.map((s) => {
    if (typeof s.id !== "string") fail(`${file}: a slice without an id`);
    return { id: String(s.id), title: String(s.title ?? s.id), blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [] };
  });
}
async function main(board) {
  switch (args.verb) {
    case "open": {
      const plan = need("--plan");
      const run = board.openRun({ repo: repoOf(process.cwd()), plan, title: need("--title"), slices: readSlices(need("--slices")) });
      emit({ run: run.id, repo: run.repo, plan: run.plan }, String(run.id));
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
      emit({ runner: runner.name, roster }, () => {
        console.log(`you are ${runner.name}`);
        for (const r of roster) console.log(rosterLine(r));
      });
      break;
    }
    case "doing": {
      const p = caller(board);
      const text = args.positional.join(" ") || fail("doing: what?");
      board.setDoing(p, text);
      emit({ runner: p.name, doing: text }, `${p.name} doing: ${text}`);
      break;
    }
    case "post":
    case "agree": {
      const p = caller(board);
      const body = args.positional.join(" ") || fail(`${args.verb}: nothing to say`);
      const m = board.post(p, body, { about: args.flag("--about"), kind: args.verb === "agree" ? "agreement" : "msg" });
      emit({ seq: m.seq, mentions: m.mentions }, `#${m.seq}`);
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
      const d = await board.wait(p, timeout);
      emit(d, () => printDelivery(d));
      break;
    }
    case "roster": {
      const repo = repoOf(path4.resolve(args.flag("--repo") ?? process.cwd()));
      const roster = board.roster(repo);
      emit({ repo, roster }, () => {
        for (const r of roster) console.log(rosterLine(r));
      });
      break;
    }
    case "release": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("release: which path?");
      board.release(p, path4.resolve(file));
      emit({ runner: p.name, released: file }, `${p.name} released ${file}`);
      break;
    }
    case "merge-lock": {
      const p = caller(board);
      const r = board.lockMerge(p);
      emit(
        { runner: p.name, ...r },
        r.granted ? "granted: merge, then swarm merged <sha> --files <path>..." : `held by ${r.holder}: swarm wait for its merged event`
      );
      break;
    }
    case "merged": {
      const p = caller(board);
      const sha = args.positional[0] ?? fail("merged: which sha?");
      const files = args.list("--files");
      board.merged(p, sha, files.map((f) => path4.resolve(f)));
      emit({ runner: p.name, sha, files }, `merged ${sha}: lock released`);
      break;
    }
    case "end": {
      const p = caller(board);
      board.end(p);
      emit({ runner: p.name, ended: true }, `${p.name} ended`);
      break;
    }
    case "status": {
      const runs = board.runs();
      emit({ home: DATA_ROOT, sqlite: SQLITE_PATH, runs }, () => {
        console.log(`home    ${DATA_ROOT}`);
        console.log(`sqlite  ${SQLITE_PATH}`);
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
if (args.verb === "hook") {
  await runHook(args.positional[0]);
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

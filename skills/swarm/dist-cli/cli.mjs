// src/cli/index.ts
import { spawnSync } from "node:child_process";
import fs2 from "node:fs";
import path3 from "node:path";

// src/board/board.ts
import fs from "node:fs";
import path2 from "node:path";

// src/board/home.ts
import os from "node:os";
import path from "node:path";
var DATA_ROOT = process.env.CHARRETTE_HOME ? path.resolve(process.env.CHARRETTE_HOME) : path.join(os.homedir(), "charrette_appdata");
var SQLITE_PATH = path.join(DATA_ROOT, "swarm.sqlite");

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
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name !== "ExperimentalWarning") console.warn(w);
});
var { DatabaseSync } = await import("node:sqlite");
var SLICE_STATES = /* @__PURE__ */ new Set(["ready", "running", "done", "blocked"]);
var ORCHESTRATOR = "orchestrator";
var WAIT_POLL_MS = 1e3;
var LINE_WIDTH = 100;
function messageLine(m) {
  const first = m.body.split(/\r?\n/)[0];
  const text = first.length > LINE_WIDTH ? `${first.slice(0, LINE_WIDTH - 1)}\u2026` : first;
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}: ${text}`;
}
async function openBoard(dbPath = SQLITE_PATH) {
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
  `);
  const upkeep = (table, column, ddl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  upkeep("participants", "worktree", "worktree TEXT");
  const signal = `${dbPath}.signal`;
  if (!fs.existsSync(signal)) fs.writeFileSync(signal, "0");
  const touch = (seq) => fs.writeFileSync(signal, String(seq));
  const now = () => (/* @__PURE__ */ new Date()).toISOString();
  const transaction = (fn) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
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
    ended: r.ended_at != null
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
  const insertMessage = (p, body, about, kind) => {
    const mentions = kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo));
    const r = db.prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(p.repo, p.id, body, about, kind, JSON.stringify(mentions), now());
    const seq = Number(r.lastInsertRowid);
    touch(seq);
    return board2.read(seq);
  };
  const live = (p) => {
    const fresh = participantById(p.id);
    if (fresh.ended) throw new Error(`runner ${p.name} has ended`);
    return fresh;
  };
  const board2 = {
    openRun({ repo, plan, title, slices }) {
      const id = transaction(() => {
        const r = db.prepare("INSERT INTO runs (repo, plan, title, opened_at) VALUES (?, ?, ?, ?)").run(repo, plan, title, now());
        const run = Number(r.lastInsertRowid);
        const ins = db.prepare("INSERT INTO slices (run, id, title, blockers, ord) VALUES (?, ?, ?, ?, ?)");
        slices.forEach((s, i) => ins.run(run, s.id, s.title, JSON.stringify(s.blockers ?? []), i));
        db.prepare("INSERT INTO participants (run, slice, since_seq, joined_at) VALUES (?, ?, ?, ?)").run(run, ORCHESTRATOR, lastSeq(), now());
        return run;
      });
      return toRun(runRow(id));
    },
    setSliceState(run, slice, state) {
      runRow(run);
      if (!SLICE_STATES.has(state)) throw new Error(`unknown slice state ${state}`);
      const r = db.prepare("UPDATE slices SET state = ? WHERE run = ? AND id = ?").run(state, run, slice);
      if (Number(r.changes) === 0) throw new Error(`unknown slice ${slice} in run ${run}`);
    },
    closeRun(run) {
      runRow(run);
      db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run);
      db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run);
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
      insertMessage(runner, `joined: ${doing}`, null, "event");
      return { runner, roster: board2.roster(runner.repo) };
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
      const rows = db.prepare(`${PARTICIPANT_SQL} WHERE p.worktree = ? AND p.ended_at IS NULL AND r.state = 'open'`).all(path2.resolve(worktree));
      return rows.length === 1 ? toParticipant(rows[0]) : null;
    },
    setDoing(p, doing) {
      const fresh = live(p);
      db.prepare("UPDATE participants SET doing = ? WHERE id = ?").run(doing, fresh.id);
      insertMessage(fresh, `doing: ${doing}`, null, "event");
    },
    end(p) {
      const fresh = live(p);
      insertMessage(fresh, "ended", null, "event");
      db.prepare("UPDATE participants SET ended_at = ? WHERE id = ?").run(now(), fresh.id);
    },
    roster(repo) {
      const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL ORDER BY r.id, p.id`).all(repo);
      return rows.map((r) => ({
        name: `${r.plan}/${r.slice}`,
        run: Number(r.run),
        plan: String(r.plan),
        slice: String(r.slice),
        doing: String(r.doing),
        files: JSON.parse(String(r.files))
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
            const d = board2.deliver(p);
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
    close() {
      db.close();
    }
  };
  return board2;
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
  "usage: swarm <verb> [--json]",
  "  open    --plan <slug> --title <t> --slices <file.json>          # opens a run, prints its id (orchestrator)",
  "  slice   <id> --run <id> --state ready|running|done|blocked      # (orchestrator)",
  "  close   --run <id>                                              # (orchestrator)",
  "  join    --run <id> --slice <id> --doing <t> [--file <path>[:interface]]...   # prints the roster",
  "  doing   [--as <runner>] <text>",
  "  post    [--as <runner>] <body> [--about <path>]                 # prints the seq",
  "  agree   [--as <runner>] <terms> [--about <path>]                # prints the seq",
  "  read    <seq>",
  "  deliver [--as <runner>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <runner>] [--timeout <ms>]                        # blocks until a message for you; nothing on timeout",
  "  roster  [--repo <path>]",
  "  end     [--as <runner>]",
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
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
function repoOf(dir) {
  const common = git(dir, "rev-parse", "--git-common-dir");
  if (!common) fail(`not in a git repository: ${dir}`);
  const abs = path3.resolve(dir, common);
  try {
    return fs2.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
function worktreeOf(dir) {
  const top = git(dir, "rev-parse", "--show-toplevel");
  return top ? path3.resolve(top) : null;
}
var need = (flag) => args.flag(flag) ?? fail(`${flag} is required
${USAGE}`);
var runArg = () => {
  const raw = need("--run");
  const id = Number(raw);
  if (!Number.isInteger(id)) fail(`--run takes a run id, got ${raw}`);
  return id;
};
function caller(board2) {
  const as = args.flag("--as");
  if (as) return board2.participant(as) ?? fail(`unknown runner ${as}`);
  const wt = worktreeOf(process.cwd());
  const p = wt ? board2.identify({ worktree: wt }) : null;
  return p ?? fail("who is calling? no single runner joined from this worktree; pass --as <plan>/<slice>");
}
var rosterLine = (r) => {
  const files = r.files.map((f) => f.interface ? `${f.path} (interface)` : f.path).join(", ");
  return `${r.name}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}`;
};
var fullText = (m) => {
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}  ${m.at}
${m.body}`;
};
var printDelivery = (d) => {
  for (const m of d.full) console.log(fullText(m));
  for (const l of d.lines) console.log(l);
};
function parseFile(spec) {
  const suffix = ":interface";
  return spec.endsWith(suffix) ? { path: spec.slice(0, -suffix.length), interface: true } : { path: spec, interface: false };
}
function readSlices(file) {
  let raw;
  try {
    raw = JSON.parse(fs2.readFileSync(path3.resolve(file), "utf8"));
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
async function main(board2) {
  switch (args.verb) {
    case "open": {
      const plan = need("--plan");
      const run = board2.openRun({ repo: repoOf(process.cwd()), plan, title: need("--title"), slices: readSlices(need("--slices")) });
      emit({ run: run.id, repo: run.repo, plan: run.plan }, String(run.id));
      break;
    }
    case "slice": {
      const id = args.positional[0] ?? fail(`slice: which slice?
${USAGE}`);
      const run = runArg();
      const state = need("--state");
      board2.setSliceState(run, id, state);
      emit({ run, slice: id, state }, `${id} ${state}`);
      break;
    }
    case "close": {
      const run = runArg();
      board2.closeRun(run);
      emit({ run, state: "closed" }, `run ${run} closed`);
      break;
    }
    case "join": {
      const { runner, roster } = board2.join({
        run: runArg(),
        slice: need("--slice"),
        doing: need("--doing"),
        files: args.flags("--file").map(parseFile),
        worktree: worktreeOf(process.cwd()) ?? void 0
      });
      emit({ runner: runner.name, roster }, () => {
        console.log(`you are ${runner.name}`);
        for (const r of roster) console.log(rosterLine(r));
      });
      break;
    }
    case "doing": {
      const p = caller(board2);
      const text = args.positional.join(" ") || fail("doing: what?");
      board2.setDoing(p, text);
      emit({ runner: p.name, doing: text }, `${p.name} doing: ${text}`);
      break;
    }
    case "post":
    case "agree": {
      const p = caller(board2);
      const body = args.positional.join(" ") || fail(`${args.verb}: nothing to say`);
      const m = board2.post(p, body, { about: args.flag("--about"), kind: args.verb === "agree" ? "agreement" : "msg" });
      emit({ seq: m.seq, mentions: m.mentions }, `#${m.seq}`);
      break;
    }
    case "read": {
      const raw = (args.positional[0] ?? fail("read: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`read takes a seq, got ${raw}`);
      const m = board2.read(seq);
      emit(m, fullText(m));
      break;
    }
    case "deliver": {
      const d = board2.deliver(caller(board2));
      emit(d, () => printDelivery(d));
      break;
    }
    case "wait": {
      const p = caller(board2);
      const raw = args.flag("--timeout");
      const timeout = raw === void 0 ? void 0 : Number(raw);
      if (timeout !== void 0 && !(timeout >= 0)) fail(`--timeout takes milliseconds, got ${raw}`);
      const d = await board2.wait(p, timeout);
      emit(d, () => printDelivery(d));
      break;
    }
    case "roster": {
      const repo = repoOf(path3.resolve(args.flag("--repo") ?? process.cwd()));
      const roster = board2.roster(repo);
      emit({ repo, roster }, () => {
        for (const r of roster) console.log(rosterLine(r));
      });
      break;
    }
    case "end": {
      const p = caller(board2);
      board2.end(p);
      emit({ runner: p.name, ended: true }, `${p.name} ended`);
      break;
    }
    case "status": {
      const runs = board2.runs();
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
var board = await openBoard();
try {
  await main(board);
} catch (e) {
  console.error(e instanceof CliError ? e.message : `swarm: ${e.message}`);
  process.exitCode = 1;
} finally {
  board.close();
}

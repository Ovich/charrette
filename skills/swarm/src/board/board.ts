// The board — the ONLY module that sees SQL. Runs, the plan's slices, participants, the
// thread of each repository, who has had what, and waking a `wait`. Callers hold the
// typed Board openBoard() returns; the schema, runner names, mention parsing and the
// waking mechanism stay in here.
import fs from "node:fs";
import path from "node:path";
import { SQLITE_PATH } from "./home.ts";
import { parseMentions } from "./mentions.ts";

// node:sqlite prints an ExperimentalWarning on import; keep every other warning.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name !== "ExperimentalWarning") console.warn(w);
});
const { DatabaseSync } = await import("node:sqlite");

export type RunId = number;
export type SliceSpec = { id: string; title: string; blockers: string[] };
export type SliceState = "ready" | "running" | "done" | "blocked";
export type Slice = SliceSpec & { state: SliceState };
export type Declared = { path: string; interface: boolean }; // repository-relative
export type MessageKind = "msg" | "agreement" | "urgent" | "event";

export interface Run {
  id: RunId;
  repo: string;
  plan: string;
  title: string;
  state: "open" | "closed";
  slices: Slice[];
}

export interface Participant {
  id: number;
  run: RunId;
  repo: string;
  plan: string;
  slice: string; // "orchestrator" for a run's orchestrator
  name: string; // "<plan>/<slice>"
  ended: boolean;
}

export interface RosterEntry {
  name: string;
  run: RunId;
  plan: string;
  slice: string;
  doing: string;
  files: Declared[];
}

export interface Message {
  seq: number;
  repo: string;
  from: string; // the author's name
  body: string;
  about: string | null;
  kind: MessageKind;
  mentions: string[]; // "<plan>/<slice>" or "<plan>/*"
  at: string;
}

export type Delivery = { full: Message[]; lines: string[] }; // mentions in full; the rest one line each

export interface Board {
  openRun(input: { repo: string; plan: string; title: string; slices: SliceSpec[] }): Run;
  setSliceState(run: RunId, slice: string, state: SliceState): void;
  closeRun(run: RunId): void;
  /** The open runs, every repository. */
  runs(): Run[];

  join(input: { run: RunId; slice: string; doing: string; files: Declared[]; worktree?: string }): {
    runner: Participant;
    roster: RosterEntry[];
  };
  participant(name: string): Participant | null; // "<plan>/<slice>" or "<plan>/orchestrator"
  /** The runner registered at `join` for this worktree (D28); null when none or several. */
  identify(who: { worktree: string }): Participant | null;
  setDoing(p: Participant, doing: string): void;
  end(p: Participant): void;
  roster(repo: string): RosterEntry[];

  post(p: Participant, body: string, opts?: { about?: string; kind?: MessageKind }): Message;
  read(seq: number): Message;
  deliver(p: Participant): Delivery; // undelivered since last time; marks them delivered
  wait(p: Participant, timeoutMs?: number): Promise<Delivery>; // the first delivery, or empty on timeout
  close(): void;
}

const SLICE_STATES = new Set<SliceState>(["ready", "running", "done", "blocked"]);
const ORCHESTRATOR = "orchestrator";
/** A watch event can be missed (a coalesced write, a platform quirk); the store is re-read
 *  this often regardless, so a missed event costs at most this much. */
const WAIT_POLL_MS = 1000;
const LINE_WIDTH = 100;

type Row = Record<string, unknown>;

/** One line for a message a runner was not named in. */
export function messageLine(m: Message): string {
  const first = m.body.split(/\r?\n/)[0];
  const text = first.length > LINE_WIDTH ? `${first.slice(0, LINE_WIDTH - 1)}…` : first;
  const kind = m.kind === "msg" ? "" : ` (${m.kind})`;
  const about = m.about ? ` about ${m.about}` : "";
  return `#${m.seq} ${m.from}${kind}${about}: ${text}`;
}

export async function openBoard(dbPath: string = SQLITE_PATH): Promise<Board> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
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
  // Schema upkeep for stores created by earlier versions: add a column when it is missing.
  const upkeep = (table: string, column: string, ddl: string): void => {
    const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  upkeep("participants", "worktree", "worktree TEXT");

  // Waking: every post touches this sibling file; a wait watches it.
  const signal = `${dbPath}.signal`;
  if (!fs.existsSync(signal)) fs.writeFileSync(signal, "0");
  const touch = (seq: number): void => fs.writeFileSync(signal, String(seq));

  const now = (): string => new Date().toISOString();

  const transaction = <T>(fn: () => T): T => {
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

  const runRow = (id: RunId): Row => {
    const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Row | undefined;
    if (!r) throw new Error(`unknown run ${id}`);
    return r;
  };

  const toRun = (r: Row): Run => ({
    id: Number(r.id),
    repo: String(r.repo),
    plan: String(r.plan),
    title: String(r.title),
    state: r.state === "closed" ? "closed" : "open",
    slices: (db.prepare("SELECT * FROM slices WHERE run = ? ORDER BY ord").all(Number(r.id)) as Row[]).map((s) => ({
      id: String(s.id),
      title: String(s.title),
      blockers: JSON.parse(String(s.blockers)) as string[],
      state: String(s.state) as SliceState,
    })),
  });

  const PARTICIPANT_SQL = `SELECT p.*, r.repo, r.plan FROM participants p JOIN runs r ON r.id = p.run`;

  const toParticipant = (r: Row): Participant => ({
    id: Number(r.id),
    run: Number(r.run),
    repo: String(r.repo),
    plan: String(r.plan),
    slice: String(r.slice),
    name: `${r.plan}/${r.slice}`,
    ended: r.ended_at != null,
  });

  const participantById = (id: number): Participant => toParticipant(db.prepare(`${PARTICIPANT_SQL} WHERE p.id = ?`).get(id) as Row);

  const toMessage = (r: Row): Message => ({
    seq: Number(r.seq),
    repo: String(r.repo),
    from: participantById(Number(r.author)).name,
    body: String(r.body),
    about: r.about == null ? null : String(r.about),
    kind: String(r.kind) as MessageKind,
    mentions: JSON.parse(String(r.mentions)) as string[],
    at: String(r.at),
  });

  const lastSeq = (): number => Number((db.prepare("SELECT COALESCE(MAX(seq), 0) AS s FROM messages").get() as Row).s);

  const openPlans = (repo: string): string[] =>
    (db.prepare("SELECT DISTINCT plan FROM runs WHERE repo = ? AND state = 'open'").all(repo) as Row[]).map((r) => String(r.plan));

  const insertMessage = (p: Participant, body: string, about: string | null, kind: MessageKind): Message => {
    const mentions = kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo));
    const r = db
      .prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(p.repo, p.id, body, about, kind, JSON.stringify(mentions), now());
    const seq = Number(r.lastInsertRowid);
    touch(seq);
    return board.read(seq);
  };

  const live = (p: Participant): Participant => {
    const fresh = participantById(p.id);
    if (fresh.ended) throw new Error(`runner ${p.name} has ended`);
    return fresh;
  };

  const board: Board = {
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
      return (db.prepare("SELECT * FROM runs WHERE state = 'open' ORDER BY id").all() as Row[]).map(toRun);
    },

    join({ run, slice, doing, files, worktree }) {
      const r = runRow(run);
      if (r.state !== "open") throw new Error(`run ${run} is closed`);
      if (slice === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      const where = worktree ? path.resolve(worktree) : null;
      const id = transaction(() => {
        const existing = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, slice) as Row | undefined;
        if (existing) {
          db.prepare("UPDATE participants SET doing = ?, files = ?, worktree = ?, ended_at = NULL WHERE id = ?").run(
            doing,
            JSON.stringify(files),
            where,
            Number(existing.id),
          );
          return Number(existing.id);
        }
        const ins = db
          .prepare("INSERT INTO participants (run, slice, worktree, doing, files, since_seq, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(run, slice, where, doing, JSON.stringify(files), lastSeq(), now());
        return Number(ins.lastInsertRowid);
      });
      const runner = participantById(id);
      insertMessage(runner, `joined: ${doing}`, null, "event");
      return { runner, roster: board.roster(runner.repo) };
    },

    participant(name) {
      const i = name.lastIndexOf("/");
      if (i <= 0) return null;
      const plan = name.slice(0, i);
      const slice = name.slice(i + 1);
      // the latest run of that plan holding that slice, an open one first
      const r = db
        .prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? ORDER BY (r.state = 'open') DESC, r.id DESC LIMIT 1`)
        .get(plan, slice) as Row | undefined;
      return r ? toParticipant(r) : null;
    },

    identify({ worktree }) {
      const rows = db
        .prepare(`${PARTICIPANT_SQL} WHERE p.worktree = ? AND p.ended_at IS NULL AND r.state = 'open'`)
        .all(path.resolve(worktree)) as Row[];
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
      const rows = db
        .prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL ORDER BY r.id, p.id`)
        .all(repo) as Row[];
      return rows.map((r) => ({
        name: `${r.plan}/${r.slice}`,
        run: Number(r.run),
        plan: String(r.plan),
        slice: String(r.slice),
        doing: String(r.doing),
        files: JSON.parse(String(r.files)) as Declared[],
      }));
    },

    post(p, body, opts = {}) {
      const fresh = live(p);
      return insertMessage(fresh, body, opts.about ?? null, opts.kind ?? "msg");
    },

    read(seq) {
      const r = db.prepare("SELECT * FROM messages WHERE seq = ?").get(seq) as Row | undefined;
      if (!r) throw new Error(`unknown message #${seq}`);
      return toMessage(r);
    },

    deliver(p) {
      const me = participantById(p.id);
      const messages = transaction(() => {
        const rows = db
          .prepare(
            `SELECT m.* FROM messages m
             WHERE m.repo = ? AND m.seq > ? AND m.author != ?
               AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.participant = ? AND d.seq = m.seq)
             ORDER BY m.seq`,
          )
          .all(me.repo, Number((db.prepare("SELECT since_seq FROM participants WHERE id = ?").get(me.id) as Row).since_seq), me.id, me.id) as Row[];
        const mark = db.prepare("INSERT INTO deliveries (participant, seq) VALUES (?, ?)");
        for (const r of rows) mark.run(me.id, Number(r.seq));
        return rows.map(toMessage);
      });
      const named = (m: Message): boolean => m.mentions.includes(me.name) || m.mentions.includes(`${me.plan}/*`);
      return {
        full: messages.filter(named),
        lines: messages.filter((m) => !named(m)).map(messageLine),
      };
    },

    wait(p, timeoutMs) {
      participantById(p.id);
      return new Promise<Delivery>((resolve, reject) => {
        let settled = false;
        let watcher: fs.FSWatcher | undefined;
        let poll: NodeJS.Timeout | undefined;
        let timer: NodeJS.Timeout | undefined;
        const finish = (d: Delivery | Error): void => {
          if (settled) return;
          settled = true;
          watcher?.close();
          clearInterval(poll);
          clearTimeout(timer);
          if (d instanceof Error) reject(d);
          else resolve(d);
        };
        const check = (): void => {
          if (settled) return;
          try {
            const d = board.deliver(p);
            if (d.full.length || d.lines.length) finish(d);
          } catch (e) {
            finish(e as Error);
          }
        };
        // watch first, then look: a post landing between the two is still seen
        watcher = fs.watch(signal, check);
        poll = setInterval(check, WAIT_POLL_MS);
        if (timeoutMs !== undefined) timer = setTimeout(() => finish({ full: [], lines: [] }), timeoutMs);
        check();
      });
    },

    close() {
      db.close();
    },
  };
  return board;
}

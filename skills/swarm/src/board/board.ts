// The board — the ONLY module that sees SQL. Runs, the plan's slices, participants, the
// thread of each repository, who has had what, claims, the merge lock, who is calling,
// and waking a `wait`. Callers hold the typed Board openBoard() returns; the schema,
// runner names, mention parsing, path normalisation, refusal wording and the waking
// mechanism stay in here.
import fs from "node:fs";
import path from "node:path";
import { ACTIVE_MARKER, SQLITE_PATH } from "./home.ts";
import { parseMentions } from "./mentions.ts";

export type RunId = number;
export type SliceSpec = { id: string; title: string; blockers: string[] };
export type SliceState = "ready" | "running" | "done" | "blocked";
export type Slice = SliceSpec & { state: SliceState };
export type Declared = { path: string; interface: boolean }; // repository-relative
export type MessageKind = "msg" | "agreement" | "urgent" | "event";
/** A file written outside its writer's claim while another runner holds it. */
export type Flag = { path: string; holder: string; seq: number };

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
  worktree: string | null; // registered at join; null for the orchestrator
}

export interface RosterEntry {
  name: string;
  run: RunId;
  plan: string;
  slice: string;
  doing: string;
  files: Declared[];
  stale: boolean; // no tool call for ten minutes (D31)
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
  /** `done` also releases the slice runner's claims and lock: the orchestrator's way to free a stale runner. */
  setSliceState(run: RunId, slice: string, state: SliceState): void;
  closeRun(run: RunId): void;
  /** The open runs, every repository. */
  runs(): Run[];

  /** Declared files become claims where free (*interface* or *inside*); a held one stays declared only. */
  join(input: { run: RunId; slice: string; doing: string; files: Declared[]; worktree?: string }): {
    runner: Participant;
    roster: RosterEntry[];
  };
  participant(name: string): Participant | null; // "<plan>/<slice>" or "<plan>/orchestrator"
  /** Remembers who a Claude Code caller is, as the pre hook sees `swarm join` / `swarm open`:
   *  by agent id when there is one, else by session id. The participant may not exist yet. */
  bind(who: { agentId?: string; sessionId?: string }, as: { run?: RunId; plan?: string; slice: string }): void;
  /** Who is calling (D28): the agent id bound at join; else, with no agent id, the session id
   *  bound at open; else the one live runner whose worktree holds `worktree`. */
  identify(who: { worktree?: string; agentId?: string; sessionId?: string }): Participant | null;
  setDoing(p: Participant, doing: string): void;
  /** Ends the runner and releases its claims and any merge lock it holds. */
  end(p: Participant): void;
  roster(repo: string): RosterEntry[];

  post(p: Participant, body: string, opts?: { about?: string; kind?: MessageKind }): Message;
  read(seq: number): Message;
  deliver(p: Participant): Delivery; // undelivered since last time; marks them delivered; stamps the last call
  wait(p: Participant, timeoutMs?: number): Promise<Delivery>; // the first delivery, or empty on timeout

  /** An edit to `path` (absolute, or repository-relative): allowed when free (the claim widens)
   *  or already `p`'s; refused when another live runner holds it, the refusal naming the way out. */
  checkEdit(p: Participant, path: string): { allowed: true } | { allowed: false; refusal: string };
  /** Paths written outside the claim: a free one is claimed, a held one flagged on the thread. */
  reconcileWrites(p: Participant, changed: string[]): Flag[];
  release(p: Participant, path: string): void;
  lockMerge(p: Participant): { granted: true } | { granted: false; holder: string };
  /** Releases the lock; tells whoever holds or declared one of `files` to rebase onto `sha`,
   *  every plan on the repository when one of them is an interface (D26). */
  merged(p: Participant, sha: string, files: string[]): void;
  close(): void;
}

const SLICE_STATES = new Set<SliceState>(["ready", "running", "done", "blocked"]);
const ORCHESTRATOR = "orchestrator";
/** A watch event can be missed (a coalesced write, a platform quirk); the store is re-read
 *  this often regardless, so a missed event costs at most this much. */
const WAIT_POLL_MS = 1000;
const LINE_WIDTH = 100;
const STALE_MS = 10 * 60 * 1000;
const CASELESS = process.platform === "win32";

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
  // node:sqlite prints an ExperimentalWarning on import; keep every other warning. Imported
  // here, not at module load, so a hook's fast exit never pays for it.
  process.removeAllListeners("warning");
  process.on("warning", (w) => {
    if (w.name !== "ExperimentalWarning") console.warn(w);
  });
  const { DatabaseSync } = await import("node:sqlite");
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
  // Schema upkeep for stores created by earlier versions: add a column when it is missing.
  const upkeep = (table: string, column: string, ddl: string): void => {
    const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  upkeep("participants", "worktree", "worktree TEXT");
  upkeep("participants", "last_call", "last_call TEXT");

  // The active marker: present while a run is open anywhere on the machine; a hook exits at
  // once without it. It sits beside the store.
  const marker = path.join(path.dirname(dbPath), path.basename(ACTIVE_MARKER));
  const syncMarker = (): void => {
    const open = Number((db.prepare("SELECT COUNT(*) AS n FROM runs WHERE state = 'open'").get() as Row).n);
    if (open > 0) {
      if (!fs.existsSync(marker)) fs.writeFileSync(marker, "");
    } else fs.rmSync(marker, { force: true });
  };
  syncMarker();

  // Waking: every post touches this sibling file; a wait watches it.
  const signal = `${dbPath}.signal`;
  if (!fs.existsSync(signal)) fs.writeFileSync(signal, "0");
  const touch = (seq: number): void => fs.writeFileSync(signal, String(seq));

  const now = (): string => new Date().toISOString();

  // Re-entrant: an inner call inside an open transaction joins it.
  let depth = 0;
  const transaction = <T>(fn: () => T): T => {
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
    worktree: r.worktree == null ? null : String(r.worktree),
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

  /** `named` overrides mention parsing: the board's own notices name their targets. */
  const insertMessage = (p: Participant, body: string, about: string | null, kind: MessageKind, named?: string[]): Message => {
    const mentions = named ?? (kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo)));
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

  const isLive = (id: number): boolean =>
    db.prepare("SELECT 1 FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ? AND p.ended_at IS NULL AND r.state = 'open'").get(id) !== undefined;

  // Paths: a claim is keyed by repository-relative path with forward slashes, so a file in a
  // worktree and the same file in the main checkout are one claim.
  const fold = (s: string): string => (CASELESS ? s.toLowerCase() : s);
  const slashes = (rel: string): string =>
    rel
      .split(/[\\/]+/)
      .filter((x) => x && x !== ".")
      .join("/");
  /** The checkout and every worktree registered on the repository, deepest first. */
  const roots = (repo: string): string[] => {
    const out = new Set<string>();
    if (path.basename(repo).toLowerCase() === ".git") out.add(path.resolve(path.dirname(repo)));
    const rows = db
      .prepare("SELECT DISTINCT p.worktree FROM participants p JOIN runs r ON r.id = p.run WHERE r.repo = ? AND p.worktree IS NOT NULL")
      .all(repo) as Row[];
    for (const r of rows) out.add(path.resolve(String(r.worktree)));
    return [...out].sort((a, b) => b.length - a.length);
  };
  /** Repository-relative with forward slashes; null for an absolute path outside every root. */
  const relPath = (repo: string, file: string): string | null => {
    if (!path.isAbsolute(file) && !file.startsWith("/")) return slashes(file) || null;
    const abs = fold(path.resolve(file));
    for (const root of roots(repo)) {
      const r = fold(root);
      if (abs.startsWith(r.endsWith(path.sep) ? r : r + path.sep)) return slashes(path.resolve(file).slice(root.length)) || null;
    }
    return null;
  };

  type ClaimRow = { participant: number; kind: string };
  const claimOf = (repo: string, rel: string): ClaimRow | null => {
    const r = db.prepare("SELECT participant, kind FROM claims WHERE repo = ? AND path = ?").get(repo, rel) as Row | undefined;
    return r ? { participant: Number(r.participant), kind: String(r.kind) } : null;
  };
  /** Claims `rel` for `p` unless another live runner holds it; returns that holder's claim. */
  const takeUnlessHeld = (p: Participant, rel: string, kind: "interface" | "inside"): ClaimRow | null =>
    transaction(() => {
      const held = claimOf(p.repo, rel);
      if (held && held.participant !== p.id && isLive(held.participant)) return held;
      if (held?.participant === p.id && (held.kind === "interface" || kind === "inside")) return null;
      db.prepare("INSERT OR REPLACE INTO claims (repo, path, participant, kind) VALUES (?, ?, ?, ?)").run(p.repo, rel, p.id, kind);
      return null;
    });
  const releaseAll = (id: number): void => {
    db.prepare("DELETE FROM claims WHERE participant = ?").run(id);
    db.prepare("DELETE FROM merge_locks WHERE participant = ?").run(id);
  };
  const declared = (id: number): Declared[] => JSON.parse(String((db.prepare("SELECT files FROM participants WHERE id = ?").get(id) as Row).files)) as Declared[];

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
        const p = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, slice) as Row | undefined;
        if (p) releaseAll(Number(p.id));
      });
    },

    closeRun(run) {
      runRow(run);
      transaction(() => {
        db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run);
        db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run);
        for (const p of db.prepare("SELECT id FROM participants WHERE run = ?").all(run) as Row[]) releaseAll(Number(p.id));
      });
      syncMarker();
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
      // the latest run of that plan holding that slice, an open one first
      const r = db
        .prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? ORDER BY (r.state = 'open') DESC, r.id DESC LIMIT 1`)
        .get(plan, slice) as Row | undefined;
      return r ? toParticipant(r) : null;
    },

    bind({ agentId, sessionId }, { run, plan, slice }) {
      const key = agentId ? `agent:${agentId}` : sessionId ? `session:${sessionId}` : null;
      if (!key) return;
      db.prepare("INSERT OR REPLACE INTO identities (key, run, plan, slice, at) VALUES (?, ?, ?, ?, ?)").run(key, run ?? null, plan ?? null, slice, now());
    },

    identify({ worktree, agentId, sessionId }) {
      const bound = (key: string): Participant | null => {
        const id = db.prepare("SELECT * FROM identities WHERE key = ?").get(key) as Row | undefined;
        if (!id) return null;
        // bound before the participant existed: resolved now, an open run first
        const r = (
          id.run != null
            ? db.prepare(`${PARTICIPANT_SQL} WHERE p.run = ? AND p.slice = ?`).get(Number(id.run), String(id.slice))
            : db
                .prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? AND r.state = 'open' ORDER BY r.id DESC LIMIT 1`)
                .get(String(id.plan), String(id.slice))
        ) as Row | undefined;
        if (!r) return null;
        const p = toParticipant(r);
        return isLive(p.id) ? p : null;
      };
      // a subagent carries its parent's session id: a session id names only the main conversation
      const known = agentId ? bound(`agent:${agentId}`) : sessionId ? bound(`session:${sessionId}`) : null;
      if (known) return known;
      if (!worktree) return null;
      const here = fold(path.resolve(worktree));
      const rows = (db.prepare(`${PARTICIPANT_SQL} WHERE p.worktree IS NOT NULL AND p.ended_at IS NULL AND r.state = 'open'`).all() as Row[]).filter(
        (r) => {
          const root = fold(String(r.worktree));
          return here === root || here.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
        },
      );
      if (!rows.length) return null;
      // the deepest worktree holding it; several runners on that one worktree is no answer
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
      const rows = db
        .prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL ORDER BY r.id, p.id`)
        .all(repo) as Row[];
      const cutoff = Date.now() - STALE_MS;
      return rows.map((r) => ({
        name: `${r.plan}/${r.slice}`,
        run: Number(r.run),
        plan: String(r.plan),
        slice: String(r.slice),
        doing: String(r.doing),
        files: JSON.parse(String(r.files)) as Declared[],
        stale: Date.parse(String(r.last_call ?? r.joined_at)) < cutoff,
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
        // the post hook delivers after every tool call: this is the runner's last call (D31)
        db.prepare("UPDATE participants SET last_call = ? WHERE id = ?").run(now(), me.id);
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

    checkEdit(p, file) {
      const me = live(p);
      const rel = relPath(me.repo, file);
      if (!rel) return { allowed: true }; // outside the repository: no claim
      const held = takeUnlessHeld(me, rel, "inside");
      if (!held) return { allowed: true };
      const holder = participantById(held.participant);
      const note = String((db.prepare("SELECT doing FROM participants WHERE id = ?").get(holder.id) as Row).doing) || "no note";
      return {
        allowed: false,
        refusal:
          `${rel} is held by ${holder.name} (${note}). Do not write it. ` +
          `Run \`swarm wait\` to hear when it is released, or settle it on the board: ` +
          `\`swarm post "@${holder.name} …"\`.`,
      };
    },

    reconcileWrites(p, changed) {
      const me = live(p);
      const flags: Flag[] = [];
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
          [holder.name, me.name],
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
        const r = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo) as Row | undefined;
        if (r && Number(r.participant) !== me.id && isLive(Number(r.participant))) {
          return { granted: false as const, holder: participantById(Number(r.participant)).name };
        }
        db.prepare("INSERT OR REPLACE INTO merge_locks (repo, participant, at) VALUES (?, ?, ?)").run(me.repo, me.id, now());
        return { granted: true as const };
      });
    },

    merged(p, sha, files) {
      const me = live(p);
      const rels = [...new Set(files.map((f) => relPath(me.repo, f)).filter((x): x is string => x !== null))];
      const wanted = new Set(rels);
      const told = new Set<string>();
      const iface = new Set<string>();
      transaction(() => {
        const lock = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo) as Row | undefined;
        if (lock && Number(lock.participant) !== me.id && isLive(Number(lock.participant))) {
          throw new Error(`the merge lock is held by ${participantById(Number(lock.participant)).name}, not ${me.name}`);
        }
        db.prepare("DELETE FROM merge_locks WHERE repo = ?").run(me.repo);
      });
      // holders of the files
      for (const rel of rels) {
        const c = claimOf(me.repo, rel);
        if (!c) continue;
        if (c.kind === "interface") iface.add(rel);
        if (c.participant !== me.id && isLive(c.participant)) told.add(participantById(c.participant).name);
      }
      // declarers, the merger's own declarations counting toward *interface*
      const everyone = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL`).all(me.repo) as Row[];
      for (const o of everyone) {
        for (const f of declared(Number(o.id))) {
          const rel = relPath(me.repo, f.path);
          if (!rel || !wanted.has(rel)) continue;
          if (f.interface) iface.add(rel);
          if (Number(o.id) !== me.id) told.add(`${o.plan}/${o.slice}`);
        }
      }
      // an interface change is announced to every runner on the repository (D26)
      const all = iface.size ? openPlans(me.repo).map((plan) => `${plan}/*`) : [];
      const lines = [`merged ${sha}: rebase onto ${sha}.`];
      if (told.size) lines.push(`${[...told].map((n) => `@${n}`).join(" ")}: you hold or declared a file it changed.`);
      if (iface.size) lines.push(`@all interface changed: ${[...iface].join(", ")}.`);
      lines.push(`files: ${rels.join(", ") || "-"}`);
      insertMessage(me, lines.join("\n"), null, "event", [...new Set([...told, ...all])]);
    },

    close() {
      db.close();
    },
  };
  return board;
}

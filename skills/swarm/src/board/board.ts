// The board — the ONLY module that sees SQL. Runs, the plan's slices, participants, the
// thread of each repository, who has had what, claims, the merge lock, who is calling,
// and waking a `wait`. Callers hold the typed Board openBoard() returns; the schema,
// runner names, mention parsing, path normalisation, refusal wording and the waking
// mechanism stay in here.
import fs from "node:fs";
import path from "node:path";
import { SQLITE_PATH } from "./home.ts";
import { nameHandle, parseMentions, planCode } from "./mentions.ts";
import { funnyName } from "./names.ts";

export type RunId = number;
/** `link`: the slice document's URL, opaque to the board (D44). */
export type SliceSpec = { id: string; title: string; blockers: string[]; link?: string | null };
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
  link: string | null; // the plan document's URL, opaque (D44)
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
  nick: string; // the funny name given at join (D43); "orchestrator" for an orchestrator
  ended: boolean;
  worktree: string | null; // registered at join; null for the orchestrator
}

export interface RosterEntry {
  name: string;
  nick: string;
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

/** What the page draws (D39). */
export type RunSummary = { run: number; plan: string; code: string; title: string; link: string | null; open: boolean; runners: number; done: number; of: number };
export type RepoSummary = { repo: string; name: string; runs: RunSummary[] };
export type RunnerState = "working" | "waiting" | "merging" | "watching" | "ended" | "done";
export type SnapshotRunner = {
  runner: string;
  nick: string;
  plan: string;
  slice: string;
  title: string;
  doing: string;
  state: RunnerState;
  stale: boolean;
  files: (Declared & { shared: boolean })[]; // shared: another live runner holds it too (D40)
  joined: string;
  calls: number;
  /** A background `wait --mentions` is pending: the runner hears the board while it works (D49). */
  listening: boolean;
};
export type SnapshotEvent = { seq: number; at: string; kind: MessageKind; from: string; body: string; about: string | null };
export type QueueSlice = { slice: string; title: string; link: string | null; state: string; blockers: string[]; runner: string | null };
/** A held file and every runner holding it, in claim order (D40): the FileMap's rows. */
export type SnapshotFile = { path: string; holders: string[]; interface: boolean };
/** The edit goes through; `notice` names the other holders the first time only, per runner and path. */
export type EditAllowed = { allowed: true; sharedWith: { runner: string; doing: string }[]; notice: string | null };
export type EditHeld = { allowed: false; refusal: string };
export type BoardSnapshot = {
  repo: string;
  name: string;
  runs: RunSummary[];
  lock: { holder: string; since: string } | null;
  roster: SnapshotRunner[];
  events: SnapshotEvent[];
  queues: Record<string, QueueSlice[]>;
  files: SnapshotFile[];
  flags: { path: string; runner: string }[];
};

export interface Board {
  openRun(input: { repo: string; plan: string; title: string; link?: string | null; slices: SliceSpec[] }): Run;
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
  /** Who is calling (D28): the one live runner whose worktree holds `worktree`. */
  identify(who: { worktree?: string }): Participant | null;
  setDoing(p: Participant, doing: string): void;
  /** Ends the runner and releases its claims and any merge lock it holds. */
  end(p: Participant): void;
  roster(repo: string): RosterEntry[];

  post(p: Participant, body: string, opts?: { about?: string; kind?: MessageKind }): Message;
  read(seq: number): Message;
  deliver(p: Participant): Delivery; // undelivered since last time; marks them delivered; stamps the last call
  /** The first delivery, or empty on timeout or once `p` has ended (D49). `mentionsOnly`: only a
   *  message that mentions `p` or is urgent ends it, and only those are marked delivered; the rest
   *  stays for the next `deliver`. */
  wait(p: Participant, opts?: { timeoutMs?: number; mentionsOnly?: boolean }): Promise<Delivery>;

  /** A claim before an edit of `path` (absolute, or repository-relative), `swarm claim` (D58).
   *  Free: claimed, silently. Held by others (D40, D41): `p`'s first claim is held until `p` has
   *  posted about the path mentioning a holder; then `p` holds it too, the other holders named
   *  once. `interface`: claimed as an interface, an `inside` claim of `p` widened. */
  checkEdit(p: Participant, path: string, opts?: { interface?: boolean }): EditAllowed | EditHeld;
  /** Paths written outside the claim: a free one is claimed, a held one flagged on the thread. */
  reconcileWrites(p: Participant, changed: string[]): Flag[];
  release(p: Participant, path: string): void;
  lockMerge(p: Participant): { granted: true } | { granted: false; holder: string };
  /** Releases the lock; tells whoever holds or declared one of `files` to rebase onto `sha`,
   *  every plan on the repository when one of them is an interface (D26). */
  merged(p: Participant, sha: string, files: string[]): void;

  // the page (D39)
  /** Every repository with an open run or one of the machine's last ten closed runs (D34). */
  repos(): RepoSummary[];
  /** Everything the page draws for one repository; throws `no repository <id>` for one it does not list. */
  snapshot(repo: string): BoardSnapshot;
  /** Called with the repository of every write, from this process or any other. Returns the unsubscribe. */
  onChange(listener: (repo: string) => void): () => void;

  close(): void;
}

const SLICE_STATES = new Set<SliceState>(["ready", "running", "done", "blocked"]);
const ORCHESTRATOR = "orchestrator";
/** A watch event can be missed (a coalesced write, a platform quirk); the store is re-read
 *  this often regardless, so a missed event costs at most this much. */
const WAIT_POLL_MS = 1000;
const LINE_WIDTH = 100;
const STALE_MS = 10 * 60 * 1000;
/** The page lists the machine's last this many closed runs (D34). */
const CLOSED_LISTED = 10;
/** The page shows the last this many messages of a thread. */
const EVENTS_SHOWN = 500;
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
  // here, not at module load, so a verb that never opens the store never pays for it.
  process.removeAllListeners("warning");
  process.on("warning", (w) => {
    if (w.name !== "ExperimentalWarning") console.warn(w);
  });
  const { DatabaseSync } = await import("node:sqlite");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
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
  // Schema upkeep for stores created by earlier versions: add a column when it is missing.
  const upkeep = (table: string, column: string, ddl: string): void => {
    const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  upkeep("participants", "worktree", "worktree TEXT");
  upkeep("participants", "last_call", "last_call TEXT");
  upkeep("participants", "calls", "calls INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "waiting", "waiting INTEGER NOT NULL DEFAULT 0");
  // 1 while a `wait --mentions` is pending: a listener, not a wait (D49)
  upkeep("participants", "listening", "listening INTEGER NOT NULL DEFAULT 0");
  upkeep("participants", "nick", "nick TEXT");
  // 1: written by the board itself in a runner's name (a flag, a merge notice), never a runner's own word
  upkeep("messages", "by_board", "by_board INTEGER NOT NULL DEFAULT 0");
  upkeep("runs", "link", "link TEXT");
  upkeep("slices", "link", "link TEXT");
  // a store from before D40 keys a claim by path alone: rebuild it keyed by holder too
  const claimKey = (db.prepare("PRAGMA table_info(claims)").all() as { name: string; pk: number }[]).find((c) => c.name === "participant");
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

  // Waking and watching: every write moves its repository's version and touches this sibling
  // file once committed; a wait and onChange watch it (one mechanism, D39).
  const signal = `${dbPath}.signal`;
  if (!fs.existsSync(signal)) fs.writeFileSync(signal, "0");
  let touches = 0;
  const touch = (): void => fs.writeFileSync(signal, `${process.pid}:${++touches}`);

  const now = (): string => new Date().toISOString();

  // Re-entrant: an inner call inside an open transaction joins it. The signal is touched
  // once, after the outermost commit, so a watcher never looks before the write is there.
  let depth = 0;
  let dirty = false;
  const transaction = <T>(fn: () => T): T => {
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
  /** A write to `repo`: its version moves, and the signal is touched after the commit. */
  const bump = (repo: string): void => {
    db.prepare("INSERT INTO changes (repo, version) VALUES (?, 1) ON CONFLICT (repo) DO UPDATE SET version = version + 1").run(repo);
    if (depth > 0) dirty = true;
    else touch();
  };
  /** A flag lives while a claim on its path does; a notice while both its holders' claims do. */
  const clearFlags = (): void => {
    db.prepare("DELETE FROM flags WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = flags.repo AND c.path = flags.path)").run();
    db.prepare(
      `DELETE FROM notices WHERE NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.participant)
         OR NOT EXISTS (SELECT 1 FROM claims c WHERE c.repo = notices.repo AND c.path = notices.path AND c.participant = notices.other)`,
    ).run();
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
    link: r.link == null ? null : String(r.link),
    state: r.state === "closed" ? "closed" : "open",
    slices: (db.prepare("SELECT * FROM slices WHERE run = ? ORDER BY ord").all(Number(r.id)) as Row[]).map((s) => ({
      id: String(s.id),
      title: String(s.title),
      link: s.link == null ? null : String(s.link),
      blockers: JSON.parse(String(s.blockers)) as string[],
      state: String(s.state) as SliceState,
    })),
  });

  /** A store from before D43 has runners with no funny name: their slice stands in. */
  const nickOf = (r: Row): string => (String(r.slice) === ORCHESTRATOR ? ORCHESTRATOR : r.nick == null ? String(r.slice) : String(r.nick));

  const PARTICIPANT_SQL = `SELECT p.*, r.repo, r.plan FROM participants p JOIN runs r ON r.id = p.run`;

  const toParticipant = (r: Row): Participant => ({
    id: Number(r.id),
    run: Number(r.run),
    repo: String(r.repo),
    plan: String(r.plan),
    slice: String(r.slice),
    name: `${r.plan}/${r.slice}`,
    nick: nickOf(r),
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

  /** The repository's active runners: their funny names, as a mention writes them, to their names (D43). */
  const activeNames = (repo: string): Map<string, string> => {
    const rows = db
      .prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL AND p.slice != '${ORCHESTRATOR}'`)
      .all(repo) as Row[];
    return new Map(rows.map((r) => [nameHandle(nickOf(r)), `${r.plan}/${r.slice}`]));
  };

  /** `named` overrides mention parsing: the board's own notices name their targets. */
  const insertMessage = (p: Participant, body: string, about: string | null, kind: MessageKind, named?: string[]): Message => {
    const mentions = named ?? (kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo), activeNames(p.repo)));
    const r = db
      .prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at, by_board) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(p.repo, p.id, body, about, kind, JSON.stringify(mentions), now(), named ? 1 : 0);
    const seq = Number(r.lastInsertRowid);
    bump(p.repo);
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

  type ClaimRow = { participant: number; kind: string; since: number };
  /** Every live holder of `rel`, in claim order. */
  const holdersOf = (repo: string, rel: string): ClaimRow[] =>
    (db.prepare("SELECT participant, kind, since_seq FROM claims WHERE repo = ? AND path = ? ORDER BY rowid").all(repo, rel) as Row[])
      .map((r) => ({ participant: Number(r.participant), kind: String(r.kind), since: Number(r.since_seq) }))
      .filter((c) => isLive(c.participant));
  /** `p` holds `rel` (alongside whoever else does); `interface` widens an inside claim, never the reverse.
   *  True when the claim was made or widened here. */
  const hold = (p: Participant, rel: string, kind: "interface" | "inside"): boolean =>
    transaction(() => {
      const r = db
        .prepare(
          `INSERT INTO claims (repo, path, participant, kind, since_seq) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (repo, path, participant) DO UPDATE SET kind = excluded.kind WHERE claims.kind = 'inside' AND excluded.kind = 'interface'`,
        )
        .run(p.repo, rel, p.id, kind, lastSeq());
      if (Number(r.changes) === 0) return false;
      bump(p.repo);
      return true;
    });
  /** Claims `rel` for `p` unless another live runner holds it: `held` is the other holders,
   *  `taken` says whether the claim was made or widened here. */
  const take = (p: Participant, rel: string, kind: "interface" | "inside"): { held: ClaimRow[]; taken: boolean } =>
    transaction(() => {
      const held = holdersOf(p.repo, rel).filter((c) => c.participant !== p.id);
      if (held.length) return { held, taken: false };
      return { held, taken: hold(p, rel, kind) };
    });
  const takeUnlessHeld = (p: Participant, rel: string, kind: "interface" | "inside"): void => void take(p, rel, kind);
  const doingOf = (id: number): string => String((db.prepare("SELECT doing FROM participants WHERE id = ?").get(id) as Row).doing) || "no note";
  /** Whether `p` has posted about `rel` mentioning one of `holders` since that holder claimed it (D41):
   *  the message's `about` is the path (or its tail), or its body names the path or its file name. */
  const hasPostedAbout = (p: Participant, rel: string, holders: ClaimRow[]): boolean => {
    const since = Math.min(...holders.map((h) => h.since));
    const rows = db.prepare("SELECT seq, body, about, mentions FROM messages WHERE repo = ? AND author = ? AND seq > ? AND kind != 'event' AND by_board = 0").all(p.repo, p.id, since) as Row[];
    const base = rel.split("/").pop()!;
    const names = (r: Row): boolean => {
      const about = r.about == null ? "" : fold(slashes(String(r.about)));
      const f = fold(rel);
      if (about && (about === f || f.endsWith(`/${about}`))) return true;
      const body = fold(String(r.body));
      return body.includes(f) || body.includes(fold(base));
    };
    return rows.some((r) => {
      if (!names(r)) return false;
      const mentions = JSON.parse(String(r.mentions)) as string[];
      return holders.some((h) => {
        const o = participantById(h.participant);
        return Number(r.seq) > h.since && (mentions.includes(o.name) || mentions.includes(`${o.plan}/*`));
      });
    });
  };
  const releaseAll = (id: number): void => {
    const owner = db.prepare("SELECT r.repo FROM participants p JOIN runs r ON r.id = p.run WHERE p.id = ?").get(id) as Row | undefined;
    const claims = Number(db.prepare("DELETE FROM claims WHERE participant = ?").run(id).changes);
    const locks = Number(db.prepare("DELETE FROM merge_locks WHERE participant = ?").run(id).changes);
    clearFlags();
    if (owner && claims + locks > 0) bump(String(owner.repo));
  };
  /** A runner inside a `wait` shows `waiting` on the page; inside a `wait --mentions`, `listening`
   *  beside its state: a background listener is pending almost all the time, the runner working. */
  const setWaiting = (p: Participant, on: boolean, column: "waiting" | "listening"): void =>
    transaction(() => {
      const r = db.prepare(`UPDATE participants SET ${column} = ? WHERE id = ? AND ${column} != ?`).run(on ? 1 : 0, p.id, on ? 1 : 0);
      if (Number(r.changes) > 0) bump(participantById(p.id).repo);
    });

  /** `fromWait`: a wait's own look is not a tool call of its own, so it counts no call.
   *  `mentionsOnly`: only what mentions `p` or is urgent is taken and marked; the rest stays. */
  const deliverTo = (p: Participant, fromWait: boolean, mentionsOnly = false): Delivery => {
    const me = participantById(p.id);
    const named = (m: Message): boolean => m.mentions.includes(me.name) || m.mentions.includes(`${me.plan}/*`);
    const messages = transaction(() => {
      const unseen = db
        .prepare(
          `SELECT m.* FROM messages m
           WHERE m.repo = ? AND m.seq > ? AND m.author != ?
             AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.participant = ? AND d.seq = m.seq)
           ORDER BY m.seq`,
        )
        .all(me.repo, Number((db.prepare("SELECT since_seq FROM participants WHERE id = ?").get(me.id) as Row).since_seq), me.id, me.id) as Row[];
      const rows = mentionsOnly ? unseen.filter((r) => r.kind === "urgent" || named(toMessage(r))) : unseen;
      const mark = db.prepare("INSERT INTO deliveries (participant, seq) VALUES (?, ?)");
      for (const r of rows) mark.run(me.id, Number(r.seq));
      // a delivery is a call to the board: the runner's last call (D31)
      db.prepare("UPDATE participants SET last_call = ? WHERE id = ?").run(now(), me.id);
      if (!fromWait) {
        db.prepare("UPDATE participants SET calls = calls + 1 WHERE id = ?").run(me.id);
        // a call after a wait that never returned (killed): the runner is no longer waiting
        const r = db.prepare("UPDATE participants SET waiting = 0 WHERE id = ? AND waiting = 1").run(me.id);
        if (Number(r.changes) > 0) bump(me.repo);
      }
      return rows.map(toMessage);
    });
    return {
      full: messages.filter(named),
      lines: messages.filter((m) => !named(m)).map(messageLine),
    };
  };

  // The page's view (D34, D39): open runs and the machine's last ten closed ones.
  const listedRuns = (): Row[] =>
    db
      .prepare(
        `SELECT * FROM runs WHERE state = 'open'
           OR id IN (SELECT id FROM runs WHERE state = 'closed' ORDER BY closed_at DESC, id DESC LIMIT ?)
         ORDER BY id`,
      )
      .all(CLOSED_LISTED) as Row[];
  const runSummary = (r: Row): RunSummary => {
    const id = Number(r.id);
    const count = (sql: string): number => Number((db.prepare(sql).get(id) as Row).n);
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
      of: count("SELECT COUNT(*) AS n FROM slices WHERE run = ?"),
    };
  };
  /** A repository is its common git dir; it is shown by its checkout's folder name. */
  const repoName = (repo: string): string => {
    const base = path.basename(repo);
    return base.toLowerCase() === ".git" ? path.basename(path.dirname(repo)) : base.replace(/\.git$/i, "");
  };

  // onChange: one watcher per open Board, shared by its listeners.
  const listeners = new Set<(repo: string) => void>();
  let watching: { close(): void } | null = null;
  let versions = new Map<string, number>();
  const readVersions = (): Map<string, number> =>
    new Map((db.prepare("SELECT repo, version FROM changes").all() as Row[]).map((r) => [String(r.repo), Number(r.version)]));

  const declared = (id: number): Declared[] => JSON.parse(String((db.prepare("SELECT files FROM participants WHERE id = ?").get(id) as Row).files)) as Declared[];

  const board: Board = {
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
        const p = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, slice) as Row | undefined;
        if (p) releaseAll(Number(p.id));
      });
    },

    closeRun(run) {
      runRow(run);
      transaction(() => {
        db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run);
        bump(String(runRow(run).repo));
        db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run);
        for (const p of db.prepare("SELECT id FROM participants WHERE run = ?").all(run) as Row[]) releaseAll(Number(p.id));
      });
    },

    runs() {
      return (db.prepare("SELECT * FROM runs WHERE state = 'open' ORDER BY id").all() as Row[]).map(toRun);
    },

    join({ run, slice, doing, files, worktree }) {
      const r = runRow(run);
      if (r.state !== "open") throw new Error(`run ${run} is closed`);
      if (slice === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      const where = worktree ? path.resolve(worktree) : null;
      // one transaction: the page sees a join as one change
      return transaction(() => {
      const id = transaction(() => {
        const existing = db.prepare("SELECT id, nick FROM participants WHERE run = ? AND slice = ?").get(run, slice) as Row | undefined;
        // a funny name no active runner of the repository carries (D43), kept for the run
        const fresh = (): string => {
          const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL`).all(String(r.repo)) as Row[];
          return funnyName(rows.map(nickOf));
        };
        if (existing) {
          db.prepare("UPDATE participants SET doing = ?, files = ?, worktree = ?, ended_at = NULL, nick = COALESCE(nick, ?) WHERE id = ?").run(
            doing,
            JSON.stringify(files),
            where,
            existing.nick == null ? fresh() : null,
            Number(existing.id),
          );
          return Number(existing.id);
        }
        const ins = db
          .prepare("INSERT INTO participants (run, slice, worktree, doing, files, since_seq, joined_at, nick) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(run, slice, where, doing, JSON.stringify(files), lastSeq(), now(), fresh());
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
      // the latest run of that plan holding that slice, an open one first
      const r = db
        .prepare(`${PARTICIPANT_SQL} WHERE r.plan = ? AND p.slice = ? ORDER BY (r.state = 'open') DESC, r.id DESC LIMIT 1`)
        .get(plan, slice) as Row | undefined;
      return r ? toParticipant(r) : null;
    },

    identify({ worktree }) {
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
      transaction(() => {
        insertMessage(fresh, "ended", null, "event");
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
        nick: nickOf(r),
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
      return deliverTo(p, false);
    },

    wait(p, opts = {}) {
      const { timeoutMs, mentionsOnly = false } = opts;
      participantById(p.id);
      const column = mentionsOnly ? "listening" : "waiting";
      setWaiting(p, true, column);
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
          try {
            setWaiting(p, false, column);
          } catch {}
          if (d instanceof Error) reject(d);
          else resolve(d);
        };
        const check = (): void => {
          if (settled) return;
          try {
            // `end`, from this process or another, releases a pending wait of that runner
            if (participantById(p.id).ended) return finish({ full: [], lines: [] });
            const d = deliverTo(p, true, mentionsOnly);
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
    checkEdit(p, file, opts = {}) {
      const kind = opts.interface ? "interface" : "inside";
      const me = live(p);
      const rel = relPath(me.repo, file);
      if (!rel) return { allowed: true, sharedWith: [], notice: null }; // outside the repository: no claim
      return transaction((): EditAllowed | EditHeld => {
        const all = holdersOf(me.repo, rel);
        const others = all.filter((c) => c.participant !== me.id);
        if (!others.length) {
          hold(me, rel, kind); // a free file: claimed, silently
          return { allowed: true, sharedWith: [], notice: null };
        }
        const people = others.map((c) => participantById(c.participant));
        if (!all.some((c) => c.participant === me.id)) {
          // the first edit of a file another runner holds: held until the runner has said what it changes (D41)
          if (!hasPostedAbout(me, rel, others)) {
            const who = people.map((o) => `${o.name} (${o.nick}: ${doingOf(o.id)})`).join(", ");
            const at = people.map((o) => `@${o.name}`).join(" ");
            return {
              allowed: false,
              refusal:
                `${rel} is also held by ${who}. You may share it, but first tell ${people.length > 1 ? "them" : "its holder"} what you change in it: ` +
                `\`swarm post "${at} …" --about ${rel}\`, then claim again.`,
            };
          }
        }
        hold(me, rel, kind); // a new holder, or an `inside` claim widened to an interface
        const sharedWith = people.map((o) => ({ runner: o.name, doing: doingOf(o.id) }));
        // told once per runner and path
        const told = db.prepare("INSERT OR IGNORE INTO notices (repo, path, participant, other) VALUES (?, ?, ?, ?)");
        const fresh = people.filter((o) => Number(told.run(me.repo, rel, me.id, o.id).changes) > 0);
        const notice = fresh.length ? fresh.map((o) => `${rel} is also held by ${o.name}: ${doingOf(o.id)}`).join("; ") : null;
        return { allowed: true, sharedWith, notice };
      });
    },

    reconcileWrites(p, changed) {
      const me = live(p);
      const flags: Flag[] = [];
      // one transaction: the page sees one change however many files
      return transaction(() => {
      const flag = db.prepare("INSERT OR IGNORE INTO flags (repo, path, participant) VALUES (?, ?, ?)");
      for (const file of changed) {
        const rel = relPath(me.repo, file);
        if (!rel) continue;
        // a file the writer shares with others is its own: nothing to flag (D40)
        if (holdersOf(me.repo, rel).some((c) => c.participant === me.id)) {
          take(me, rel, "inside");
          continue;
        }
        const { held: others, taken } = take(me, rel, "inside");
        // written outside the writer's claim: free and claimed now, or held by another (D39)
        if (taken || others.length) flag.run(me.repo, rel, me.id);
        if (!others.length) continue;
        const holder = participantById(others[0].participant);
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
        const r = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo) as Row | undefined;
        if (r && Number(r.participant) !== me.id && isLive(Number(r.participant))) {
          return { granted: false as const, holder: participantById(Number(r.participant)).name };
        }
        if (r && Number(r.participant) === me.id) return { granted: true as const };
        db.prepare("INSERT OR REPLACE INTO merge_locks (repo, participant, at) VALUES (?, ?, ?)").run(me.repo, me.id, now());
        bump(me.repo);
        return { granted: true as const };
      });
    },

    merged(p, sha, files) {
      const me = live(p);
      const rels = [...new Set(files.map((f) => relPath(me.repo, f)).filter((x): x is string => x !== null))];
      const wanted = new Set(rels);
      const told = new Set<string>();
      const iface = new Set<string>();
      // one transaction: the page sees the merge as one change
      transaction(() => {
      transaction(() => {
        const lock = db.prepare("SELECT participant FROM merge_locks WHERE repo = ?").get(me.repo) as Row | undefined;
        if (lock && Number(lock.participant) !== me.id && isLive(Number(lock.participant))) {
          throw new Error(`the merge lock is held by ${participantById(Number(lock.participant)).name}, not ${me.name}`);
        }
        db.prepare("DELETE FROM merge_locks WHERE repo = ?").run(me.repo);
      });
      // holders of the files
      // every holder of a merged path, a shared one included (D40)
      for (const rel of rels) {
        for (const c of holdersOf(me.repo, rel)) {
          if (c.kind === "interface") iface.add(rel);
          if (c.participant !== me.id) told.add(participantById(c.participant).name);
        }
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
      });
    },

    repos() {
      const byRepo = new Map<string, RunSummary[]>();
      for (const r of listedRuns()) {
        const list = byRepo.get(String(r.repo)) ?? [];
        list.push(runSummary(r));
        byRepo.set(String(r.repo), list);
      }
      // repositories with an open run first, then the most recent run first
      const latest = (runs: RunSummary[]): number => Math.max(...runs.map((x) => x.run));
      return [...byRepo.entries()]
        .map(([repo, runs]) => ({ repo, name: repoName(repo), runs }))
        .sort((a, b) => Number(b.runs.some((x) => x.open)) - Number(a.runs.some((x) => x.open)) || latest(b.runs) - latest(a.runs));
    },

    snapshot(repo) {
      const runRows = listedRuns().filter((r) => r.repo === repo);
      if (!runRows.length) throw new Error(`no repository ${repo}`);
      const runIds = runRows.map((r) => Number(r.id));
      const marks = runIds.map(() => "?").join(", ");

      const lockRow = db.prepare("SELECT participant, at FROM merge_locks WHERE repo = ?").get(repo) as Row | undefined;
      const lockHolder = lockRow && isLive(Number(lockRow.participant)) ? Number(lockRow.participant) : null;

      const sliceRows = db.prepare(`SELECT * FROM slices WHERE run IN (${marks}) ORDER BY run, ord`).all(...runIds) as Row[];
      const sliceOf = new Map(sliceRows.map((s) => [`${s.run}/${s.id}`, s]));
      const people = db.prepare(`${PARTICIPANT_SQL} WHERE p.run IN (${marks}) ORDER BY p.run, p.id`).all(...runIds) as Row[];
      const runOpen = new Map(runRows.map((r) => [Number(r.id), r.state === "open"]));
      const cutoff = Date.now() - STALE_MS;
      const claimsOf = db.prepare("SELECT path, kind FROM claims WHERE participant = ? ORDER BY rowid");
      // every live claim on the repository, in claim order: the FileMap's rows, and which paths are shared (D40)
      const live = (
        db.prepare("SELECT c.path, c.kind, c.participant, p.slice, r.plan FROM claims c JOIN participants p ON p.id = c.participant JOIN runs r ON r.id = p.run WHERE c.repo = ? ORDER BY c.rowid").all(repo) as Row[]
      ).filter((c) => isLive(Number(c.participant)));
      const files = new Map<string, SnapshotFile>();
      for (const c of live) {
        const f = files.get(String(c.path)) ?? { path: String(c.path), holders: [], interface: false };
        f.holders.push(`${c.plan}/${c.slice}`);
        f.interface ||= c.kind === "interface";
        files.set(f.path, f);
      }
      const sharedBy = (path: string, id: number): boolean => live.some((c) => String(c.path) === path && Number(c.participant) !== id);

      const roster: SnapshotRunner[] = people.map((r) => {
        const id = Number(r.id);
        const slice = String(r.slice);
        const orchestrator = slice === ORCHESTRATOR;
        const s = sliceOf.get(`${r.run}/${slice}`);
        const ended = r.ended_at != null;
        const state: RunnerState = orchestrator
          ? runOpen.get(Number(r.run))
            ? "watching"
            : "done"
          : s?.state === "done"
            ? "done"
            : ended
              ? "ended"
              : lockHolder === id
                ? "merging"
                : Number(r.waiting) === 1
                  ? "waiting"
                  : "working";
        return {
          runner: `${r.plan}/${slice}`,
          nick: nickOf(r),
          plan: String(r.plan),
          slice,
          title: orchestrator ? "" : String(s?.title ?? slice),
          doing: String(r.doing),
          state,
          stale: !ended && !orchestrator && Date.parse(String(r.last_call ?? r.joined_at)) < cutoff,
          files: (claimsOf.all(id) as Row[]).map((c) => ({ path: String(c.path), interface: c.kind === "interface", shared: sharedBy(String(c.path), id) })),
          joined: String(r.joined_at),
          calls: Number(r.calls ?? 0),
          listening: !ended && Number(r.listening) === 1,
        };
      });

      const events = (
        db.prepare("SELECT * FROM (SELECT * FROM messages WHERE repo = ? ORDER BY seq DESC LIMIT ?) ORDER BY seq").all(repo, EVENTS_SHOWN) as Row[]
      ).map((r) => {
        const m = toMessage(r);
        return { seq: m.seq, at: m.at, kind: m.kind, from: m.from, body: m.body, about: m.about };
      });

      const nameOf = new Map(people.map((r) => [`${r.run}/${r.slice}`, `${r.plan}/${r.slice}`]));
      const queues: Record<string, QueueSlice[]> = {};
      for (const run of runRows) {
        // a later run of the same plan on the repository replaces the earlier one
        queues[String(run.plan)] = sliceRows
          .filter((s) => Number(s.run) === Number(run.id))
          .map((s) => ({
            slice: String(s.id),
            title: String(s.title),
            link: s.link == null ? null : String(s.link),
            state: String(s.state),
            blockers: JSON.parse(String(s.blockers)) as string[],
            runner: nameOf.get(`${run.id}/${s.id}`) ?? null,
          }));
      }

      const flags = (
        db.prepare("SELECT f.path, p.slice, r.plan FROM flags f JOIN participants p ON p.id = f.participant JOIN runs r ON r.id = p.run WHERE f.repo = ? ORDER BY f.rowid").all(repo) as Row[]
      ).map((f) => ({ path: String(f.path), runner: `${f.plan}/${f.slice}` }));

      return {
        repo,
        name: repoName(repo),
        runs: runRows.map(runSummary),
        lock: lockHolder !== null ? { holder: participantById(lockHolder).name, since: String(lockRow!.at) } : null,
        roster,
        events,
        queues,
        files: [...files.values()],
        flags,
      };
    },

    onChange(listener) {
      listeners.add(listener);
      if (!watching) {
        versions = readVersions();
        const check = (): void => {
          let next: Map<string, number>;
          try {
            next = readVersions();
          } catch {
            return; // the store is busy or closing: the next look catches up
          }
          const moved = [...next].filter(([repo, v]) => versions.get(repo) !== v).map(([repo]) => repo);
          versions = next;
          for (const repo of moved) for (const l of [...listeners]) l(repo);
        };
        const watcher = fs.watch(signal, check);
        const poll = setInterval(check, WAIT_POLL_MS);
        // watching must never be what keeps a process alive
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
    },
  };
  return board;
}

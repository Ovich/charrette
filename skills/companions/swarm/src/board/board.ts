// The board — with claims.ts (D35), the only module that sees SQL. Runs, the plan's slices,
// participants, the thread of each repository, who has had what, who is calling,
// and waking a `wait`; claims and the merge lock live in claims.ts, behind this Board. Callers hold the typed Board openBoard() returns; the schema,
// runner names, mention parsing, path normalisation, refusal wording and the waking
// mechanism stay in here.
import fs from "node:fs";
import path from "node:path";
import { SQLITE_PATH } from "./home.ts";
import { nameHandle, parseMentions, planCode } from "./mentions.ts";
import { claimsOf, type HeldMergeLock } from "./claims.ts";
import { statsOf, summarize, type Stats, type StatsScope } from "./stats.ts";
import { type Kind, profileOf } from "./kinds.ts";
import { type EventName, type Subscription, EVENTS, formatSubscriptions, mentions as mentionsMe, parseSubscriptions as parseOn, wakes } from "./events.ts";
import { funnyName } from "./names.ts";

export type RunId = number;
export type { Kind } from "./kinds.ts";
export type { EventName, Subscription } from "./events.ts";
export type { HeldMergeLock } from "./claims.ts";
/** What a merge's rebase met, as the board records it: the conflicted files (repository-relative,
 *  maybe none), or unknown and why (board D13). The CLI's conflicts.ts answers in it. */
export type Conflicts = { files: string[] } | { unknown: "old-git" | "no-reflog" };
export type { Stats, StatsScope, Totals, RunStats, MemberStats, PlanRunStats, SharedFile, FileAcrossRuns, Interval, Mark, QuestionStats, BrainstormRunStats } from "./stats.ts";
/** A seat of a run (D22). `link`: the slice document's URL, opaque to the board (D44). */
export type SeatSpec = { id: string; title: string; role?: string; blockers: string[]; link?: string | null; on?: string[] };
/** Kept: the plan's own word (D41). */
export type SliceSpec = SeatSpec;
export type SliceState = "ready" | "running" | "done" | "blocked";
export type Slice = SliceSpec & { state: SliceState };
export type Declared = { path: string; interface: boolean }; // repository-relative
export type MessageKind = "msg" | "agreement" | "endorsement" | "urgent" | "event";
/** A file written outside its writer's claim while another runner holds it. */
export type Flag = { path: string; holder: string; seq: number };

export interface Run {
  id: RunId;
  repo: string;
  kind: Kind;
  plan: string;
  /** = plan, the same column (D44) */
  group: string;
  title: string;
  link: string | null; // the plan document's URL, opaque (D44)
  state: "open" | "closed";
  slices: Slice[];
}

export interface Participant {
  id: number;
  run: RunId;
  repo: string;
  kind: Kind;
  plan: string;
  slice: string; // "orchestrator" for a run's orchestrator
  name: string; // "<plan>/<slice>"
  nick: string; // the funny name given at join (D43), and to an orchestrator at open (plan D17)
  ended: boolean;
  worktree: string | null; // registered at join; null for the orchestrator
  /** A `wait --mentions` of this participant is pending (D49, D61). */
  listening: boolean;
  /** The events that wake its `wait --mentions`, besides mentions and urgent posts (D59). */
  subscriptions: Subscription[];
}

/** A merged path and another runner that holds it, or held it during the merger's run (D63). */
export interface Sharer {
  path: string;
  runner: string; // "<plan>/<slice>"
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
  subscriptions: Subscription[];
  worktree: string | null; // null for a seat or an orchestrator (D64)
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
  /** The author's run: a run is a label on the item, not a place (plan D1, D13). */
  run: RunId;
  /** The agreement an endorsement backs; null otherwise. */
  endorses: number | null;
  /** The board event it is, as posted (D59); null on a plain post and on rows from before. */
  event: EventName | null;
  /** On delivery only, to a holder of `about` when a runner that did not hold it posted about it:
   *  the agreement that answers it (D62). */
  answer?: string;
  /** A merged event's recipients as data (D11); null elsewhere and on rows from before. */
  meta?: MergedMeta | null;
  /** On post only: the refused claim this post settled (D7). */
  claimed?: { path: string; sharedWith: string[] };
}

/** Mentions in full, the rest one line each. `superseded`: a newer `wait` of the same runner
 *  started, so this one returned empty (D64). */
export type Delivery = { full: Message[]; lines: string[]; superseded?: true };

/** What the page draws (D39). */
export type RunSummary = { run: number; kind: Kind; plan: string; group: string; code: string; title: string; link: string | null; open: boolean; runners: number; done: number; of: number };
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
  /** When the runner ended, stored at `end`; null while it has not (D66). */
  ended: string | null;
  calls: number;
  /** A background `wait --mentions` is pending: the runner hears the board while it works (D49). */
  listening: boolean;
  /** Its subscriptions, as `formatSubscriptions` writes each (D59). */
  on: string[];
  /** Its last call to the board, else when it joined (D20: quiet n min). */
  lastCall: string;
};
/** What a merged event told, as data (D11): `rebase` holds or declared a changed file, `tell` is whom to tell of a resolved conflict,
 *  of a conflicted path only once the conflicts are known (D5). */
export type MergedMeta = { rebase: string[]; tell: string[] };
/** `event`, `mentions`, `meta`: absent on rows written before D11. */
export type SnapshotEvent = {
  seq: number;
  at: string;
  kind: MessageKind;
  from: string;
  body: string;
  about: string | null;
  /** The author's run; an old main row (stored null) reads its author's run (D13). */
  run: RunId;
  /** Kept beside `run`, equal to it, for the page until it reads `run`. */
  channel: RunId;
  event?: EventName | null;
  mentions?: string[];
  meta?: MergedMeta | null;
};
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
  /** `kind` defaults to plan; throws on an unknown kind. The group is stored as the plan (D44). */
  openRun(input: { repo: string; kind?: Kind; group: string; title: string; link?: string | null; seats: SeatSpec[] }): Run;
  /** `done` also releases the slice runner's claims and lock: the orchestrator's way to free a stale runner. */
  setSliceState(run: RunId, slice: string, state: SliceState): void;
  /** A seat added mid-run (D60): after the last, `ready`; refused on an id already in the run, an
   *  unknown blocker or a closed run. Posts an event with the run. */
  addSlice(run: RunId, spec: SeatSpec): Slice;
  /** Also archives the run: read-only from then on, `run <n> is closed` (D19). Posts the `closed` event with the run, before it closes (D67). */
  closeRun(run: RunId): void;
  /** Past the retention: closed runs (closed_at older), their seats, members not referenced by a
   *  kept message, their channels and deliveries; main messages older, agreements and the
   *  endorsements of kept agreements kept. Open runs never. The run's row stays, stamped `pruned_at`,
   *  never listed, so its id is never reused (D61). `now` for tests (D19, D20). */
  prune(now?: Date): { messages: number; runs: number };
  /** Reads, or writes then reads, a board setting. retention-days: a positive integer, default 30 (D32). */
  setting(name: "retention-days", value?: number): number;
  /** Flags in main, once, each open run whose every member made no call for ten minutes;
   *  a call by a member clears its run's mark. Returns the runs flagged now. */
  flagStale(now?: Date): RunId[];
  /** The board's upkeep when due (D16): `prune` then `flagStale`, when the last upkeep, kept in the
   *  store for every process, is older than UPKEEP_EVERY_MS. The time is recorded first, so a
   *  process due at the same moment skips, and a failure waits for the next due upkeep. True when it ran. */
  upkeepIfDue(now?: Date): boolean;
  /** The open runs, every repository. */
  runs(): Run[];

  /** `worktree` is ignored when the run's kind has none; `files` are refused when it has no claims.
   *  Declared files become claims where free (*interface* or *inside*); a held one stays declared only. */
  /** `on`, else the seat row's `on`, else the kind's defaults for a member (D59). */
  join(input: { run: RunId; slice: string; doing: string; files: Declared[]; worktree?: string; on?: Subscription[] }): {
    runner: Participant;
    roster: RosterEntry[];
  };
  participant(name: string): Participant | null; // "<plan>/<slice>" or "<plan>/orchestrator"
  /** Who is calling (D28): the one live runner whose worktree holds `worktree`. */
  identify(who: { worktree?: string }): Participant | null;
  setDoing(p: Participant, doing: string): void;
  /** Adds to the member's subscriptions; returns them after (D59). */
  subscribe(p: Participant, subs: Subscription[]): Subscription[];
  unsubscribe(p: Participant, subs: Subscription[]): Subscription[];
  /** Ends the runner and releases its claims and any merge lock it holds; its doing becomes
   *  "merged and ended" when it merged since it joined, else "ended" (D66). */
  end(p: Participant): void;
  roster(repo: string): RosterEntry[];

  /** Stored with the author's run, always (plan D1, D13). */
  post(p: Participant, body: string, opts?: { about?: string; kind?: MessageKind }): Message;
  /** An agreement backed; throws on a message that is not an agreement, or on one's own. */
  endorse(p: Participant, seq: number): Message;
  /** `by`: the runner reading, when known, counted as a call of its own (D66). */
  read(seq: number, by?: Participant): Message;
  deliver(p: Participant): Delivery; // own run's items + what wakes p from any run (plan D2); undelivered since last time; marks them delivered; stamps the last call
  /** The first delivery, or empty on timeout or once `p` has ended (D49). `mentionsOnly`: only a
   *  message that mentions `p`, is urgent, or is an event `p` subscribed to (D59) ends it, and only those are marked delivered; the rest
   *  stays for the next `deliver`. A runner has one live wait (D64): a newer `wait` of `p`, from
   *  any process, makes this one return at once, empty, with `superseded`. */
  wait(p: Participant, opts?: { timeoutMs?: number; mentionsOnly?: boolean }): Promise<Delivery>;

  /** A claim before an edit of `path` (absolute, or repository-relative), `swarm claim` (D58).
   *  Free: claimed, silently. Held by others (D40, D41): `p`'s first claim is held until `p` has
   *  posted about the path mentioning every holder; then `p` holds it too, the other holders named
   *  once. `interface`: claimed as an interface, an `inside` claim of `p` widened. */
  checkEdit(p: Participant, path: string, opts?: { interface?: boolean }): EditAllowed | EditHeld;
  // checkEdit, reconcileWrites, release, lockMerge, merged: refused when the caller's kind has no claims
  /** Paths written outside the claim: a free one is claimed, a held one flagged on the thread. */
  reconcileWrites(p: Participant, changed: string[]): Flag[];
  release(p: Participant, path: string): void;
  /** `reflogMark`: the length of the caller's HEAD reflog at the call, kept with a new grant so `merged` replays only a later rebase (D36). */
  lockMerge(p: Participant, onto?: string, reflogMark?: number): { granted: true } | { granted: false; holder: string };
  /** Releases the lock; tells whoever holds or declared one of `files` to rebase onto `sha`,
   *  every plan on the repository when one of them is an interface (D26). Returns, for each
   *  merged path, every other runner that holds it, or held it during `p`'s run (D63); once `conflicts` are known,
   *  of a conflicted path only (D5). Records the merge with its conflicts, absent recorded as unknown (D25). */
  merged(p: Participant, sha: string, files: string[], conflicts?: Conflicts): Sharer[];
  /** The merge lock `p` holds, its grant time, branch and reflog mark, for the CLI to replay the rebase since (D33, D36); null when it holds none. */
  heldMergeLock(p: Participant): HeldMergeLock | null;
  /** The figures of the scope's runs (D33, D34): one read, no write; a figure not recorded or not computed yet is null, never 0. */
  stats(scope: StatsScope): Stats;

  // the page (D39)
  /** Every repository with an open run or a closed run within the retention (D46); a run kept only as a pruned author never. */
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
/** A pending wait's looks are logged in call_log at most this often: well under STALE_MS, never a row per tick. */
const WAIT_LOG_EVERY_MS = 60 * 1000;
/** The board's upkeep runs at most this often, from any process (D16). */
export const UPKEEP_EVERY_MS = 5 * 60 * 1000;
/** The settings row holding the last upkeep's time, ISO: the board's own, never a user setting. */
const LAST_UPKEEP = "last-upkeep";
/** The settings row holding when the analytics records began, ISO: the board's own (D33). */
const RECORDS_SINCE = "records-since";
const RETENTION_DEFAULT_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
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
  // the analytics records (call_log, lock_requests, run_stats) start with the store that first creates them:
  // a run opened before reads recorded: false (D33)
  const recordsAreNew = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'call_log'").get() === undefined;
  db.exec(`
    PRAGMA journal_mode = DELETE;
    -- Several CLI processes write, and aiview reads, concurrently; without a busy timeout a
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
    -- one row per merge, written by merged, deleted with its run by prune (D25): files and conflicts JSON, conflicts NULL for unknown
    CREATE TABLE IF NOT EXISTS merges (
      participant INTEGER NOT NULL,
      run INTEGER NOT NULL,
      sha TEXT NOT NULL,
      at TEXT NOT NULL,
      files TEXT NOT NULL,
      conflicts TEXT
    );
    CREATE INDEX IF NOT EXISTS merges_run ON merges (run);
    -- one row per counted call, written by countCall in the verb's transaction (D25); deleted with its run
    CREATE TABLE IF NOT EXISTS call_log (participant INTEGER NOT NULL, at TEXT NOT NULL, verb TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS call_log_by_participant ON call_log (participant, at);
    -- one row per merge-lock turn: asked, granted, merged; refused counts the refusals (D25); deleted with its run
    CREATE TABLE IF NOT EXISTS lock_requests (repo TEXT NOT NULL, participant INTEGER NOT NULL, asked_at TEXT NOT NULL,
      granted_at TEXT, merged_at TEXT, refused INTEGER NOT NULL DEFAULT 0);
    CREATE INDEX IF NOT EXISTS lock_requests_by_participant ON lock_requests (participant, asked_at);
    -- a closed run's figures, RunStats JSON, written once at close or by prune first; never pruned (D20, D21)
    CREATE TABLE IF NOT EXISTS run_stats (run INTEGER PRIMARY KEY, repo TEXT NOT NULL, kind TEXT NOT NULL,
      closed_at TEXT NOT NULL, body TEXT NOT NULL);
    -- board settings (D32): retention-days; the board's own last-upkeep (D16)
    CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
    -- the identities and hook_seen tables, left in stores from before D58, are no longer read or written
  `);
  if (recordsAreNew) db.prepare("INSERT OR IGNORE INTO settings (name, value) VALUES (?, ?)").run(RECORDS_SINCE, new Date().toISOString());
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
  // moved by every `wait` start: a pending wait whose number is no longer this one is superseded (D64)
  upkeep("participants", "wait_gen", "wait_gen INTEGER NOT NULL DEFAULT 0");
  // 1 once the runner has called `merged` since it joined: what `end` writes as its doing (D66)
  upkeep("participants", "merged", "merged INTEGER NOT NULL DEFAULT 0");
  // 1: written by the board itself in a runner's name (a flag, a merge notice), never a runner's own word
  upkeep("messages", "by_board", "by_board INTEGER NOT NULL DEFAULT 0");
  upkeep("runs", "link", "link TEXT");
  // a board event's data beside its text: a merged event's recipients (D11)
  upkeep("messages", "meta", "meta TEXT");
  // the branch a merge lands in, named by merge-lock --onto (D9)
  upkeep("merge_locks", "onto", "onto TEXT");
  // the holder's HEAD reflog length at the grant: merged replays only a rebase past it (D36)
  upkeep("merge_locks", "reflog_mark", "reflog_mark INTEGER");
  upkeep("slices", "link", "link TEXT");
  // what kind of work a run is (D25); a run from before is a plan run
  upkeep("runs", "kind", "kind TEXT NOT NULL DEFAULT 'plan'");
  // a message's run (D31, plan D13): its author's run; null on an old main row, read as its author's run
  upkeep("messages", "run", "run INTEGER");
  upkeep("messages", "endorses", "endorses INTEGER");
  // 1 once the run's stale event is in main; any member call resets it (D19)
  upkeep("runs", "stale_flagged", "stale_flagged INTEGER NOT NULL DEFAULT 0");
  // 1 once an orchestrator's quiet event is posted; its next call posts back and resets it (D15)
  upkeep("participants", "quiet_flagged", "quiet_flagged INTEGER NOT NULL DEFAULT 0");
  // set when prune removed the run's contents; the row stays so its id is never reused (D61): never listed
  upkeep("runs", "pruned_at", "pruned_at TEXT");
  // the board event a message is (D59); null on plain posts and rows from before
  upkeep("messages", "event", "event TEXT");
  // a member's subscriptions, JSON (D59)
  upkeep("participants", "subs", "subs TEXT NOT NULL DEFAULT '[]'");
  // the seats file's `on`, JSON (D59)
  upkeep("slices", "on_events", "on_events TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS messages_channel ON messages (repo, run, seq)");
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

  const runRow = (id: RunId): Row => {
    const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as Row | undefined;
    if (!r) throw new Error(`unknown run ${id}`);
    return r;
  };

  const toRun = (r: Row): Run => ({
    id: Number(r.id),
    repo: String(r.repo),
    kind: profileOf(String(r.kind ?? "plan")).kind,
    plan: String(r.plan),
    group: String(r.plan),
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

  /** A store from before D43 has members with no funny name: their slice stands in (an orchestrator's before plan D17 too). */
  const nickOf = (r: Row): string => (r.nick == null ? String(r.slice) : String(r.nick));

  /** A subscription stored scoped `main` (before plan D1) reads as `any`. */
  /** A funny name no active member of the repository carries (D43, plan D17), kept for the run. */
  const unusedNick = (repo: string): string => {
    const rows = db.prepare(`${PARTICIPANT_SQL} WHERE r.repo = ? AND r.state = 'open' AND p.ended_at IS NULL`).all(repo) as Row[];
    return funnyName(rows.map(nickOf));
  };

  const subsOf = (r: Row): Subscription[] =>
    (JSON.parse(String(r.subs ?? "[]")) as { event: Subscription["event"]; scope: string }[]).map((x) => ({ event: x.event, scope: x.scope === "run" ? "run" : "any" }));

  const PARTICIPANT_SQL = `SELECT p.*, r.repo, r.plan, r.kind FROM participants p JOIN runs r ON r.id = p.run`;

  const toParticipant = (r: Row): Participant => ({
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
    subscriptions: subsOf(r),
  });

  const participantById = (id: number): Participant => toParticipant(db.prepare(`${PARTICIPANT_SQL} WHERE p.id = ?`).get(id) as Row);

  const toMessage = (r: Row): Message => {
    const author = participantById(Number(r.author));
    return {
    seq: Number(r.seq),
    repo: String(r.repo),
    from: author.name,
    body: String(r.body),
    about: r.about == null ? null : String(r.about),
    kind: String(r.kind) as MessageKind,
    mentions: JSON.parse(String(r.mentions)) as string[],
    at: String(r.at),
    // an old main row (null) is labelled with its author's run (plan D13)
    run: r.run == null ? author.run : Number(r.run),
    endorses: r.endorses == null ? null : Number(r.endorses),
    event: r.event == null || !Object.hasOwn(EVENTS, String(r.event)) ? null : (String(r.event) as EventName),
    meta: r.meta == null ? null : (JSON.parse(String(r.meta)) as MergedMeta),
    };
  };

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
  const insertMessage = (
    p: Participant,
    body: string,
    about: string | null,
    kind: MessageKind,
    named?: string[],
    extra: { endorses?: number; event?: EventName; meta?: MergedMeta } = {},
  ): Message => {
    const mentions = named ?? (kind === "event" ? [] : parseMentions(body, p.plan, openPlans(p.repo), activeNames(p.repo)));
    // every item is stored with its author's run (plan D1, D13)
    const run = p.run;
    // a closed run is read-only (D19)
    if (runRow(run).state === "closed") throw new Error(`run ${run} is closed`);
    const r = db
      .prepare("INSERT INTO messages (repo, author, body, about, kind, mentions, at, by_board, run, endorses, event, meta) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(p.repo, p.id, body, about, kind, JSON.stringify(mentions), now(), named ? 1 : 0, run, extra.endorses ?? null, extra.event ?? null, extra.meta ? JSON.stringify(extra.meta) : null);
    const seq = Number(r.lastInsertRowid);
    bump(p.repo);
    return board.read(seq);
  };

  /** A code verb on a kind with no claims is refused before any write (D22, D25). */
  const gated = (p: Participant, verb: string): Participant => {
    if (!profileOf(p.kind).claims) throw new Error(`${verb}: a ${p.kind} run has no claims`);
    return p;
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

  const doingOf = (id: number): string => String((db.prepare("SELECT doing FROM participants WHERE id = ?").get(id) as Row).doing) || "no note";
  const claims = claimsOf({ db, transaction, bump, now, lastSeq, participantById, isLive, insertMessage, relPath, fold, slashes, doingOf });
  /** `fromWait`: a wait's own look, not a call of the runner's.
   *  `mentionsOnly`: only what mentions `p` or is urgent is taken and marked; the rest stays. */
  const deliverTo = (p: Participant, fromWait: boolean, mentionsOnly = false): Delivery => {
    const me = participantById(p.id);
    // from any run, an agreement or endorsement about a path the caller holds is for it too (D26, plan D2)
    const named = (m: Message): boolean =>
      mentionsMe(m, me) ||
      ((m.kind === "agreement" || m.kind === "endorsement") && m.about != null && claims.holds(me, m.about));
    const messages = transaction(() => {
      const unseen = db
        .prepare(
          `SELECT m.* FROM messages m
           WHERE m.repo = ? AND m.seq > ? AND m.author != ?
             AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.participant = ? AND d.seq = m.seq)
           ORDER BY m.seq`,
        )
        .all(me.repo, Number((db.prepare("SELECT since_seq FROM participants WHERE id = ?").get(me.id) as Row).since_seq), me.id, me.id) as Row[];
      // a wake (D59): a mention, an urgent post, or an event the caller subscribed to in its scope
      const woken = (r: Row): boolean => named(toMessage(r)) || wakes(toMessage(r), me, me.subscriptions);
      // of its own run, everything; of another run, only what wakes the caller (plan D2)
      const heard = unseen.filter((r) => toMessage(r).run === me.run || woken(r));
      const rows = mentionsOnly ? heard.filter(woken) : heard;
      const mark = db.prepare("INSERT INTO deliveries (participant, seq) VALUES (?, ?)");
      for (const r of rows) mark.run(me.id, Number(r.seq));
      // a delivery is a call to the board: the runner's last call (D31)
      const at = now();
      db.prepare("UPDATE participants SET last_call = ? WHERE id = ?").run(at, me.id);
      // a wait's look is a sign of life by the stale rule, so the timeline logs it too (board D12, D37); a wait looks
      // every second, so at most one row a minute. A deliver verb is logged by countCall instead
      if (fromWait) {
        const last = db.prepare("SELECT MAX(at) AS at FROM call_log WHERE participant = ?").get(me.id) as Row;
        if (last.at == null || Date.parse(at) - Date.parse(String(last.at)) >= WAIT_LOG_EVERY_MS) {
          db.prepare("INSERT INTO call_log (participant, at, verb) VALUES (?, ?, 'deliver')").run(me.id, at);
        }
      }
      if (!fromWait) {
        // a call after a wait that never returned (killed): the runner is no longer waiting
        const r = db.prepare("UPDATE participants SET waiting = 0 WHERE id = ? AND waiting = 1").run(me.id);
        if (Number(r.changes) > 0) bump(me.repo);
      }
      return rows.map((r) => {
        const m = toMessage(r);
        const rel = r.by_board || m.kind !== "msg" || !m.about || !named(m) ? null : claims.askedAbout(me, Number(r.author), m);
        return rel ? { ...m, answer: `answer with an agreement on who changes what: swarm agree "<who changes what in ${rel}>" --about ${rel}` } : m;
      });
    });
    // a wait --mentions gives what woke it in full; deliver, mentions in full and the rest one line
    const full = (m: Message): boolean => named(m) || (mentionsOnly && wakes(m, me, me.subscriptions));
    return {
      full: messages.filter(full),
      lines: messages.filter((m) => !full(m)).map(messageLine),
    };
  };

  const retentionDays = (): number => {
    const r = db.prepare("SELECT value FROM settings WHERE name = 'retention-days'").get() as Row | undefined;
    return r ? Number(r.value) : RETENTION_DEFAULT_DAYS;
  };
  const retentionCutoff = (at: Date): string => new Date(at.getTime() - retentionDays() * DAY_MS).toISOString();

  // The page's view (D39, D46): open runs and every closed run within the retention.
  const listedRuns = (): Row[] =>
    db
      .prepare("SELECT * FROM runs WHERE pruned_at IS NULL AND (state = 'open' OR (state = 'closed' AND closed_at >= ?)) ORDER BY id")
      .all(retentionCutoff(new Date())) as Row[];
  const runSummary = (r: Row): RunSummary => {
    const id = Number(r.id);
    const count = (sql: string): number => Number((db.prepare(sql).get(id) as Row).n);
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


  const insertSlice = (run: RunId, s: SeatSpec, ord: number): void => {
    if (s.on) parseOn(s.on); // an unknown event name is refused at open, not at join
    db.prepare("INSERT INTO slices (run, id, title, blockers, link, ord, on_events) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      run,
      s.id,
      s.title,
      JSON.stringify(s.blockers ?? []),
      s.link ?? null,
      ord,
      s.on ? JSON.stringify(s.on) : null,
    );
  };

  const setSubs = (p: Participant, subs: Subscription[]): Subscription[] => {
    db.prepare("UPDATE participants SET subs = ? WHERE id = ?").run(JSON.stringify(subs), p.id);
    bump(p.repo);
    return subs;
  };
  const sameSub = (a: Subscription, b: Subscription): boolean => a.event === b.event && a.scope === b.scope;

  /** The closed run's summary into run_stats (D20); summarize reads, this writes. */
  const storeRunStats = (run: RunId): void => {
    const body = summarize(db, run, STALE_MS);
    const r = runRow(run);
    db.prepare("INSERT OR REPLACE INTO run_stats (run, repo, kind, closed_at, body) VALUES (?, ?, ?, ?, ?)").run(run, String(r.repo), body.kind, String(r.closed_at), JSON.stringify(body));
  };

  const board: Board = {
    openRun({ repo, kind = "plan", group, title, link, seats }) {
      const profile = profileOf(kind);
      const id = transaction(() => {
        // the group is stored as the plan (D44)
        const r = db.prepare("INSERT INTO runs (repo, kind, plan, title, link, opened_at) VALUES (?, ?, ?, ?, ?, ?)").run(repo, profile.kind, group, title, link ?? null, now());
        const run = Number(r.lastInsertRowid);
        seats.forEach((s, i) => insertSlice(run, s, i));
        // a funny name as a member gets at join (plan D17)
        const orchestrator = db.prepare("INSERT INTO participants (run, slice, since_seq, joined_at, subs, nick) VALUES (?, ?, ?, ?, ?, ?)").run(
          run,
          ORCHESTRATOR,
          lastSeq(),
          now(),
          JSON.stringify(profile.defaults.orchestrator),
          unusedNick(repo),
        );
        // stored with the run it opens; a member subscribed to any:opened wakes (D69)
        insertMessage(participantById(Number(orchestrator.lastInsertRowid)), `run ${run} opened: ${profile.kind} ${group}, ${title}`, null, "event", undefined, {
          event: EVENTS.opened.name,
        });
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
        if (p) claims.releaseAll(Number(p.id));
      });
    },

    addSlice(run, spec) {
      const r = runRow(run);
      if (r.state !== "open") throw new Error(`run ${run} is closed`);
      if (spec.id === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      return transaction(() => {
        const ids = (db.prepare("SELECT id FROM slices WHERE run = ?").all(run) as Row[]).map((x) => String(x.id));
        if (ids.includes(spec.id)) throw new Error(`slice ${spec.id} is already in run ${run}`);
        const unknown = (spec.blockers ?? []).filter((b) => !ids.includes(b));
        if (unknown.length) throw new Error(`unknown blocker ${unknown.join(", ")} in run ${run}`);
        const ord = Number((db.prepare("SELECT COALESCE(MAX(ord), -1) AS o FROM slices WHERE run = ?").get(run) as Row).o) + 1;
        insertSlice(run, spec, ord);
        const orchestrator = db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, ORCHESTRATOR) as Row;
        insertMessage(participantById(Number(orchestrator.id)), `added ${spec.id}: ${spec.title}`, null, "event");
        return toRun(runRow(run)).slices.find((x) => x.id === spec.id)!;
      });
    },

    closeRun(run) {
      runRow(run);
      transaction(() => {
        // stored with the run it closes, before it closes; a member subscribed to any:closed wakes (D67)
        const author = (db.prepare("SELECT id FROM participants WHERE run = ? AND slice = ?").get(run, ORCHESTRATOR) ??
          db.prepare("SELECT id FROM participants WHERE run = ? ORDER BY id LIMIT 1").get(run)) as Row | undefined;
        if (author) insertMessage(participantById(Number(author.id)), `run ${run} closed`, null, "event", undefined, { event: EVENTS.closed.name });
        db.prepare("UPDATE runs SET state = 'closed', closed_at = ? WHERE id = ?").run(now(), run);
        bump(String(runRow(run).repo));
        db.prepare("UPDATE participants SET ended_at = COALESCE(ended_at, ?) WHERE run = ?").run(now(), run);
        // the run's figures, kept past pruning, read while its claims still say which are interfaces (D37); the summary
        // only reads before its one write, so a failure leaves the close whole: close succeeds, prune writes it later (D25)
        try {
          storeRunStats(run);
        } catch {}
        for (const p of db.prepare("SELECT id FROM participants WHERE run = ?").all(run) as Row[]) claims.releaseAll(Number(p.id));
      });
    },

    prune(at = new Date()) {
      return transaction(() => {
        const cutoff = retentionCutoff(at);
        // a run with no summary is summarized before its raw rows go; one whose summary throws keeps them for the next upkeep (D33)
        const expired = (db.prepare("SELECT id, repo FROM runs WHERE state = 'closed' AND closed_at < ? AND pruned_at IS NULL").all(cutoff) as Row[]).filter((r) => {
          if (db.prepare("SELECT 1 FROM run_stats WHERE run = ?").get(Number(r.id))) return true;
          try {
            storeRunStats(Number(r.id));
            return true;
          } catch {
            return false;
          }
        });
        const touched = new Set(expired.map((r) => String(r.repo)));
        const runIds = expired.map((r) => Number(r.id));
        const inExpired = runIds.length ? `run IN (${runIds.join(", ")})` : "0";
        // kept: every agreement in main, and the endorsements of those agreements (D20)
        const doomed = db
          .prepare(
            `SELECT seq, repo FROM messages WHERE ${inExpired}
               OR (run IS NULL AND at < ? AND kind != 'agreement'
                   AND NOT (kind = 'endorsement' AND endorses IN (SELECT seq FROM messages WHERE run IS NULL AND kind = 'agreement')))`,
          )
          .all(cutoff) as Row[];
        const dropDeliveries = db.prepare("DELETE FROM deliveries WHERE seq = ?");
        const dropMessage = db.prepare("DELETE FROM messages WHERE seq = ?");
        for (const m of doomed) {
          dropDeliveries.run(Number(m.seq));
          dropMessage.run(Number(m.seq));
          touched.add(String(m.repo));
        }
        for (const run of runIds) {
          for (const r of db.prepare("SELECT id FROM participants WHERE run = ?").all(run) as Row[]) {
            const id = Number(r.id);
            for (const table of ["claim_log", "notices", "flags", "claims", "lock_waiters", "merge_locks", "deliveries", "claim_requests", "flag_posts", "call_log", "lock_requests"]) {
              db.prepare(`DELETE FROM ${table} WHERE participant = ?`).run(id);
            }
            db.prepare("DELETE FROM notices WHERE other = ?").run(id);
            // a member authoring a kept message stays, so the message still reads its author
            if (!db.prepare("SELECT 1 FROM messages WHERE author = ? LIMIT 1").get(id)) db.prepare("DELETE FROM participants WHERE id = ?").run(id);
          }
          db.prepare("DELETE FROM slices WHERE run = ?").run(run);
          db.prepare("DELETE FROM merges WHERE run = ?").run(run);
          // the row stays, stamped: its id is never handed to a new run (D61)
          db.prepare("UPDATE runs SET pruned_at = ? WHERE id = ?").run(at.toISOString(), run);
        }
        for (const repo of touched) bump(repo);
        return { messages: doomed.length, runs: runIds.length };
      });
    },

    setting(name, value) {
      if (name !== "retention-days") throw new Error(`unknown setting ${name}`);
      if (value !== undefined) {
        if (!Number.isInteger(value) || value < 1) throw new Error(`${name} takes a positive whole number of days, got ${value}`);
        db.prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").run(name, String(value));
      }
      return retentionDays();
    },

    upkeepIfDue(at = new Date()) {
      // never ran, or an unreadable time: due
      const due = (): boolean => {
        const r = db.prepare("SELECT value FROM settings WHERE name = ?").get(LAST_UPKEEP) as Row | undefined;
        return !(at.getTime() - Date.parse(String(r?.value)) < UPKEEP_EVERY_MS);
      };
      // a plain read first: a pending wait asks every tick, and only a due upkeep takes the write lock
      if (!due()) return false;
      const recorded = transaction(() => {
        if (!due()) return false; // another process recorded it between the read and the lock
        db.prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value").run(LAST_UPKEEP, at.toISOString());
        return true;
      });
      if (!recorded) return false;
      board.prune(at);
      board.flagStale(at);
      return true;
    },

    flagStale(at = new Date()) {
      const silentBefore = at.getTime() - STALE_MS;
      return transaction(() => {
        // an orchestrator silent STALE_MS: one quiet event in its run, until it calls again (D15)
        const quiet = db
          .prepare("SELECT p.id, p.last_call, p.joined_at FROM participants p JOIN runs r ON r.id = p.run WHERE r.state = 'open' AND p.slice = ? AND p.ended_at IS NULL AND p.quiet_flagged = 0")
          .all(ORCHESTRATOR) as Row[];
        for (const o of quiet) {
          const silentSince = Date.parse(String(o.last_call ?? o.joined_at));
          if (silentSince >= silentBefore) continue;
          const minutes = Math.floor((at.getTime() - silentSince) / 60_000);
          insertMessage(participantById(Number(o.id)), `quiet ${minutes} min`, null, "event", [], { event: EVENTS.quiet.name });
          db.prepare("UPDATE participants SET quiet_flagged = 1 WHERE id = ?").run(Number(o.id));
        }
        const flagged: RunId[] = [];
        for (const r of db.prepare("SELECT id, plan FROM runs WHERE state = 'open' AND stale_flagged = 0 ORDER BY id").all() as Row[]) {
          const id = Number(r.id);
          const members = db.prepare("SELECT id, slice, last_call, joined_at FROM participants WHERE run = ? AND ended_at IS NULL").all(id) as Row[];
          if (!members.length || members.some((m) => Date.parse(String(m.last_call ?? m.joined_at)) >= silentBefore)) continue;
          const author = members.find((m) => String(m.slice) === ORCHESTRATOR) ?? members[0];
          const group = String(r.plan);
          insertMessage(participantById(Number(author.id)), `run ${id} (${group}) is stale: every member silent; close it or dispatch again`, null, "event", [`${group}/${ORCHESTRATOR}`], {
            event: EVENTS.stale.name,
          });
          db.prepare("UPDATE runs SET stale_flagged = 1 WHERE id = ?").run(id);
          flagged.push(id);
        }
        return flagged;
      });
    },

    runs() {
      return (db.prepare("SELECT * FROM runs WHERE state = 'open' ORDER BY id").all() as Row[]).map(toRun);
    },

    join({ run, slice, doing, files, worktree, on }) {
      const r = runRow(run);
      if (r.state !== "open") throw new Error(`run ${run} is closed`);
      if (slice === ORCHESTRATOR) throw new Error(`"${ORCHESTRATOR}" is not a slice`);
      const profile = profileOf(String(r.kind ?? "plan"));
      if (files.length && !profile.claims) throw new Error(`join: a ${profile.kind} run has no claims`);
      // a kind with no worktree records none, whatever the caller passed (D21)
      const where = worktree && profile.worktree ? path.resolve(worktree) : null;
      // one transaction: the page sees a join as one change
      return transaction(() => {
      const id = transaction(() => {
        const existing = db.prepare("SELECT id, nick FROM participants WHERE run = ? AND slice = ?").get(run, slice) as Row | undefined;
        // --on, else the seat row's on, else the kind's defaults (D59)
        const seatRow = db.prepare("SELECT on_events FROM slices WHERE run = ? AND id = ?").get(run, slice) as Row | undefined;
        const seatOn = seatRow?.on_events != null ? parseOn(JSON.parse(String(seatRow.on_events)) as string[]) : null;
        const subs = JSON.stringify(on ?? seatOn ?? profile.defaults.member);
        const fresh = (): string => unusedNick(String(r.repo));
        if (existing) {
          db.prepare("UPDATE participants SET doing = ?, files = ?, worktree = ?, ended_at = NULL, merged = 0, subs = ?, nick = COALESCE(nick, ?) WHERE id = ?").run(
            doing,
            JSON.stringify(files),
            where,
            subs,
            existing.nick == null ? fresh() : null,
            Number(existing.id),
          );
          return Number(existing.id);
        }
        const ins = db
          .prepare("INSERT INTO participants (run, slice, worktree, doing, files, since_seq, joined_at, nick, subs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(run, slice, where, doing, JSON.stringify(files), lastSeq(), now(), fresh(), subs);
        return Number(ins.lastInsertRowid);
      });
      const runner = participantById(id);
      claims.claimDeclared(runner, files);
      insertMessage(runner, `joined: ${doing}`, null, "event", undefined, { event: EVENTS.joined.name });
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
        // a held lock released by the end frees whoever was refused it (D65)
        const waiters = claims.lockWaitersFreedBy(fresh);
        const ended = { event: EVENTS.ended.name };
        if (waiters.length) insertMessage(fresh, `ended\nthe merge lock is free: ${waiters.map((n) => `@${n}`).join(" ")}`, null, "event", waiters, ended);
        else insertMessage(fresh, "ended", null, "event", undefined, ended);
        // the card's last word: what the runner's run came to, not its last doing (D66)
        db.prepare("UPDATE participants SET ended_at = ?, doing = CASE merged WHEN 1 THEN 'merged and ended' ELSE 'ended' END WHERE id = ?").run(now(), fresh.id);
        claims.releaseAll(fresh.id);
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
        subscriptions: subsOf(r),
        worktree: r.worktree == null ? null : String(r.worktree),
      }));
    },

    post(p, body, opts = {}) {
      const fresh = live(p);
      const m = insertMessage(fresh, body, opts.about ?? null, opts.kind ?? "msg");
      // posting is claiming (D7), on a kind with claims
      const claimed = profileOf(fresh.kind).claims ? claims.claimByPost(fresh, m) : null;
      return claimed ? { ...m, claimed } : m;
    },

    endorse(p, seq) {
      const fresh = live(p);
      const r = db.prepare("SELECT * FROM messages WHERE seq = ?").get(seq) as Row | undefined;
      if (!r) throw new Error(`unknown message #${seq}`);
      if (r.kind !== "agreement") throw new Error(`#${seq} is not an agreement`);
      if (Number(r.author) === fresh.id) throw new Error(`#${seq} is your own agreement`);
      const author = participantById(Number(r.author));
      const about = r.about == null ? null : String(r.about);
      return insertMessage(fresh, `endorses #${seq}`, about, "endorsement", [author.name], { endorses: seq });
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
      const column = mentionsOnly ? "listening" : "waiting";
      // a runner inside a `wait` shows `waiting` on the page; inside a `wait --mentions`, `listening`
      // beside its state. One live wait per runner (D64): this one takes the next number and the page's state, and any
      // older pending wait, here or in another process, sees the number move and returns superseded
      const gen = transaction(() => {
        const me = participantById(p.id);
        db.prepare("UPDATE participants SET wait_gen = wait_gen + 1, waiting = ?, listening = ? WHERE id = ?").run(mentionsOnly ? 0 : 1, mentionsOnly ? 1 : 0, me.id);
        bump(me.repo);
        return Number((db.prepare("SELECT wait_gen FROM participants WHERE id = ?").get(me.id) as Row).wait_gen);
      });
      const current = (): boolean => Number((db.prepare("SELECT wait_gen FROM participants WHERE id = ?").get(p.id) as Row).wait_gen) === gen;
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
            // the page's state is this wait's only while no newer one took it
            transaction(() => {
              const r = db.prepare(`UPDATE participants SET ${column} = 0 WHERE id = ? AND wait_gen = ? AND ${column} = 1`).run(p.id, gen);
              if (Number(r.changes) > 0) bump(participantById(p.id).repo);
            });
          } catch {}
          if (d instanceof Error) reject(d);
          else resolve(d);
        };
        const check = (): void => {
          if (settled) return;
          try {
            // `end`, from this process or another, releases a pending wait of that runner
            if (participantById(p.id).ended) return finish({ full: [], lines: [] });
            // the look and the superseded test in one transaction: a superseded wait takes nothing
            const d = transaction(() => (current() ? deliverTo(p, true, mentionsOnly) : null));
            if (!d) return finish({ full: [], lines: [], superseded: true });
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
      return claims.checkEdit(gated(live(p), "claim"), file, opts);
    },

    reconcileWrites(p, changed) {
      return claims.reconcileWrites(gated(live(p), "reconcile"), changed);
    },

    release(p, file) {
      claims.release(gated(live(p), "release"), file);
    },

    lockMerge(p, onto, reflogMark) {
      return claims.lockMerge(gated(live(p), "merge-lock"), onto, reflogMark);
    },

    merged(p, sha, files, conflicts) {
      return claims.merged(gated(live(p), "merged"), sha, files, conflicts);
    },

    heldMergeLock(p) {
      return claims.heldMergeLock(p);
    },

    stats(scope) {
      return statsOf(db, scope, STALE_MS);
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
      // a file a live runner declared at join but could not claim, held by another: it holds it too (D62);
      // one it claimed and released since does not come back
      const everClaimed = db.prepare("SELECT 1 FROM claim_log WHERE repo = ? AND path = ? AND participant = ?");
      for (const r of people) {
        if (String(r.slice) === ORCHESTRATOR || !isLive(Number(r.id))) continue;
        const name = `${r.plan}/${r.slice}`;
        for (const d of JSON.parse(String(r.files)) as Declared[]) {
          const f = files.get(relPath(repo, d.path) ?? d.path);
          if (f && !f.holders.includes(name) && !everClaimed.get(repo, f.path, Number(r.id))) f.holders.push(name);
        }
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
          ended: r.ended_at == null ? null : String(r.ended_at),
          calls: Number(r.calls ?? 0),
          listening: !ended && Number(r.listening) === 1,
          on: subsOf(r).map((x) => formatSubscriptions([x])),
          lastCall: String(r.last_call ?? r.joined_at),
        };
      });

      const events = (
        db.prepare("SELECT * FROM (SELECT * FROM messages WHERE repo = ? ORDER BY seq DESC LIMIT ?) ORDER BY seq").all(repo, EVENTS_SHOWN) as Row[]
      ).map((r) => {
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
          meta: m.meta ?? null,
        };
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
  // Every verb a runner calls is one call to the board, counted here and nowhere else (D66):
  // what the card's call count shows, and the last sign of life "stale" is measured from.
  // `reconcileWrites` is part of `merge-lock` and `end`, not a call.
  const countCall = (p: Participant, verb: string): void => {
    const at = now();
    db.prepare("UPDATE participants SET calls = calls + 1, last_call = ? WHERE id = ?").run(at, p.id);
    // the call itself, for the member's timeline (D25)
    db.prepare("INSERT INTO call_log (participant, at, verb) VALUES (?, ?, ?)").run(p.id, at, verb);
    // a member's call clears its run's stale mark, so a later silence flags again (D19)
    db.prepare("UPDATE runs SET stale_flagged = 0 WHERE id = ? AND stale_flagged = 1").run(p.run);
    // an orchestrator marked quiet is back: one back event, and the mark cleared (D15)
    if (Number(db.prepare("UPDATE participants SET quiet_flagged = 0 WHERE id = ? AND quiet_flagged = 1").run(p.id).changes) > 0 && runRow(p.run).state === "open")
      insertMessage(participantById(p.id), "back", null, "event", [], { event: EVENTS.back.name });
    bump(participantById(p.id).repo);
  };
  // the verb and its count in one transaction: the page sees one change, and a refused call
  // (an ended runner, an unknown path) counts none
  const counted = <A extends unknown[], R>(name: string, verb: (p: Participant, ...rest: A) => R) =>
    (p: Participant, ...rest: A): R =>
      transaction(() => {
        const out = verb(p, ...rest);
        countCall(p, name);
        return out;
      });
  board.setDoing = counted("setDoing", board.setDoing);
  board.subscribe = counted("subscribe", board.subscribe);
  board.unsubscribe = counted("unsubscribe", board.unsubscribe);
  board.end = counted("end", board.end);
  board.post = counted("post", board.post);
  board.endorse = counted("endorse", board.endorse);
  board.deliver = counted("deliver", board.deliver);
  board.wait = counted("wait", board.wait);
  board.checkEdit = counted("checkEdit", board.checkEdit);
  board.release = counted("release", board.release);
  board.lockMerge = counted("lockMerge", board.lockMerge);
  board.merged = counted("merged", board.merged);
  const read = board.read;
  board.read = (seq, by) => {
    const m = read(seq);
    if (by) transaction(() => countCall(by, "read"));
    return m;
  };
  return board;
}

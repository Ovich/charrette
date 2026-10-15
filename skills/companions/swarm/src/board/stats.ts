// The calculation behind `swarm stats` and the Analytics views: internal to the board, imported by
// board.ts only, as claims.ts. Reads the store, never git or the CLI. Every figure is nullable
// (D34): null means not recorded or not computed yet, never 0; a list may be empty. A run with a
// run_stats row is read whole from it (D20); an open run, or a closed one with none, is computed from
// the raw rows (D21, D22). A brainstorm run's debate comes from its messages alone, so a run before the
// records still carries it (D4, D33).
import type { DatabaseSync } from "node:sqlite";
import type { RunId } from "./board.ts";
import { type Kind, profileOf } from "./kinds.ts";
import { planCode } from "./mentions.ts";

export type StatsScope = { repo: string; run?: RunId; since?: string /* "30d" | ISO; absent: every run kept */; kinds?: Kind[]; closedOnly?: boolean };
export type Interval = { from: string; to: string; what: "working" | "silent" | "waiting" | "merging"; inferred: boolean };
export type Mark = { at: string; what: "agreement" | "race" | "flag" | "conflict" | "endorsed" | "objected"; seq?: number; path?: string; note: string };
export type MemberStats = {
  member: string;
  nick: string;
  slice: string;
  joined: string;
  ended: string | null;
  intervals: Interval[];
  marks: Mark[];
  posts: number | null;
  postTimes: string[];
  claims: number | null;
  flags: number | null;
  unsourced: number | null /* posts without a source, D23 */;
  /** Its spans waiting for the merge lock, summed; null when the run is not recorded (D40). */
  waitingMs: number | null;
  /** Its agreements posted (D40). */
  agreementsMade: number | null;
  /** A brainstorm run's: its endorsements and its objections (inferred, D23); null on a plan run, which computes neither (D40). */
  endorsed: number | null;
  objections: number | null;
};
export type PlanRunStats = {
  slices: { merged: number | null; of: number | null; addedMidRun: number | null; timesMs: number[] };
  lock: { waitsMs: number[]; racesLost: { member: string; lost: number | null; waitedMs: number | null }[] };
  shared: { files: number | null; everyHolderTold: number | null; agreed: number | null; agreedBeforeMerge: number | null; perFile: SharedFile[] };
  flags: number | null;
  /** `known`: conflicted paths over the merges whose conflicts are known; `inShared`: those another member of the run held;
   *  `unknownMerges`: merges whose conflicts git could not tell (board D13, D16). */
  conflicts: { known: number | null; inShared: number | null; unknownMerges: number | null };
};
export type SharedFile = {
  path: string;
  holders: string[];
  agreement: number | null /* seq */;
  agreedAfterMs: number | null;
  conflict: boolean | null;
  /** A holder declared it an interface at join, or claimed it as one (D37); null on a summary from before. */
  interface: boolean | null;
};
/** A question `D<n>`, from the `about` of the posts and agreements (D4). `outcome`: the first agreement on it the skeptic
 *  endorsed, at that agreement's time and seq; none, null (D30; no escalation until D26). `exchanges`: the seats' `msg`,
 *  `urgent` and `agreement` posts about it up to its outcome's agreement included, events not (D33). */
export type QuestionStats = { id: string /* D<n> */; firstPost: string; outcome: { at: string; seq: number; kind: "agreed" } | null; exchanges: number | null };
export type BrainstormRunStats = {
  /** Ordered by first post. */
  questions: QuestionStats[];
  /** The agreements about a `D<n>`; `endorsed`: the skeptic's endorsements of them. */
  agreements: number | null;
  endorsed: number | null;
  /** Inferred (D23). A claim: a member's `msg` or `urgent` post about a `D<n>`, up to its outcome. It carries a source when
   *  its body holds `file:line` (`<name>.<ext>:<digits>`), `#<digits>` or an `http://` / `https://` URL; a source named in
   *  words reads unsourced, and counts in its author's `unsourced`. An objection (a mark `objected`): the skeptic's
   *  `msg` or `urgent` post about a `D<n>` after an agreement on it by another member that the skeptic never endorsed. */
  claimsWithSource: { n: number | null; of: number | null; inferred: true };
};
export type RunStats = {
  run: RunId;
  kind: Kind;
  code: string;
  title: string;
  openedAt: string;
  closedAt: string | null;
  /** To its close, or to now for an open run. */
  lengthMs: number | null;
  recorded: boolean; // false: opened before the store's records-since; its new-record figures null
  firstMergeAtMs: number | null;
  racesLost: number | null /* summed over members, D34 */;
  members: MemberStats[];
  plan?: PlanRunStats;
  brainstorm?: BrainstormRunStats;
};
export type Totals = {
  runs: number | null;
  byKind: { plan: number | null; brainstorm: number | null };
  notRecorded: number | null;
  members: number | null;
  silentMembers: number | null;
  slices: { merged: number | null; of: number | null; p50Ms: number | null; p90Ms: number | null };
  lockWait: { merges: number | null; p50Ms: number | null; p90Ms: number | null; bins: number[] /* < 1m, 1–2m, 2–5m, 5–10m, 10m + */ };
  shared: { files: number | null; everyHolderTold: number | null; agreed: number | null; agreedBeforeMerge: number | null; withoutAgreement: number | null };
  flags: number | null;
  runsWithoutFlag: number | null;
  conflicts: { known: number | null; inShared: number | null; unknownMerges: number | null };
  brainstorm: {
    questionsSettled: number | null;
    questions: number | null;
    exchangesMedian: number | null;
    objectedThenAgreed: number | null;
    sourcedShare: number | null /* 0–1 */;
    silentSeats: number | null;
  };
  /** One point per run, as `runs`; null: not recorded, a gap (D32). */
  series: Record<"slicesMerged" | "sliceTimeP50" | "lockWaitP50" | "sharedAgreed" | "flags" | "conflicts" | "silentMembers", (number | null)[]>;
};
export type FileAcrossRuns = {
  path: string;
  runs: RunId[];
  holders: number | null;
  agreements: number | null;
  conflicts: number | null;
  declaredInterface: number | null;
  perRun: { run: RunId; holders: number | null; conflict: boolean | null }[] /* oldest first, D33 */;
};
export type Stats = { scope: StatsScope; runs: RunStats[] /* oldest first */; totals: Totals; files: FileAcrossRuns[]; silentAfterMs: number };

type Row = Record<string, unknown>;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const CASELESS = process.platform === "win32";
const foldPath = (p: string): string => (CASELESS ? p.toLowerCase() : p);
/** The settings row the board writes when the analytics records begin (D33). */
const RECORDS_SINCE = "records-since";
/** The settings row the board writes when the shares record begins (D39). */
const SHARES_SINCE = "shares-since";
const ORCHESTRATOR = "orchestrator";
/** The seat id of a brainstorm's skeptic (D30). */
const SKEPTIC = "skeptic";
/** A brainstorm question's `about` (D4). */
const QUESTION = /^D\d+$/;
// a flag as the board wrote it before the `event` column (D43): its body, posted by the board (by_board 1)
const FLAG_BODY = /flag:\s*\S+\s+wrote\s+\S+\s+outside its claim/;
/** A flag the board posted, from its message (D43): the `flag` event, or a board-written row from before
 *  the event name with the flag's body. Never the `flags` table, which the release of a claim empties,
 *  and never a member's own post quoting a flag. */
const isBoardFlag = (m: Row): boolean =>
  Number(m.by_board ?? 0) === 1 && (m.event === "flag" || (m.event == null && FLAG_BODY.test(String(m.body))));
/** A post is sourced when it carries file:line, #id or a URL (D23). */
const SOURCE = /[\w./\\-]+\.\w+:\d+|#\d+|https?:\/\/\S+/;
/** The lock wait histogram's upper bounds, the last bin open-ended: < 1m, 1–2m, 2–5m, 5–10m, 10m + (D28). */
const WAIT_BINS_MS = [1, 2, 5, 10].map((m) => m * MINUTE_MS);

/** The period's start, ISO: `<n>d` back from now, or an ISO time; absent, no start. */
function periodStart(since: string | undefined): string | null {
  if (since === undefined) return null;
  const days = since.match(/^(\d+)d$/);
  const at = days ? Date.now() - Number(days[1]) * DAY_MS : Date.parse(since);
  if (Number.isNaN(at)) throw new Error(`since takes <n>d or an ISO time, got ${since}`);
  return new Date(at).toISOString();
}

const ms = (at: unknown): number => Date.parse(String(at));
const iso = (t: number): string => new Date(t).toISOString();
const firstLine = (body: string): string => body.split(/\r?\n/)[0].slice(0, 120);

/** Nearest rank; null for no values. */
function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
/** The sum of the figures known; null when none is (D34). */
function sumKnown(values: (number | null | undefined)[]): number | null {
  const known = values.filter((v): v is number => typeof v === "number");
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

/** `about` (a path, or its tail) names `path`. */
const aboutNames = (about: unknown, path: string): boolean => {
  if (about == null) return false;
  const a = foldPath(String(about).replace(/\\/g, "/"));
  const f = foldPath(path);
  return a === f || f.endsWith(`/${a}`);
};

/** One lock turn of a member, its times in ms; `over`: when it ended, by its merge, an end call, or the member's end. */
type LockTurn = { asked: number; granted: number | null; merged: number | null; refused: number; over: number };
type Span = { from: number; to: number; what: Interval["what"] };

/** The member's timeline (board D9, D12): the lock's waits and merges exact, working and silent inferred,
 *  silent being the whole gap between two calls longer than `silentAfterMs` (D33). */
function timeline(joined: number, over: number, calls: number[], turns: LockTurn[], silentAfterMs: number): Interval[] {
  if (!(over > joined)) return [];
  const exact: Span[] = [];
  for (const t of turns) {
    if (t.refused > 0) exact.push({ from: t.asked, to: t.granted ?? t.over, what: "waiting" });
    if (t.granted !== null) exact.push({ from: t.granted, to: t.merged ?? t.over, what: "merging" });
  }
  const points = [joined, ...calls.filter((c) => c > joined && c < over), over].sort((a, b) => a - b);
  const silent: Span[] = [];
  for (let i = 1; i < points.length; i++) if (points[i] - points[i - 1] > silentAfterMs) silent.push({ from: points[i - 1], to: points[i], what: "silent" });
  const clip = (t: number): number => Math.min(over, Math.max(joined, t));
  const bounds = [...new Set([joined, over, ...[...exact, ...silent].flatMap((s) => [clip(s.from), clip(s.to)])])].sort((a, b) => a - b);
  const inside = (spans: Span[], what: Interval["what"], at: number): boolean => spans.some((s) => s.what === what && s.from <= at && at < s.to);
  const out: Interval[] = [];
  for (let i = 1; i < bounds.length; i++) {
    const from = bounds[i - 1];
    const to = bounds[i];
    const mid = (from + to) / 2;
    // the exact spans win over the inferred ones
    const what: Interval["what"] = inside(exact, "merging", mid)
      ? "merging"
      : inside(exact, "waiting", mid)
        ? "waiting"
        : inside(silent, "silent", mid)
          ? "silent"
          : "working";
    const last = out[out.length - 1];
    if (last && last.what === what && ms(last.to) === from) last.to = iso(to);
    else out.push({ from: iso(from), to: iso(to), what, inferred: what === "working" || what === "silent" });
  }
  return out;
}

/** The run's figures computed from the raw rows; `now` ends an open run and a member still there. Reads, never writes. */
function computeRun(db: DatabaseSync, r: Row, now: number, silentAfterMs: number): RunStats {
  const id = Number(r.id);
  const repo = String(r.repo);
  const kind = profileOf(String(r.kind ?? "plan")).kind;
  const openedAt = String(r.opened_at);
  const closedAt = r.closed_at == null ? null : String(r.closed_at);
  const runOver = closedAt ? ms(closedAt) : now;
  const since = db.prepare("SELECT value FROM settings WHERE name = ?").get(RECORDS_SINCE) as Row | undefined;
  // opened before the records began: its new-record figures null (D32, D33)
  const recorded = since !== undefined && ms(openedAt) >= ms(since.value);
  const sharesSince = db.prepare("SELECT value FROM settings WHERE name = ?").get(SHARES_SINCE) as Row | undefined;
  // opened before the shares record began: which paths were held at once is unknown, its funnel null (D39)
  const sharesRecorded = sharesSince !== undefined && ms(openedAt) >= ms(sharesSince.value);

  const people = db.prepare("SELECT * FROM participants WHERE run = ? ORDER BY id").all(id) as Row[];
  const ids = people.map((p) => Number(p.id));
  const marks = ids.map(() => "?").join(", ") || "NULL";
  const nameOf = (p: Row): string => `${r.plan}/${p.slice}`;
  const messages = db.prepare(`SELECT * FROM messages WHERE run = ? OR (run IS NULL AND author IN (${marks})) ORDER BY seq`).all(id, ...ids) as Row[];
  const merges = recorded ? (db.prepare("SELECT * FROM merges WHERE run = ? ORDER BY rowid").all(id) as Row[]) : [];
  const claimLog = db.prepare(`SELECT path, participant, kind FROM claim_log WHERE participant IN (${marks}) ORDER BY rowid`).all(...ids) as Row[];
  // shares: a claim granted beside another member of the run still holding the path (D39)
  const shares = db
    .prepare(`SELECT path, participant, other FROM shares WHERE participant IN (${marks}) AND other IN (${marks})`)
    .all(...ids, ...ids) as Row[];
  const orchestrators = new Set(people.filter((p) => String(p.slice) === ORCHESTRATOR).map((p) => Number(p.id)));

  const conflictedOf = (m: Row): string[] | null => (m.conflicts == null ? null : (JSON.parse(String(m.conflicts)) as string[]));
  const filesOf = (m: Row): string[] => JSON.parse(String(m.files)) as string[];

  // every grant on the repository, any run's: what a race is lost to (D33)
  const grants = recorded
    ? (db
        .prepare(
          `SELECT t.participant, t.asked_at, t.granted_at, p.slice, r.plan FROM lock_requests t
             LEFT JOIN participants p ON p.id = t.participant LEFT JOIN runs r ON r.id = p.run
           WHERE t.repo = ? AND t.granted_at IS NOT NULL ORDER BY t.granted_at`,
        )
        .all(repo) as Row[])
    : [];
  const lockWaitsMs: number[] = [];
  const racesLost: PlanRunStats["lock"]["racesLost"] = [];

  const members: MemberStats[] = people.map((p) => {
    const pid = Number(p.id);
    const joined = ms(p.joined_at);
    const over = Math.min(p.ended_at == null ? runOver : ms(p.ended_at), Math.max(now, joined));
    const calls = recorded ? (db.prepare("SELECT at, verb FROM call_log WHERE participant = ? ORDER BY at").all(pid) as Row[]) : [];
    const endCalls = calls.filter((c) => c.verb === "end").map((c) => ms(c.at));
    const turns: LockTurn[] = recorded
      ? (db.prepare("SELECT * FROM lock_requests WHERE participant = ? ORDER BY rowid").all(pid) as Row[]).map((t) => {
          const asked = ms(t.asked_at);
          const merged = t.merged_at == null ? null : ms(t.merged_at);
          return {
            asked,
            granted: t.granted_at == null ? null : ms(t.granted_at),
            merged,
            refused: Number(t.refused),
            // a turn without a merge is closed by the member's next end call (D25), else by its end
            over: merged ?? endCalls.find((e) => e >= asked) ?? over,
          };
        })
      : [];
    const memberMarks: Mark[] = [];
    // a race lost: a refused turn still pending while the lock goes to a member who asked later (D33);
    // waitedMs: how long it had waited at the last race it lost
    let lost = 0;
    let waitedMs: number | null = null;
    for (const t of turns) {
      if (t.granted !== null) lockWaitsMs.push(t.granted - t.asked);
      if (t.refused === 0) continue;
      const until = t.granted ?? t.over;
      for (const g of grants) {
        const at = ms(g.granted_at);
        if (Number(g.participant) === pid || !(ms(g.asked_at) > t.asked) || !(at > t.asked && at < until)) continue;
        lost++;
        waitedMs = Math.max(waitedMs ?? 0, at - t.asked);
        const winner = g.slice == null ? "a member" : `${g.plan}/${g.slice}`;
        memberMarks.push({ at: iso(at), what: "race", note: `the merge lock went to ${winner}, who asked later` });
      }
    }
    if (lost) racesLost.push({ member: nameOf(p), lost, waitedMs });

    const own = messages.filter((m) => Number(m.author) === pid);
    const posts = own.filter((m) => m.kind !== "event" && Number(m.by_board ?? 0) === 0);
    const flagged = own.filter(isBoardFlag);
    for (const m of own) {
      if (m.kind !== "agreement" && !isBoardFlag(m)) continue;
      memberMarks.push({
        at: String(m.at),
        what: m.kind === "agreement" ? "agreement" : "flag",
        seq: Number(m.seq),
        ...(m.about != null ? { path: String(m.about) } : {}),
        note: firstLine(String(m.body)),
      });
    }
    for (const m of merges.filter((x) => Number(x.participant) === pid)) {
      for (const f of conflictedOf(m) ?? []) memberMarks.push({ at: String(m.at), what: "conflict", path: f, note: `the rebase met a conflict in ${f}` });
    }
    memberMarks.sort((a, b) => ms(a.at) - ms(b.at));
    return {
      member: nameOf(p),
      nick: p.nick == null ? String(p.slice) : String(p.nick),
      slice: String(p.slice),
      joined: String(p.joined_at),
      ended: p.ended_at == null ? null : String(p.ended_at),
      intervals: recorded ? timeline(joined, over, calls.map((c) => ms(c.at)), turns, silentAfterMs) : [],
      marks: memberMarks,
      posts: posts.length,
      postTimes: posts.map((m) => String(m.at)),
      claims: claimLog.filter((c) => Number(c.participant) === pid).length,
      flags: flagged.length,
      unsourced: posts.filter((m) => !SOURCE.test(String(m.body))).length,
      // read from its spans and marks once they are whole, below (D40)
      waitingMs: null,
      agreementsMade: null,
      endorsed: null,
      objections: null,
    };
  });

  const firstMerge = merges.length ? Math.min(...merges.map((m) => ms(m.at))) : null;
  const length = runOver - ms(openedAt);
  const base: RunStats = {
    run: id,
    kind,
    code: planCode(String(r.plan)),
    title: String(r.title),
    openedAt,
    closedAt,
    lengthMs: Number.isNaN(length) ? null : length,
    recorded,
    firstMergeAtMs: recorded && firstMerge !== null ? firstMerge - ms(openedAt) : null,
    racesLost: recorded ? racesLost.reduce((n, x) => n + (x.lost ?? 0), 0) : null,
    members,
  };
  if (kind === "brainstorm") {
    const { brainstorm, marksOf, unsourcedOf } = debateOf(db, id, people.filter((p) => !orchestrators.has(Number(p.id))), messages);
    members.forEach((m, i) => {
      const pid = Number(people[i].id);
      m.marks = [...m.marks, ...(marksOf.get(pid) ?? [])].sort((a, b) => ms(a.at) - ms(b.at));
      // a brainstorm member's unsourced: its claims without a source (D23, D29)
      m.unsourced = unsourcedOf.get(pid) ?? 0;
    });
    return { ...base, brainstorm };
  }
  if (kind !== "plan") return base;

  // a slice's time: its join to its first merge, else to its end (board D9)
  const timesMs = recorded
    ? people.flatMap((p) => {
        if (orchestrators.has(Number(p.id))) return [];
        const mergedAt = merges.filter((m) => Number(m.participant) === Number(p.id)).map((m) => ms(m.at));
        const end = mergedAt.length ? Math.min(...mergedAt) : p.ended_at == null ? null : ms(p.ended_at);
        return end === null ? [] : [end - ms(p.joined_at)];
      })
    : [];
  const sliceCount = Number((db.prepare("SELECT COUNT(*) AS n FROM slices WHERE run = ?").get(id) as Row).n);
  const addedMidRun = messages.filter((m) => m.kind === "event" && orchestrators.has(Number(m.author)) && /^added \S+: /.test(String(m.body))).length;

  // shared files: a path two members of the run held at the same time (D39), its holders in the order they took it
  const holdersByPath = new Map<string, { path: string; holders: number[] }>();
  for (const c of claimLog) {
    const key = foldPath(String(c.path));
    const entry = holdersByPath.get(key) ?? { path: String(c.path), holders: [] };
    if (!entry.holders.includes(Number(c.participant))) entry.holders.push(Number(c.participant));
    holdersByPath.set(key, entry);
  }
  // a holder counts when it held the path at once with another member, either side of a share
  const sharersOf = (path: string): Set<number> =>
    new Set(shares.filter((sh) => foldPath(String(sh.path)) === foldPath(path)).flatMap((sh) => [Number(sh.participant), Number(sh.other)]));
  const byId = new Map(people.map((p) => [Number(p.id), p]));
  const namesPath = (m: Row, path: string): boolean => {
    if (aboutNames(m.about, path)) return true;
    const body = foldPath(String(m.body));
    return body.includes(foldPath(path)) || body.includes(foldPath(path.split("/").pop()!));
  };
  const said = messages.filter((m) => m.kind !== "event" && Number(m.by_board ?? 0) === 0);
  // the claims made as an interface, kept past their release (D42)
  const interfaceClaims = claimLog.filter((c) => c.kind === "interface");
  const perFile: SharedFile[] = [];
  // the funnel is nested (D38): each step counts only the files that passed the step before
  let everyHolderTold = 0;
  let agreed = 0;
  let agreedBeforeMerge = 0;
  for (const { path, holders: everyHolder } of holdersByPath.values()) {
    const sharers = sharersOf(path);
    const holders = everyHolder.filter((h) => sharers.has(h));
    if (holders.length < 2) continue;
    // each later holder posted about the path mentioning every earlier one (D41); the file is shared from the first such post
    const tellTimes: number[] = [];
    let told = true;
    for (let i = 1; i < holders.length; i++) {
      const tells = said.filter((m) => Number(m.author) === holders[i] && namesPath(m, path));
      tellTimes.push(...tells.map((m) => ms(m.at)));
      const mentioned = (e: number): boolean =>
        tells.some((m) => {
          const named = JSON.parse(String(m.mentions)) as string[];
          return named.includes(nameOf(byId.get(e)!)) || named.includes(`${r.plan}/*`);
        });
      if (!holders.slice(0, i).every(mentioned)) told = false;
    }
    const sharedAt = tellTimes.length ? Math.min(...tellTimes) : null;
    const agreement = messages.find((m) => m.kind === "agreement" && aboutNames(m.about, path));
    const mergedWith = merges.filter((m) => filesOf(m).some((f) => foldPath(f) === foldPath(path)));
    const firstMergeOfPath = mergedWith.length ? Math.min(...mergedWith.map((m) => ms(m.at))) : null;
    if (told) {
      everyHolderTold++;
      if (agreement) {
        agreed++;
        if (firstMergeOfPath === null || ms(agreement.at) < firstMergeOfPath) agreedBeforeMerge++;
      }
    }
    const met = mergedWith.map(conflictedOf);
    const conflict = !recorded ? null : met.some((c) => c?.some((f) => foldPath(f) === foldPath(path))) ? true : met.some((c) => c === null) ? null : false;
    // an interface: declared so at join (repository-relative), or claimed so (D37)
    const declaredInterface = holders.some((h) =>
      (JSON.parse(String(byId.get(h)!.files ?? "[]")) as { path: string; interface?: boolean }[]).some((d) => d.interface === true && aboutNames(d.path, path)),
    );
    const claimedInterface = interfaceClaims.some((c) => holders.includes(Number(c.participant)) && foldPath(String(c.path)) === foldPath(path));
    perFile.push({
      path,
      holders: holders.map((h) => nameOf(byId.get(h)!)),
      interface: declaredInterface || claimedInterface,
      agreement: agreement ? Number(agreement.seq) : null,
      agreedAfterMs: agreement && sharedAt !== null ? Math.max(0, ms(agreement.at) - sharedAt) : null,
      conflict,
    });
  }

  // conflicts: paths over the merges whose conflicts are known; inShared, those another member held (board D13, D16)
  let known = 0;
  let inShared = 0;
  let unknownMerges = 0;
  for (const m of merges) {
    const files = conflictedOf(m);
    if (files === null) {
      unknownMerges++;
      continue;
    }
    known += files.length;
    inShared += files.filter((f) => claimLog.some((c) => Number(c.participant) !== Number(m.participant) && foldPath(String(c.path)) === foldPath(f))).length;
  }
  const mergedSlices = new Set(merges.map((m) => Number(m.participant)).filter((pid) => !orchestrators.has(pid))).size;
  return {
    ...base,
    plan: {
      slices: { merged: recorded ? mergedSlices : null, of: sliceCount, addedMidRun, timesMs },
      lock: { waitsMs: lockWaitsMs, racesLost },
      shared: sharesRecorded
        ? { files: perFile.length, everyHolderTold, agreed, agreedBeforeMerge, perFile }
        : { files: null, everyHolderTold: null, agreed: null, agreedBeforeMerge: null, perFile: [] },
      flags: messages.filter(isBoardFlag).length,
      conflicts: recorded ? { known, inShared, unknownMerges } : { known: null, inShared: null, unknownMerges: null },
    },
  };
}

/** The skeptic's participant ids (D30): the seat with id `skeptic`, else the first seat whose row subscribes to `agreement`. */
function skepticOf(db: DatabaseSync, run: RunId, seats: Row[]): Set<number> {
  const seated = (slice: string): Set<number> => new Set(seats.filter((p) => String(p.slice) === slice).map((p) => Number(p.id)));
  const named = seated(SKEPTIC);
  if (named.size) return named;
  const rows = db.prepare("SELECT id, on_events FROM slices WHERE run = ? AND on_events IS NOT NULL ORDER BY ord").all(run) as Row[];
  const subscribesToAgreement = (row: Row): boolean =>
    (JSON.parse(String(row.on_events)) as string[]).flatMap((e) => e.split(",")).some((e) => e.trim().replace(/^(any|main):/, "") === "agreement");
  const subscribed = rows.find(subscribesToAgreement);
  return subscribed ? seated(String(subscribed.id)) : new Set();
}

/** A brainstorm run's debate, from its messages in seq order (D4, D23, D29, D30, D33): its block, the skeptic's marks
 *  `endorsed` and `objected` by participant id, and each member's claims without a source by participant id. */
function debateOf(
  db: DatabaseSync,
  run: RunId,
  seats: Row[],
  messages: Row[],
): { brainstorm: BrainstormRunStats; marksOf: Map<number, Mark[]>; unsourcedOf: Map<number, number> } {
  const skeptic = skepticOf(db, run, seats);
  const seatIds = new Set(seats.map((p) => Number(p.id)));
  const questionOf = (m: Row): string | null => {
    const about = m.about == null ? "" : String(m.about).trim();
    return QUESTION.test(about) ? about : null;
  };
  // what a member says itself: a post or an agreement, never an event or the board's own line
  const spoken = (m: Row): boolean => Number(m.by_board ?? 0) === 0 && (m.kind === "msg" || m.kind === "urgent" || m.kind === "agreement");
  const bySeq = new Map(messages.map((m) => [Number(m.seq), m]));

  // the skeptic's endorsements of agreements on a question; a question's outcome is its first agreement endorsed
  const endorsedSeqs = new Set<number>();
  const endorsements: { endorsement: Row; question: string }[] = [];
  for (const m of messages) {
    if (m.kind !== "endorsement" || !skeptic.has(Number(m.author)) || m.endorses == null) continue;
    const agreement = bySeq.get(Number(m.endorses));
    const question = agreement && agreement.kind === "agreement" ? questionOf(agreement) : null;
    if (question === null) continue;
    endorsements.push({ endorsement: m, question });
    endorsedSeqs.add(Number(m.endorses));
  }
  const outcomeOf = new Map<string, Row>();
  for (const m of messages) {
    const q = questionOf(m);
    if (q !== null && m.kind === "agreement" && endorsedSeqs.has(Number(m.seq)) && !outcomeOf.has(q)) outcomeOf.set(q, m);
  }

  const questions = new Map<string, QuestionStats>();
  const marksOf = new Map<number, Mark[]>();
  const unsourcedOf = new Map<number, number>();
  const mark = (pid: number, x: Mark): void => void marksOf.set(pid, [...(marksOf.get(pid) ?? []), x]);
  const lastAgreementOn = new Map<string, Row>();
  let agreements = 0;
  let sourced = 0;
  let claims = 0;
  for (const m of messages) {
    const q = questionOf(m);
    if (q === null || !spoken(m)) continue;
    const author = Number(m.author);
    const question = questions.get(q) ?? { id: q, firstPost: String(m.at), outcome: null, exchanges: 0 };
    questions.set(q, question);
    const outcome = outcomeOf.get(q);
    const upToOutcome = !outcome || Number(m.seq) <= Number(outcome.seq);
    if (upToOutcome && seatIds.has(author)) question.exchanges = (question.exchanges ?? 0) + 1;
    if (m.kind === "agreement") {
      agreements++;
      lastAgreementOn.set(q, m);
      continue;
    }
    if (upToOutcome) {
      claims++;
      if (SOURCE.test(String(m.body))) sourced++;
      else unsourcedOf.set(author, (unsourcedOf.get(author) ?? 0) + 1);
    }
    // an objection, inferred: the skeptic speaks on a question after another's agreement it never endorsed (D23)
    const last = lastAgreementOn.get(q);
    if (skeptic.has(author) && last && Number(last.author) !== author && !endorsedSeqs.has(Number(last.seq))) {
      mark(author, { at: String(m.at), what: "objected", seq: Number(m.seq), path: q, note: `objects to #${last.seq}: ${firstLine(String(m.body))}` });
    }
  }
  for (const { endorsement, question } of endorsements) {
    mark(Number(endorsement.author), { at: String(endorsement.at), what: "endorsed", seq: Number(endorsement.seq), path: question, note: `endorses #${endorsement.endorses}` });
  }
  for (const [q, outcome] of outcomeOf) {
    const question = questions.get(q);
    if (question) question.outcome = { at: String(outcome.at), seq: Number(outcome.seq), kind: "agreed" };
  }
  return {
    brainstorm: {
      questions: [...questions.values()].sort((a, b) => ms(a.firstPost) - ms(b.firstPost)),
      agreements,
      endorsed: endorsements.length,
      claimsWithSource: { n: sourced, of: claims, inferred: true },
    },
    marksOf,
    unsourcedOf,
  };
}

/** The run with each member's own figures (D40), read from the member's spans and marks: those a summary carries
 *  are kept, those it lacks (a summary from before) filled, so a stored run reads as a computed one. */
function withMemberFigures(run: RunStats): RunStats {
  const debated = run.brainstorm !== undefined;
  const marked = (m: MemberStats, what: Mark["what"]): number => m.marks.filter((x) => x.what === what).length;
  const lengthOf = (i: Interval): number => ms(i.to) - ms(i.from);
  const members = run.members.map((m) => ({
    ...m,
    waitingMs: m.waitingMs ?? (run.recorded ? m.intervals.filter((i) => i.what === "waiting").reduce((n, i) => n + lengthOf(i), 0) : null),
    agreementsMade: m.agreementsMade ?? marked(m, "agreement"),
    endorsed: m.endorsed ?? (debated ? marked(m, "endorsed") : null),
    objections: m.objections ?? (debated ? marked(m, "objected") : null),
  }));
  return { ...run, members };
}

/** A run kept: not pruned, or pruned with its summary kept (D21). */
const KEPT = "(pruned_at IS NULL OR id IN (SELECT run FROM run_stats))";

/** A closed run's summary, for its run_stats row (D20); the caller stores it. Reads, never writes. */
export function summarize(db: DatabaseSync, run: RunId, silentAfterMs: number): RunStats {
  const r = db.prepare("SELECT * FROM runs WHERE id = ?").get(run) as Row | undefined;
  if (!r) throw new Error(`no run ${run}`);
  return withMemberFigures(computeRun(db, r, Date.now(), silentAfterMs));
}

/** The scope's totals, from its runs' figures alone, stored or computed alike (D28, D34). */
function totalsOf(runs: RunStats[]): Totals {
  const plans = runs.flatMap((r) => (r.plan ? [r.plan] : []));
  const recorded = runs.filter((r) => r.recorded);
  const recordedPlans = recorded.flatMap((r) => (r.plan ? [r.plan] : []));
  const silentOf = (r: RunStats): number => r.members.filter((m) => m.intervals.some((i) => i.what === "silent")).length;
  const times = recordedPlans.flatMap((p) => p.slices.timesMs);
  const waits = recordedPlans.flatMap((p) => p.lock.waitsMs);
  const bins = [...WAIT_BINS_MS, Infinity].map((upper, i) => waits.filter((w) => w >= (WAIT_BINS_MS[i - 1] ?? 0) && w < upper).length);
  const shared = (pick: (s: PlanRunStats["shared"]) => number | null): number | null => sumKnown(plans.map((p) => pick(p.shared)));
  const files = shared((s) => s.files);
  const agreed = shared((s) => s.agreed);
  // one point per run; a run before the records is a gap (D32)
  const series = (figure: (r: RunStats) => number | null): (number | null)[] => runs.map((r) => (r.recorded ? figure(r) : null));
  return {
    runs: runs.length,
    byKind: { plan: runs.filter((r) => r.kind === "plan").length, brainstorm: runs.filter((r) => r.kind === "brainstorm").length },
    notRecorded: runs.length - recorded.length,
    members: runs.length ? runs.reduce((n, r) => n + r.members.length, 0) : null,
    silentMembers: sumKnown(recorded.map(silentOf)),
    slices: {
      merged: sumKnown(plans.map((p) => p.slices.merged)),
      of: sumKnown(plans.map((p) => p.slices.of)),
      p50Ms: percentile(times, 0.5),
      p90Ms: percentile(times, 0.9),
    },
    // merges: the lock turns granted, each one merge's wait
    lockWait: { merges: recordedPlans.length ? waits.length : null, p50Ms: percentile(waits, 0.5), p90Ms: percentile(waits, 0.9), bins: recordedPlans.length ? bins : [] },
    shared: {
      files,
      everyHolderTold: shared((s) => s.everyHolderTold),
      agreed,
      agreedBeforeMerge: shared((s) => s.agreedBeforeMerge),
      withoutAgreement: files === null || agreed === null ? null : files - agreed,
    },
    flags: sumKnown(plans.map((p) => p.flags)),
    runsWithoutFlag: plans.length ? plans.filter((p) => p.flags === 0).length : null,
    conflicts: {
      known: sumKnown(plans.map((p) => p.conflicts.known)),
      inShared: sumKnown(plans.map((p) => p.conflicts.inShared)),
      unknownMerges: sumKnown(plans.map((p) => p.conflicts.unknownMerges)),
    },
    brainstorm: brainstormTotalsOf(runs),
    series: {
      slicesMerged: series((r) => r.plan?.slices.merged ?? null),
      sliceTimeP50: series((r) => (r.plan ? percentile(r.plan.slices.timesMs, 0.5) : null)),
      lockWaitP50: series((r) => (r.plan ? percentile(r.plan.lock.waitsMs, 0.5) : null)),
      sharedAgreed: series((r) => r.plan?.shared.agreed ?? null),
      // flags come from the board's messages, kept for a run before the records too (D43)
      flags: runs.map((r) => r.plan?.flags ?? null),
      conflicts: series((r) => r.plan?.conflicts.known ?? null),
      silentMembers: series(silentOf),
    },
  };
}

/** The brainstorm figures over the scope's brainstorm runs with a debate block; null where none is (D34). */
function brainstormTotalsOf(runs: RunStats[]): Totals["brainstorm"] {
  const debated = runs.flatMap((r) => (r.brainstorm ? [{ run: r, debate: r.brainstorm }] : []));
  const questions = debated.flatMap((d) => d.debate.questions);
  const settled = questions.filter((q) => q.outcome !== null);
  // a question objected then agreed: the skeptic objected on it before the agreement that settled it
  const objectedOf = (r: RunStats, q: QuestionStats): boolean =>
    q.outcome !== null && r.members.some((m) => m.marks.some((x) => x.what === "objected" && x.path === q.id && x.seq !== undefined && x.seq < q.outcome!.seq));
  const n = sumKnown(debated.map((d) => d.debate.claimsWithSource.n));
  const of = sumKnown(debated.map((d) => d.debate.claimsWithSource.of));
  // the seats (the orchestrator is none) with a silent interval, over the runs whose intervals are recorded
  const silentSeatsOf = (r: RunStats): number => r.members.filter((m) => m.slice !== ORCHESTRATOR && m.intervals.some((i) => i.what === "silent")).length;
  return {
    questionsSettled: debated.length ? settled.length : null,
    questions: debated.length ? questions.length : null,
    exchangesMedian: percentile(settled.flatMap((q) => (q.exchanges === null ? [] : [q.exchanges])), 0.5),
    objectedThenAgreed: debated.length ? debated.reduce((k, d) => k + d.debate.questions.filter((q) => objectedOf(d.run, q)).length, 0) : null,
    sourcedShare: n === null || !of ? null : n / of,
    silentSeats: sumKnown(debated.filter((d) => d.run.recorded).map((d) => silentSeatsOf(d.run))),
  };
}

/** The files members met in across the scope's runs, most runs first (D33). */
function filesAcross(runs: RunStats[]): FileAcrossRuns[] {
  const byPath = new Map<string, { path: string; perRun: { run: RunId; holders: string[]; agreed: boolean; conflict: boolean | null; interface: boolean | null }[] }>();
  for (const r of runs) {
    for (const f of r.plan?.shared.perFile ?? []) {
      const key = foldPath(f.path);
      const entry = byPath.get(key) ?? { path: f.path, perRun: [] };
      entry.perRun.push({ run: r.run, holders: f.holders, agreed: f.agreement !== null, conflict: f.conflict, interface: f.interface ?? null });
      byPath.set(key, entry);
    }
  }
  return [...byPath.values()]
    .map(({ path, perRun }) => ({
      path,
      runs: perRun.map((x) => x.run),
      holders: new Set(perRun.flatMap((x) => x.holders)).size,
      agreements: perRun.filter((x) => x.agreed).length,
      conflicts: perRun.every((x) => x.conflict === null) ? null : perRun.filter((x) => x.conflict === true).length,
      // the runs in which a holder declared or claimed it an interface; null when none knows (summaries from before D37)
      declaredInterface: perRun.every((x) => x.interface === null) ? null : perRun.filter((x) => x.interface === true).length,
      perRun: perRun.map((x) => ({ run: x.run, holders: x.holders.length, conflict: x.conflict })),
    }))
    .sort((a, b) => b.runs.length - a.runs.length || a.path.localeCompare(b.path));
}

/** The scope's runs, oldest first, in one read (D22): a run with a run_stats row read whole from it, pruned or not;
 *  the rest computed. Throws on an unknown run or kind, or an unreadable since. `silentAfterMs`: the board's silent rule (board D12). */
export function statsOf(db: DatabaseSync, scope: StatsScope, silentAfterMs: number): Stats {
  for (const k of scope.kinds ?? []) profileOf(k);
  const start = periodStart(scope.since);
  const where = ["repo = ?", KEPT];
  const params: (string | number)[] = [scope.repo];
  if (scope.run !== undefined) {
    where.push("id = ?");
    params.push(scope.run);
  }
  if (scope.kinds?.length) {
    where.push(`kind IN (${scope.kinds.map(() => "?").join(", ")})`);
    params.push(...scope.kinds);
  }
  if (scope.closedOnly) where.push("state = 'closed'");
  if (start) {
    where.push("(state = 'open' OR closed_at >= ?)");
    params.push(start);
  }
  db.exec("BEGIN");
  try {
    if (scope.run !== undefined && !db.prepare(`SELECT 1 FROM runs WHERE id = ? AND repo = ? AND ${KEPT}`).get(scope.run, scope.repo)) {
      throw new Error(`no run ${scope.run}`);
    }
    const rows = db.prepare(`SELECT * FROM runs WHERE ${where.join(" AND ")} ORDER BY opened_at, id`).all(...params) as Row[];
    const stored = db.prepare("SELECT body FROM run_stats WHERE run = ?");
    const now = Date.now();
    const runs = rows.map((r) => {
      const row = stored.get(Number(r.id)) as Row | undefined;
      return withMemberFigures(row ? (JSON.parse(String(row.body)) as RunStats) : computeRun(db, r, now, silentAfterMs));
    });
    return { scope, runs, totals: totalsOf(runs), files: filesAcross(runs), silentAfterMs };
  } finally {
    db.exec("COMMIT");
  }
}

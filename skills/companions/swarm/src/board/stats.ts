// The calculation behind `swarm stats` and the Analytics views: internal to the board, imported by
// board.ts only, as claims.ts. Reads the store, never git or the CLI. Every figure is nullable
// (D34): null means not recorded or not computed yet, never 0; a list may be empty. This first cut
// fills each run's identity and times and a plan run's conflicts (from `merges`); the rest is null.
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
export type SharedFile = { path: string; holders: string[]; agreement: number | null /* seq */; agreedAfterMs: number | null; conflict: boolean | null };
export type QuestionStats = { id: string /* D<n> */; firstPost: string; outcome: { at: string; seq: number; kind: "agreed" } | null; exchanges: number | null };
export type BrainstormRunStats = {
  questions: QuestionStats[];
  agreements: number | null;
  endorsed: number | null;
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
const CASELESS = process.platform === "win32";
const foldPath = (p: string): string => (CASELESS ? p.toLowerCase() : p);

/** The period's start, ISO: `<n>d` back from now, or an ISO time; absent, no start. */
function periodStart(since: string | undefined): string | null {
  if (since === undefined) return null;
  const days = since.match(/^(\d+)d$/);
  const at = days ? Date.now() - Number(days[1]) * DAY_MS : Date.parse(since);
  if (Number.isNaN(at)) throw new Error(`since takes <n>d or an ISO time, got ${since}`);
  return new Date(at).toISOString();
}

/** Nothing computed yet: every figure null, every list empty (D34). */
const totalsNotComputed = (): Totals => ({
  runs: null,
  byKind: { plan: null, brainstorm: null },
  notRecorded: null,
  members: null,
  silentMembers: null,
  slices: { merged: null, of: null, p50Ms: null, p90Ms: null },
  lockWait: { merges: null, p50Ms: null, p90Ms: null, bins: [] },
  shared: { files: null, everyHolderTold: null, agreed: null, agreedBeforeMerge: null, withoutAgreement: null },
  flags: null,
  runsWithoutFlag: null,
  conflicts: { known: null, inShared: null, unknownMerges: null },
  brainstorm: { questionsSettled: null, questions: null, exchangesMedian: null, objectedThenAgreed: null, sourcedShare: null, silentSeats: null },
  series: { slicesMerged: [], sliceTimeP50: [], lockWaitP50: [], sharedAgreed: [], flags: [], conflicts: [], silentMembers: [] },
});

/** A plan run's conflicts from its `merges` rows; the rest of the block not computed yet. */
function planRunStats(db: DatabaseSync, run: RunId): PlanRunStats {
  const merges = db.prepare("SELECT participant, conflicts FROM merges WHERE run = ? ORDER BY rowid").all(run) as Row[];
  // a path another member of the run held, now or before (claim_log keeps a released claim)
  const heldBy = db.prepare("SELECT l.path, l.participant FROM claim_log l JOIN participants p ON p.id = l.participant WHERE p.run = ?").all(run) as Row[];
  const heldByOther = (path: string, merger: number): boolean =>
    heldBy.some((h) => Number(h.participant) !== merger && foldPath(String(h.path)) === foldPath(path));
  let known = 0;
  let inShared = 0;
  let unknownMerges = 0;
  for (const m of merges) {
    if (m.conflicts == null) {
      unknownMerges++;
      continue;
    }
    const files = JSON.parse(String(m.conflicts)) as string[];
    known += files.length;
    inShared += files.filter((f) => heldByOther(f, Number(m.participant))).length;
  }
  return {
    slices: { merged: null, of: null, addedMidRun: null, timesMs: [] },
    lock: { waitsMs: [], racesLost: [] },
    shared: { files: null, everyHolderTold: null, agreed: null, agreedBeforeMerge: null, perFile: [] },
    flags: null,
    conflicts: { known, inShared, unknownMerges },
  };
}

function runStats(db: DatabaseSync, r: Row, now: number): RunStats {
  const id = Number(r.id);
  const kind = profileOf(String(r.kind ?? "plan")).kind;
  const openedAt = String(r.opened_at);
  const closedAt = r.closed_at == null ? null : String(r.closed_at);
  const end = closedAt ? Date.parse(closedAt) : now;
  return {
    run: id,
    kind,
    code: planCode(String(r.plan)),
    title: String(r.title),
    openedAt,
    closedAt,
    lengthMs: Number.isNaN(end - Date.parse(openedAt)) ? null : end - Date.parse(openedAt),
    recorded: true,
    firstMergeAtMs: null,
    racesLost: null,
    members: [],
    ...(kind === "plan" ? { plan: planRunStats(db, id) } : {}),
  };
}

/** The scope's runs, oldest first, a pruned run never; one read. `silentAfterMs`: the board's silent rule. */
export function statsOf(db: DatabaseSync, scope: StatsScope, silentAfterMs: number): Stats {
  const where = ["repo = ?", "pruned_at IS NULL"];
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
  const start = periodStart(scope.since);
  if (start) {
    where.push("(state = 'open' OR closed_at >= ?)");
    params.push(start);
  }
  db.exec("BEGIN");
  try {
    const rows = db.prepare(`SELECT * FROM runs WHERE ${where.join(" AND ")} ORDER BY opened_at, id`).all(...params) as Row[];
    const now = Date.now();
    return { scope, runs: rows.map((r) => runStats(db, r, now)), totals: totalsNotComputed(), files: [], silentAfterMs };
  } finally {
    db.exec("COMMIT");
  }
}

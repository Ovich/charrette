// What the page shows, as pure functions of the snapshot and the three selections App owns:
// the run it is scoped to, the runner it follows, the filter. No child computes any of it.
import type { BoardSnapshot, SnapshotEvent, SnapshotRunner, QueueSlice, RunSummary } from "../../src/board/board.ts";
import { profileOf, type Kind, type KindProfile } from "../../src/board/kinds.ts";
import { nameHandle, parseMentions, planCode } from "../../src/board/mentions.ts";

export const ORCHESTRATOR = "orchestrator";

/** "<plan>/<slice>" → its plan and slice. */
export function splitRunner(name: string): { plan: string; slice: string } {
  const i = name.lastIndexOf("/");
  return i < 0 ? { plan: "", slice: name } : { plan: name.slice(0, i), slice: name.slice(i + 1) };
}

/** The RunnerTag's text: `RT·S3`. */
export const runnerLabel = (name: string): { code: string; slice: string } => {
  const { plan, slice } = splitRunner(name);
  return { code: planCode(plan), slice };
};

/**
 * A runner's hue: the KindChip recipe, copied as runnerColor. Hashed on "<code>·<slice>",
 * spread over twelve spokes so two runners side by side rarely share one; orchestrators
 * neutral (saturation 0).
 */
export function runnerColor(name: string): { h: number; s: number } {
  const { code, slice } = runnerLabel(name);
  if (slice === ORCHESTRATOR) return { h: 0, s: 0 };
  let n = 0;
  for (const c of `${code}·${slice}`) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return { h: ((n % 12) * 30 + 12) % 360, s: 52 + (n % 4) * 8 };
}

/** 14:03, local time. */
export function hhmm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const basename = (p: string): string => p.split(/[\\/]/).pop() ?? p;

// ── channels, and scoping to one ────────────────────────────────────────────────────

/** What resolving a mention needs: every run's group on the repository, and the active runners'
 *  funny names as a mention writes them (D43). */
export type MentionCtx = { groups: string[]; names: ReadonlyMap<string, string> };

export const mentionCtx = (snap: BoardSnapshot): MentionCtx => ({
  groups: [...new Set(snap.runs.map((r) => r.group))],
  names: new Map(
    snap.roster.filter((r) => r.slice !== ORCHESTRATOR && r.state !== "ended" && r.state !== "done").map((r) => [nameHandle(r.nick), r.runner]),
  ),
});

/** Each runner's funny name (D43), by `<plan>/<slice>`; orchestrators have none. */
export const nicksOf = (snap: BoardSnapshot): Map<string, string> =>
  new Map(snap.roster.filter((r) => r.slice !== ORCHESTRATOR).map((r) => [r.runner, r.nick]));

/** Whom a message names, resolved as the Board resolves it. */
export const targets = (e: SnapshotEvent, ctx: MentionCtx): string[] => parseMentions(e.body, splitRunner(e.from).plan, ctx.groups, ctx.names);

/** Orchestrators first, then working, waiting, merging, then ended and done. */
const ORDER: Record<string, number> = { working: 1, waiting: 2, merging: 3, ended: 4, done: 4 };
export function orderRoster(roster: SnapshotRunner[]): SnapshotRunner[] {
  const rank = (r: SnapshotRunner): number => (r.slice === ORCHESTRATOR ? 0 : (ORDER[r.state] ?? 1));
  return roster
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
    .map((x) => x.r);
}

export interface Scoped {
  roster: SnapshotRunner[];
  events: SnapshotEvent[];
  queues: [string, QueueSlice[]][];
  files: FileRow[];
}

/** A held file and its holders, in claim order (D40); `flag`: written outside a claim. */
export type FileRow = { path: string; holders: string[]; iface: boolean; flag: boolean };

/** A channel: Main, or a run by its id (D18). */
export type ChannelId = "main" | number;
export type ChannelEntry = { id: ChannelId; title: string; code: string | null; kind: Kind | null; open: boolean; members: number };
export type ChannelGroups = { main: ChannelEntry; plans: ChannelEntry[]; brainstorms: ChannelEntry[]; closed: ChannelEntry[] };

const isActive = (r: SnapshotRunner): boolean => r.state !== "ended" && r.state !== "done";

/** The profile of a run's kind, or null for a kind this page's build does not know. */
function knownProfile(kind: string): KindProfile | null {
  try {
    return profileOf(kind);
  } catch {
    return null;
  }
}

/** A run's members: the roster entries of its group. */
const membersOf = (snap: BoardSnapshot, run: RunSummary): SnapshotRunner[] => snap.roster.filter((r) => r.plan === run.group);

/** The rail: Main, the open runs by kind, oldest first, and every closed run the snapshot holds,
 *  newest first (D19, D46). A kind is a plan when its profile has claims, else a brainstorm. */
export function channels(snap: BoardSnapshot): ChannelGroups {
  const entry = (r: RunSummary): ChannelEntry => ({ id: r.run, title: r.title, code: r.code, kind: knownProfile(r.kind) ? r.kind : null, open: r.open, members: membersOf(snap, r).length });
  const hasClaims = (r: RunSummary): boolean => knownProfile(r.kind)?.claims ?? false;
  const open = snap.runs.filter((r) => r.open).sort((a, b) => a.run - b.run);
  return {
    main: { id: "main", title: "Main", code: null, kind: null, open: true, members: snap.roster.filter(isActive).length },
    plans: open.filter(hasClaims).map(entry),
    brainstorms: open.filter((r) => !hasClaims(r)).map(entry),
    closed: snap.runs.filter((r) => !r.open).sort((a, b) => b.run - a.run).map(entry),
  };
}

const openProfiles = (snap: BoardSnapshot): KindProfile[] => snap.runs.filter((r) => r.open).flatMap((r) => knownProfile(r.kind) ?? []);
/** The claims panel shows while some open run's kind has claims (D3). */
export const showsClaims = (snap: BoardSnapshot): boolean => openProfiles(snap).some((p) => p.claims);
/** The merge lock shows while some open run's kind has one (D3). */
export const showsMergeLock = (snap: BoardSnapshot): boolean => openProfiles(snap).some((p) => p.mergeLock);

/** One channel: its own events; the roster and queue of that run, or every active member and
 *  every queue on Main. Files are the repository's whole FileMap, claims being global (D26). */
export function scope(snap: BoardSnapshot, channel: ChannelId): Scoped {
  const run = channel === "main" ? null : (snap.runs.find((r) => r.run === channel) ?? null);
  const roster = orderRoster(channel === "main" ? snap.roster.filter(isActive) : run ? membersOf(snap, run) : []);
  const events = snap.events.filter((e) => e.channel === channel);
  const queues = Object.entries(snap.queues).filter(([group]) => channel === "main" || group === run?.group);
  const held: FileRow[] = snap.files.map((f) => ({ path: f.path, holders: f.holders, iface: f.interface, flag: snap.flags.some((x) => x.path === f.path) }));
  const unheld = [...new Set(snap.flags.map((f) => f.path))]
    .filter((p) => !held.some((h) => h.path === p))
    .map((p) => ({ path: p, holders: snap.flags.filter((f) => f.path === p).map((f) => f.runner), iface: false, flag: true }));
  return { roster, events, queues, files: [...held, ...unheld] };
}

// ── following a runner ──────────────────────────────────────────────────────────────

/** A message from the runner, or naming it (by name, or its plan's `@all`). */
export function involves(e: SnapshotEvent, runner: string | null, ctx: MentionCtx): boolean {
  if (!runner) return true;
  if (e.from === runner) return true;
  const { plan } = splitRunner(runner);
  return targets(e, ctx).some((t) => t === runner || t === `${plan}/*`);
}

/** Lit with the accent stripe: another's message that names the followed runner. */
export const lit = (e: SnapshotEvent, runner: string | null, ctx: MentionCtx): boolean =>
  !!runner && e.kind !== "event" && e.from !== runner && involves(e, runner, ctx);

// ── the filters ─────────────────────────────────────────────────────────────────────

export type Filter = { id: string; label: string; file: boolean; test: (e: SnapshotEvent) => boolean };

/** Everything, Messages only, Agreements, then the three files most talked about. */
export function filters(events: SnapshotEvent[]): Filter[] {
  const counts = new Map<string, number>();
  for (const e of events) if (e.about) counts.set(e.about, (counts.get(e.about) ?? 0) + 1);
  const top = [...counts.entries()]
    .map(([f, n], i) => ({ f, n, i }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.f);
  return [
    { id: "all", label: "Everything", file: false, test: () => true },
    { id: "talk", label: "Messages only", file: false, test: (e) => e.kind !== "event" },
    { id: "agreements", label: "Agreements", file: false, test: (e) => e.kind === "agreement" },
    ...top.map((f) => ({ id: `file:${f}`, label: basename(f), file: true, test: (e: SnapshotEvent) => e.about === f || e.body.includes(basename(f)) })),
  ];
}

/** The feed: scoped events through the filter, then through the runner followed. */
export function feed(events: SnapshotEvent[], filter: string, runner: string | null, ctx: MentionCtx): SnapshotEvent[] {
  const f = filters(events).find((x) => x.id === filter) ?? filters(events)[0];
  return events.filter(f.test).filter((e) => involves(e, runner, ctx));
}


// ── a board event's line ────────────────────────────────────────────────────────────

const EVENT_WORDS = ["opened", "dispatched", "joined", "claimed", "refused", "waiting", "woken", "merge lock", "merged", "ended", "stopped", "resumed", "closed"];
const STRONG = new Set(["refused", "merge lock", "stopped"]);

/** "merged abc: rebase onto abc." → the tag word, whether it is strong, and the rest on one line. */
export function eventLine(body: string): { word: string | null; strong: boolean; rest: string } {
  const flat = body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" · ");
  for (const w of EVENT_WORDS) {
    if (flat === w || flat.startsWith(`${w} `) || flat.startsWith(`${w}:`)) {
      return { word: w, strong: STRONG.has(w), rest: flat.slice(w.length).replace(/^:\s*/, "").trim() };
    }
  }
  return { word: null, strong: false, rest: flat };
}

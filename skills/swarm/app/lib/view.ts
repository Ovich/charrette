// What the page shows, as pure functions of the snapshot and what the page picks: the run's
// tab and the member followed. No child computes any of it.
import type { BoardSnapshot, SnapshotEvent, SnapshotRunner, RunId, RunSummary } from "../../src/board/board.ts";
import type { Kind } from "../../src/board/kinds.ts";
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


// ── mentions and members ────────────────────────────────────────────────────────────

/** What resolving a mention needs: every run's group on the repository, and the active runners'
 *  funny names as a mention writes them (D43). */
export type MentionCtx = { groups: string[]; names: ReadonlyMap<string, string> };

export const mentionCtx = (snap: BoardSnapshot): MentionCtx => ({
  groups: [...new Set(snap.runs.map((r) => r.group))],
  names: new Map(
    snap.roster.filter((r) => r.slice !== ORCHESTRATOR && r.state !== "ended" && r.state !== "done").map((r) => [nameHandle(r.nick), r.runner]),
  ),
});

/** Each member's funny name (D43), by `<plan>/<slice>`, the orchestrators' included (plan D17). */
export const nicksOf = (snap: BoardSnapshot): Map<string, string> => new Map(snap.roster.map((r) => [r.runner, r.nick]));

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

/** A run's members: the roster entries of its group. */
const membersOf = (snap: BoardSnapshot, run: RunSummary): SnapshotRunner[] => snap.roster.filter((r) => r.plan === run.group);

// ── following a runner ──────────────────────────────────────────────────────────────

/** A message from the runner, or naming it (by name, or its plan's `@all`). */
export function involves(e: SnapshotEvent, runner: string | null, ctx: MentionCtx): boolean {
  if (!runner) return true;
  if (e.from === runner) return true;
  const { plan } = splitRunner(runner);
  return targets(e, ctx).some((t) => t === runner || t === `${plan}/*`);
}

// ── flags, and the talk they start (D10) ────────────────────────────────────────────

/** A flag's parts: who wrote the path outside a claim, and who holds it. */
export type FlagLine = { writer: string; path: string; holder: string };

const FLAG_BODY = /flag:\s*(\S+)\s+wrote\s+(\S+)\s+outside its claim;\s*(\S+)\s+holds? it/;

/** The flag a post raises, or null. Read from the body, which old rows (a plain message) and
 *  the `flag` event share. */
export function flagOf(e: SnapshotEvent): FlagLine | null {
  // the board's own name for it (D11): mentions are the holder, then the writer
  if (e.event === "flag" && e.about && e.mentions && e.mentions.length >= 2) return { writer: e.mentions[1], path: e.about, holder: e.mentions[0] };
  // a row from before D11: the body says it
  if (e.kind !== "event" && e.kind !== "msg") return null;
  const m = FLAG_BODY.exec(e.body);
  return m ? { writer: m[1], path: e.about ?? m[2], holder: m[3] } : null;
}

export const isFlag = (e: SnapshotEvent): boolean => flagOf(e) !== null;

/** The posts that answer a flag: after it, `--about` its path, an agreement by anyone or a post
 *  by one of its two runners; never another flag or a board event. */
export function answersOf(flag: SnapshotEvent, events: SnapshotEvent[]): SnapshotEvent[] {
  const f = flagOf(flag);
  if (!f) return [];
  return events.filter(
    (e) => e.seq > flag.seq && e.about === f.path && e.kind !== "event" && !isFlag(e) && (e.kind === "agreement" || e.from === f.writer || e.from === f.holder),
  );
}

/** Settled by the first agreement that answers it, else answered by the first post, else open. */
export type FlagAnswer = { state: "settled" | "answered"; seq: number } | { state: "open" };

export function flagAnswer(flag: SnapshotEvent, events: SnapshotEvent[]): FlagAnswer {
  const answers = answersOf(flag, events);
  const agreed = answers.find((e) => e.kind === "agreement");
  if (agreed) return { state: "settled", seq: agreed.seq };
  return answers.length ? { state: "answered", seq: answers[0].seq } : { state: "open" };
}

// ── a merged event's recipients ─────────────────────────────────────────────────────

/** Whom a merged event told: `rebase`, the holders its body names; `tell`, those its author then
 *  told of a resolved conflict (`@<them> I resolved <file>`), before its next merge. */
export function mergedRecipients(e: SnapshotEvent, events: SnapshotEvent[], ctx: MentionCtx): { rebase: string[]; tell: string[] } {
  // stored with the event (D11); parsed from the thread only on a row from before
  if (e.meta) return { rebase: [...e.meta.rebase], tell: [...e.meta.tell] };
  const plan = splitRunner(e.from).plan;
  const holdersLine = e.body.split(/\r?\n/).find((l) => l.includes("you hold or declared a file it changed")) ?? "";
  const rebase = [...new Set(parseMentions(holdersLine, plan, ctx.groups, ctx.names))];
  const tell: string[] = [];
  for (const x of events) {
    if (x.seq <= e.seq || x.from !== e.from) continue;
    if (x.kind === "event" && eventLine(x.body).word === "merged") break;
    if (!/\bI resolved\b/.test(x.body)) continue;
    for (const t of parseMentions(x.body, plan, ctx.groups, ctx.names)) if (!tell.includes(t)) tell.push(t);
  }
  return { rebase, tell };
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

// ── the one conversation (D1, D8, D13-D16) ──────────────────────────────────────────

/** An open run as a tab: `quiet` while its orchestrator has a `quiet` event no `back` answered. */
export type RunTab = { run: RunId; code: string; title: string; kind: Kind; state: "live" | "quiet" | "closed"; done: number; of: number };
/** A closed run in the archive; `outcome` null while the snapshot holds none (D18). */
export type ArchivedRun = RunTab & { closed: string; outcome: string | null; orchestrator: string };
/** What the conversation shows: one run (null = All), or the member followed. */
export type Pick = { run: RunId | null; follow: string | null };
export type ItemKind = "message" | "flag" | "urgent" | "held" | "question" | "quiet" | "agreement" | "settled";
export type Tier = "act" | "wait" | "decided" | "talk";
export type Item =
  | { kind: ItemKind; tier: Tier; seq: number; at: string; run: RunId; from: string; word: string | null; tip: string | null; text: string; joined: boolean; state: string | null }
  | { kind: "event"; seq: number; at: string; run: RunId; from: string; text: string; tip: string | null };

/** Every tip, verbatim from the mockup (D9). */
export const TIPS = {
  flag: "Flag: this member wrote a file it had not claimed, while another member holds it. The board found it when the member merged or ended. The two settle it here; the flag stays open until they agree.",
  settled: "Settled flag: the two members agreed on the file a flag was about.",
  urgent: "Urgent: an orchestrator interrupted this member to do this first. It wakes the member at once, whatever it was doing.",
  held: "Held file: this member wanted a file another member holds. It said what it needs and waits for the holder's answer here.",
  question: "Question: a seat asks its orchestrator something the debate cannot settle alone. It waits for the answer.",
  quiet: "Quiet: this member has not called the board for a while. Its session may be waiting on you, or gone; its claims stay held.",
  agreement: "Agreed: two members settled something between them, and it binds both. An endorsement is another member backing it.",
  merged: "Merged: this member's branch went into the plan's branch. Members holding the files it changed rebase onto it.",
  lock: "Waiting for the merge lock: one member merges at a time, across every run.",
  opened: "Opened: an orchestrator started a run on the board.",
  closed: "Closed: the run is over; its conversation is in the archive (☰).",
  joined: "Joined: a member arrived on the board and took its slice or seat.",
  ended: "Ended: the member left the board and its claims were released.",
} as const;

/** A board event's tip, by its word or its stored name. */
const EVENT_TIPS: Record<string, string> = {
  merged: TIPS.merged,
  waiting: TIPS.lock,
  "merge lock": TIPS.lock,
  opened: TIPS.opened,
  closed: TIPS.closed,
  joined: TIPS.joined,
  ended: TIPS.ended,
};

/** The run's hue, shared by every member of the run (D8): its two letters hashed onto twelve spokes. */
export function runHue(code: string): number {
  let n = 0;
  for (const c of code) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return ((n % 12) * 30 + 12) % 360;
}

/** A member as a word writes it: code first, nick second (D10). */
function memberText(snap: BoardSnapshot, runner: string): string {
  const { code, slice } = runnerLabel(runner);
  const nick = snap.roster.find((r) => r.runner === runner)?.nick;
  return nick ? `${code}·${slice} ${nick}` : `${code}·${slice}`;
}

/** The run an item belongs to: its stored `run` once the board has one (SL1), else its author's
 *  run, the open one of that group or its newest, so an old Main row is labelled too (D13). */
function runOf(snap: BoardSnapshot, e: SnapshotEvent): RunSummary | null {
  const stored = (e as SnapshotEvent & { run?: RunId | null }).run;
  if (stored != null) return snap.runs.find((r) => r.run === stored) ?? null;
  const group = splitRunner(e.from).plan;
  const ofGroup = snap.runs.filter((r) => r.group === group);
  return ofGroup.find((r) => r.open) ?? [...ofGroup].sort((a, b) => b.run - a.run)[0] ?? null;
}

const orchestratorOf = (run: RunSummary): string => `${run.group}/${ORCHESTRATOR}`;
const eventNamed = (e: SnapshotEvent, name: string): boolean => e.kind === "event" && ((e.event as string | null | undefined) === name || new RegExp(`^${name}\\b`).test(e.body));
const isQuiet = (e: SnapshotEvent): boolean => eventNamed(e, "quiet");
/** A quiet member came back: a `back` event, or any post of its own after the quiet. */
const quietAnswered = (quiet: SnapshotEvent, events: SnapshotEvent[]): boolean =>
  events.some((e) => e.seq > quiet.seq && e.from === quiet.from && (eventNamed(e, "back") || e.kind !== "event"));

function tabOf(snap: BoardSnapshot, run: RunSummary): RunTab {
  const orch = orchestratorOf(run);
  const quiet = snap.events.some((e) => e.from === orch && isQuiet(e) && !quietAnswered(e, snap.events));
  const state = !run.open ? "closed" : quiet ? "quiet" : "live";
  return { run: run.run, code: run.code, title: run.title, kind: run.kind, state, done: run.done, of: run.of };
}

/** The open runs, in opening order. */
export function runTabs(snap: BoardSnapshot): RunTab[] {
  return snap.runs
    .filter((r) => r.open)
    .sort((a, b) => a.run - b.run)
    .map((r) => tabOf(snap, r));
}

/** The closed runs, newest first, matched on title, code and orchestrator. */
export function archive(snap: BoardSnapshot, query: string): ArchivedRun[] {
  const q = query.trim().toLowerCase();
  return snap.runs
    .filter((r) => !r.open)
    .map((r): ArchivedRun => {
      const closedAt = snap.events.find((e) => e.kind === "event" && e.body === `run ${r.run} closed`)?.at ?? "";
      const orch = orchestratorOf(r);
      const orchestrator = snap.roster.find((m) => m.runner === orch)?.nick || orch;
      return { ...tabOf(snap, r), closed: closedAt, outcome: null, orchestrator };
    })
    .filter((a) => !q || [a.title, a.code, a.orchestrator].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.closed.localeCompare(a.closed) || b.run - a.run);
}

/** A held file (D16): a post about a path that names one of its holders, by a member not holding it. */
function heldFileOf(snap: BoardSnapshot, e: SnapshotEvent, ctx: MentionCtx): { path: string; holders: string[] } | null {
  if (e.kind !== "msg" || !e.about) return null;
  const holders = snap.files.find((f) => f.path === e.about)?.holders ?? [];
  if (holders.includes(e.from)) return null;
  const named = targets(e, ctx).filter((t) => holders.includes(t));
  return named.length ? { path: e.about, holders: named } : null;
}

const QUESTION = /^@orchestrator new question:/;

/** One event as an item: its tier, word, tip and state, read from the thread (D8, D9, D16). */
function itemOf(snap: BoardSnapshot, e: SnapshotEvent, run: RunSummary, ctx: MentionCtx): Item {
  const base = { seq: e.seq, at: e.at, run: run.run, from: e.from };
  const said = (kind: ItemKind, tier: Tier, word: string | null, tip: string | null, state: string | null = null): Item => ({
    ...base,
    kind,
    tier,
    word,
    tip,
    text: e.body,
    joined: false,
    state,
  });
  if (flagOf(e)) {
    const answer = flagAnswer(e, snap.events);
    if (answer.state === "settled") return said("settled", "decided", `⚑ flag settled by #${answer.seq}`, TIPS.settled, "settled");
    return said("flag", "act", "⚑ flag · open", TIPS.flag, answer.state);
  }
  if (isQuiet(e)) {
    const minutes = /(\d+)\s*min/.exec(e.body)?.[1];
    return said("quiet", "wait", minutes ? `◷ quiet ${minutes} min` : "◷ quiet", TIPS.quiet, quietAnswered(e, snap.events) ? "back" : null);
  }
  if (e.kind === "event") {
    const word = eventLine(e.body).word;
    return { ...base, kind: "event", text: e.body, tip: (word ? EVENT_TIPS[word] : undefined) ?? (e.event ? EVENT_TIPS[e.event] : undefined) ?? null };
  }
  if (e.kind === "urgent") return said("urgent", "act", "! urgent", TIPS.urgent);
  if (e.kind === "agreement") {
    const other = (e.mentions?.length ? e.mentions : targets(e, ctx)).find((t) => t !== e.from);
    const endorsed = snap.events.some((x) => x.kind === "endorsement" && x.seq > e.seq && x.body.includes(`#${e.seq}`));
    const word = `✔ agreed${other ? ` with ${memberText(snap, other)}` : ""}${endorsed ? ", endorsed" : ""}`;
    return said("agreement", "decided", word, TIPS.agreement, endorsed ? "endorsed" : null);
  }
  if (QUESTION.test(e.body)) {
    const orch = orchestratorOf(run);
    const answered = snap.events.some((x) => x.seq > e.seq && x.from === orch && ((e.about != null && x.about === e.about) || targets(x, ctx).includes(e.from)));
    return said("question", "wait", `? question for ${memberText(snap, orch)}`, TIPS.question, answered ? "answered" : null);
  }
  const held = heldFileOf(snap, e, ctx);
  if (held) {
    const answered = snap.events.some((x) => x.seq > e.seq && x.about === held.path && held.holders.includes(x.from));
    return said("held", "wait", answered ? "held file · answered" : "held file", TIPS.held, answered ? "answered" : null);
  }
  return said("message", e.kind === "endorsement" ? "decided" : "talk", null, null);
}

/** The one conversation, filtered to the pick (D1, D14): every open run's items (All); a run's
 *  items and those naming its members; or the followed member's items and those naming it.
 *  Consecutive messages of one member join. */
export function conversation(snap: BoardSnapshot, pick: Pick): Item[] {
  const ctx = mentionCtx(snap);
  const picked = pick.run == null ? null : (snap.runs.find((r) => r.run === pick.run) ?? null);
  const members = new Set(picked ? membersOf(snap, picked).map((m) => m.runner) : []);
  // the board's stored mentions (a flag's holder and writer) or the body's
  const namesPicked = (e: SnapshotEvent): boolean => !!picked && [...(e.mentions ?? []), ...targets(e, ctx)].some((t) => members.has(t) || t === `${picked.group}/*`);
  const items: Item[] = [];
  for (const e of [...snap.events].sort((a, b) => a.seq - b.seq)) {
    const run = runOf(snap, e);
    if (!run) continue;
    if (pick.follow) {
      if (!involves(e, pick.follow, ctx)) continue;
    } else if (picked) {
      if (run.run !== picked.run && !namesPicked(e)) continue;
    } else if (!run.open) continue;
    const item = itemOf(snap, e, run, ctx);
    const prev = items[items.length - 1];
    const joins = item.kind === "message" && prev?.kind === "message" && prev.from === item.from;
    items.push(joins ? { ...item, joined: true } : item);
  }
  return items;
}

/** A run's members, orchestrator first; none for a closed run. */
export function agents(snap: BoardSnapshot, run: RunId): SnapshotRunner[] {
  const r = snap.runs.find((x) => x.run === run);
  return r?.open ? orderRoster(membersOf(snap, r)) : [];
}

/** The held files with their holders: those held by one run's members, or every one (null). */
export function claimRows(snap: BoardSnapshot, run: RunId | null): { path: string; holders: string[]; shared: boolean }[] {
  const r = run == null ? null : snap.runs.find((x) => x.run === run);
  if (run != null && !r) return [];
  const inRun = (holder: string): boolean => !r || splitRunner(holder).plan === r.group;
  return snap.files.filter((f) => f.holders.some(inRun)).map((f) => ({ path: f.path, holders: f.holders, shared: f.holders.length > 1 }));
}

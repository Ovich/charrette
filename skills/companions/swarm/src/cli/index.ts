// CLI dispatch — the agent-facing surface of the board. Human output is short lines an
// agent reads; --json prints the same data as one object; errors go to stderr, exit 1.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openBoard, type Board, type Declared, type Delivery, type Flag, type Kind, type Message, type Participant, type PhaseProgress, type RosterEntry, type RunStats, type SliceSpec, type SliceState } from "../board/board.ts";
import { profileOf } from "../board/kinds.ts";
import { EVENTS, eventOf, formatSubscriptions, parseSubscriptions, type Subscription } from "../board/events.ts";
import { DATA_ROOT, SQLITE_PATH } from "../board/home.ts";
import { parseArgs } from "./args.ts";
import { fullText, seqLine } from "./format.ts";
import { nameHandle, unmatchedMentions } from "../board/mentions.ts";
import { registerBoardDocument } from "./aiview-document.ts";
import { unclaimedLines } from "./unclaimed.ts";
import { git } from "./git.ts";
import { conflictsOf, headReflogLength } from "./conflicts.ts";
import { readTranscript } from "../board/liveness.ts";

const args = parseArgs(process.argv.slice(2));
const asJson = args.has("--json");
/** How often a pending wait asks whether the board's upkeep is due; only a due one does any work. */
const WAIT_UPKEEP_TICK_MS = 1000;

const USAGE = [
  "usage: swarm <verb> [--json]        (swarm --help code: the claim and merge verbs)",
  "  open    --kind plan|brainstorm --group <slug> --title <t> --seats <file.json> [--link <url>] [--transcript <path>] [--stall-ms <ms>]   # opens a run, registers the project's board in aiview, starts its stall poller, prints the run id then the board's URL (orchestrator)",
  "          # --transcript: your own transcript, its token counter read for the stall check; --stall-ms: no counter moved this long posts stalled, default 5000",
  "          # --plan <slug> --slices <file.json>: the same as --kind plan --group <slug> --seats <file.json>",
  '          # the seats file: [{"id", "title", "role"?, "blockers": [...], "link"?: "<URL>", "on"?: ["agreement", …], "transcript"?: "<path>"}]',
  "  slice   <id> --run <id> [--state ready|running|done|blocked] [--transcript <path>]   # --transcript: the dispatched member's transcript, after dispatch (orchestrator)",
  "  slice   add <id> --run <id> --title <t> [--blockers a,b] [--link <url>] [--role <r>] [--on <events>]   # adds a slice or seat mid-run (orchestrator)",
  "  phase   <name> <text> [--as <member>]                           # opens phase <name>; the current phase ends with it: a separator on the thread that wakes every member of the run (orchestrator)",
  "  done    <phase> [--as <member>]                                 # your part of the current phase is in: tells the orchestrator; when every member is done, the board tells it",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --seat <id> --doing <t> [--files "<path>:interface,<path>:inside,…"]   # --slice <id> the same; prints the roster, then how you listen: a seat waits in the foreground, a slice runner listens in the background',
  "          # --on <events>: what wakes your wait --mentions besides mentions and urgent posts, e.g. agreement,any:merged; else the seat row's on, else the kind's defaults",
  "  subscribe   [--as <member>] <events>                            # prints your subscriptions after",
  "  unsubscribe [--as <member>] <events>",
  "  doing   [--as <member>] <text>",
  "  post    [--as <member>] <body> [--about <path|decision id>]   # prints the seq",
  "  agree   [--as <member>] <terms> [--about <path|decision id>]  # prints the seq",
  "  endorse [--as <member>] <seq>                                   # backs an agreement; prints the endorsement's seq",
  "  read    <seq>",
  "  thread  [--as <member>] [<phase>]                               # every post of a phase in full (the current one by default): read it before you decide or add",
  "  deliver [--as <member>]                                         # what you have not had: mentions in full, the rest one line (a seat's run: every post in full)",
  "  wait    [--as <member>] [--timeout <ms>] [--mentions]           # blocks until a message for you, then says how to re-arm; nothing on timeout or end; a newer wait supersedes it",
  "          # once your run is closed, wait, deliver, read, roster --as, post, agree, endorse, doing and done answer: run <id> closed: run end …",
  "          # --mentions: only a mention of you, an urgent post or an event you subscribed to ends it; the rest stays for deliver (a seat's run: the wake brings every unread post)",
  "  roster  [--repo <path>] [--as <member>]",
  "  end     [--as <member>]                                         # claims or flags what you wrote unclaimed, then releases your claims and the lock",
  "  status                                                          # data home, open runs, each run's phase and its n/m done",
  "  config  retention [<days>]                                      # prints, or sets then prints, how many days closed runs and main's talk are kept",
  `events: ${Object.keys(EVENTS).join(", ")}; any:<event> for one posted in any run`,
  "a member is <group>/<seat>, the orchestrator <group>/orchestrator; without --as, the runner joined from this worktree",
].join("\n");

/** The verbs of a kind with claims (a plan run's), apart from the core (D22). */
const CODE_USAGE = [
  "usage: swarm <verb> [--json]        the code verbs; refused on a run whose kind has no claims",
  "  claim   [--as <runner>] <path> [--interface] [--new]            # before editing a file: exit 0 claimed, 3 held until you post about it (the post claims it); --new: a file you create",
  "  release [--as <runner>] <path>                                  # gives up a claim",
  "  merge-lock --onto <branch> [--as <runner>]                      # one merge at a time per repository; claims or flags what your branch wrote unclaimed",
  "  merged  [--as <runner>] <sha> --files <path>...                 # releases the lock, tells who must rebase and who was refused the lock, names whom to tell of a resolved conflict",
].join("\n");

/** `stats` is for an outside reader, never a member: not in USAGE, its own help (D33). */
const STATS_USAGE = [
  "usage: swarm stats [--repo <path>] [--run <id>] [--since 30d|<ISO> | --all] [--closed] [--kind plan|brainstorm[,…]] [--json]",
  "  the figures of a repository's runs, oldest first, with the scope's totals; a figure not recorded or not computed yet is null, never 0",
  "  --since: runs open, or closed since then, default 30d, none with --run; --all: every run kept; --closed: closed runs only",
  "  without --json: one line per run; --json carries every figure, with the run ids, members and seqs to follow with swarm read <seq>",
].join("\n");

/** A length as an agent reads it: `2h 05m`, `12m`, `40s`; `—` when not known. */
const lengthText = (ms: number | null): string => {
  if (ms === null) return "—";
  const minutes = Math.floor(ms / 60_000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  return minutes >= 1 ? `${minutes}m` : `${Math.round(ms / 1000)}s`;
};
/** `stats`' line for a run (D34, D35): `<code> <title> · <kind> · <length> · <open|closed> · conflicts <n|unknown>`. */
const statsLine = (r: RunStats): string => {
  const c = r.plan?.conflicts;
  // no merge: —; not recorded: unknown; some merges unknown: <n> + <m> unknown
  const conflicts =
    !c || (r.recorded && r.firstMergeAtMs === null)
      ? "—"
      : c.known === null
        ? "unknown"
        : c.unknownMerges
          ? `${c.known} + ${c.unknownMerges} unknown`
          : String(c.known);
  return `${r.code} ${r.title} · ${r.kind} · ${lengthText(r.lengthMs)} · ${r.closedAt === null ? "open" : "closed"} · conflicts ${conflicts}`;
};

class CliError extends Error {}
const fail = (msg: string): never => {
  throw new CliError(msg);
};

const emit = (json: unknown, human: string | (() => void)): void => {
  if (asJson) console.log(JSON.stringify(json));
  else if (typeof human === "string") {
    if (human) console.log(human);
  } else human();
};

/** A `liveness` warning for a transcript `open` or `slice` registers, printed at once: a missing, empty or
 *  unparseable file is no transcript (an empty task-output file is the usual mistake); null when it reads. */
function transcriptWarning(member: string, file: string): string | null {
  let size: number;
  try {
    size = fs.statSync(file).size;
  } catch {
    return `liveness: ${member}'s transcript ${file} does not exist: the stall check is blind for it; register the agent's own transcript`;
  }
  if (size === 0) return `liveness: ${member}'s transcript ${file} is empty: not a transcript, the stall check is blind for it; register the agent's own transcript, not its task output`;
  if (!readTranscript(file, null)) return `liveness: ${member}'s transcript ${file} is in no known format: the stall check is blind for it; register the agent's own transcript`;
  return null;
}

/** The repository (D29): its common git dir, so every worktree of one repository is one. */
function repoOf(dir: string): string {
  const common = git(dir, "rev-parse", "--git-common-dir");
  if (!common) fail(`not in a git repository: ${dir}`);
  const abs = path.resolve(dir, common as string);
  try {
    return fs.realpathSync.native(abs);
  } catch {
    return abs;
  }
}

/** The worktree the CLI runs in, as registered at join (D28). */
function worktreeOf(dir: string): string | null {
  const top = git(dir, "rev-parse", "--show-toplevel");
  return top ? path.resolve(top) : null;
}

/** Paths `git status` shows changed in a worktree, as it gives them; a rename gives both (D31). */
function changedIn(worktree: string): string[] {
  const r = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return fail(`git status failed in ${worktree}: ${r.stderr.trim()}`);
  const parts = r.stdout.split("\0");
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    out.push(e.slice(3));
    if (/[RC]/.test(e.slice(0, 2)) && parts[i + 1]) out.push(parts[++i]); // -z: "R  new\0old\0"
  }
  return out;
}

/** Paths the worktree's branch changed since it left `onto`, committed or not; a rename gives both (D59). */
function branchChangedIn(worktree: string, onto: string): string[] {
  const base = git(worktree, "merge-base", onto, "HEAD") ?? fail(`no merge base between ${onto} and HEAD in ${worktree}: is --onto the branch you merge into?`);
  // --no-renames: a rename is its deletion and its addition, both paths
  const r = spawnSync("git", ["diff", "--name-only", "-z", "--no-renames", `${base}..HEAD`], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return fail(`git diff failed in ${worktree}: ${r.stderr.trim()}`);
  const committed = r.stdout.split("\0").filter(Boolean);
  return [...new Set([...committed, ...changedIn(worktree)])];
}

/** The reconcile's lines: each file, then each flag on the thread (D58, D59). */
const printReconciled = (reconciled: string[], flags: Flag[]): void => {
  for (const line of unclaimedLines(reconciled)) console.log(line);
  for (const f of flags) console.log(`#${f.seq} flagged: you wrote ${f.path} outside your claim; ${f.holder} holds it. Settle it with @${f.holder} on the thread.`);
};

/** The tool's folder (swarm.mjs's), the aiview skill beside it. */
const toolRoot = (): string => process.env.SWARM_ROOT ?? path.dirname(path.resolve(process.argv[1]));

const need = (flag: string): string => args.flag(flag) ?? fail(`${flag} is required\n${USAGE}`);

const runArg = (): number => {
  const raw = need("--run");
  const id = Number(raw);
  if (!Number.isInteger(id)) fail(`--run takes a run id, got ${raw}`);
  return id;
};

/** The caller: --as names it; otherwise the runner that joined from this worktree. */
function caller(board: Board): Participant {
  const as = args.flag("--as");
  if (as) return board.participant(as) ?? fail(`unknown runner ${as}`);
  const wt = worktreeOf(process.cwd());
  const p = wt ? board.identify({ worktree: wt }) : null;
  return p ?? fail("who is calling? no single runner joined from this worktree; pass --as <plan>/<slice>");
}

const rosterLine = (r: RosterEntry): string => {
  const files = r.files.map((f) => (f.interface ? `${f.path} (interface)` : f.path)).join(", ");
  // the funny name beside the runner (D43); an orchestrator is its name alone
  const who = r.slice === "orchestrator" ? r.name : `${r.nick} · ${r.name}`;
  const on = r.subscriptions.length ? `  on: ${formatSubscriptions(r.subscriptions)}` : "";
  return `${who}${r.stale ? " (stale)" : ""}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}${on}`;
};

/** The run's current phase as the header of what a member reads: `phase <name>: <text>`; null before the first phase. */
const phaseHeader = (board: Board, run: number): string | null => {
  const ph = board.currentPhase(run);
  return ph ? `phase ${ph.name}: ${ph.text}` : null;
};
/** `phase <name>: <text>  <n>/<m> done` beside a run's title, or nothing before its first phase. */
const phaseSuffix = (phase: { name: string; text: string } | null, progress: PhaseProgress | null): string =>
  phase ? `  phase ${phase.name}: ${phase.text}${progress ? `  ${progress.done}/${progress.of} done` : ""}` : "";

/** The run's stall poller: its pid file in the data home. */
const pollerPidFile = (run: number): string => path.join(DATA_ROOT, `swarm-poll-${run}.pid`);
/** Starts the run's poller, detached, no console window: it reads the token counters every second
 *  and exits once its run is closed. SWARM_NO_POLLER=1 starts none (tests). */
function startPoller(run: number): void {
  if (process.env.SWARM_NO_POLLER === "1") return;
  const child = spawn(process.execPath, [process.argv[1], "poll", "--run", String(run)], { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}
/** Stops the run's poller, when one runs; it would exit by itself at its next tick. */
function stopPoller(run: number): void {
  const file = pollerPidFile(run);
  try {
    const pid = Number(fs.readFileSync(file, "utf8").trim());
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) process.kill(pid);
  } catch {}
  try {
    fs.rmSync(file, { force: true });
  } catch {}
}
/** How often the poller reads the counters. */
const POLL_MS = 1000;

/** A delivery as the member reads it: each event followed by the line its registry row gives (D36, D59). */
const withNext = (me: Participant, d: Delivery): Delivery & { full: (Message & { endorse?: string })[] } => ({
  ...d,
  full: d.full.map((m) => {
    const e = eventOf(m);
    const line = e ? (EVENTS[e].next?.(m, me, self().join(" ")) ?? null) : null;
    // `endorse`: the JSON field the back-it line has always had
    return line ? { ...m, endorse: line } : m;
  }),
});

const printDelivery = (d: Delivery & { full: (Message & { endorse?: string })[] }): void => {
  for (const m of d.full) {
    console.log(fullText(m));
    if (m.endorse) console.log(m.endorse);
  }
  for (const l of d.lines) console.log(l);
};

/** A word of a POSIX command line, double-quoted when it holds anything else than plain characters. */
const shellWord = (w: string): string => (/^[\w@%+=:,./-]+$/.test(w) ? w : `"${w.replace(/(["\\$`])/g, "\\$1")}"`);

/** This CLI as a runner calls it: `node <skill-dir>/swarm.mjs`, as the skill writes it and the allow
 *  rule matches it; forward slashes, which Node takes on Windows too and no shell eats (D49). */
const self = (): string[] => ["node", shellWord(process.argv[1].replace(/\\/g, "/"))];

/** How a member listens, the one source the docs point at: a seat waits in the foreground (a subagent
 *  that ends its turn is gone, no background listener wakes it); the orchestrator and a slice runner
 *  listen in the background while they work. */
const listensInForeground = (p: Pick<Participant, "slice" | "kind">): boolean => p.slice !== "orchestrator" && profileOf(p.kind).member === "seat";
const waitCommand = (name: string): string => [...self(), "wait", "--mentions", "--as", shellWord(name)].join(" ");
/** The line that starts a member's listener: the exact command, --as included (D61); `afterPhase`: it
 *  follows the owed-phase line, so a seat waits only once its part is in. */
const listenNow = (p: Pick<Participant, "name" | "slice" | "kind">, afterPhase = false): string =>
  listensInForeground(p)
    ? `${afterPhase ? "only then wait" : "wait now"}, in the foreground (never a background listener: a seat that ends its turn is gone): ${waitCommand(p.name)}`
    : `start your listener now, in the background (your harness's background task): ${waitCommand(p.name)}`;

/** The step a member owing the run's open phase takes before any wait: a member that joined, or woke,
 *  after the phase event passed does its part now, never sleeps through it; null when it owes none. */
const owedLine = (board: Board, p: Participant, thread = true): string | null => {
  const ph = board.owedPhase(p);
  if (!ph) return null;
  // in a whole-thread run the part starts from the phase's whole discussion, never from the last post alone
  const read = thread && profileOf(p.kind).wholeThread ? `Read the whole phase first: ${[...self(), "thread", "--as", shellWord(p.name)].join(" ")}. ` : "";
  return `phase ${ph.name} is open and asks: ${ph.text}. ${read}Do your part now, then: ${[...self(), "done", shellWord(ph.name), "--as", shellWord(p.name)].join(" ")}`;
};
/** A member's next step where it would be told to listen: the owed phase first, when it owes one. */
const nextStep = (board: Board, p: Participant): string => {
  const owed = owedLine(board, p);
  return owed ? `${owed}
${listenNow(p, true)}` : listenNow(p);
};

/** A member whose run is closed (the close ended it): every member verb answers with this one line, exit 0. */
const closedLine = (p: Participant): string =>
  `run ${p.run} closed: run end and return your summary: ${[...self(), "end", "--as", shellWord(p.name)].join(" ")}`;
/** True, having printed the closed line, when `p`'s run is closed: the verb writes nothing more. */
const answeredClosed = (board: Board, p: Participant): boolean => {
  if (board.runs().some((r) => r.id === p.run)) return false;
  const line = closedLine(p);
  emit({ run: p.run, closed: true, next: line }, line);
  return true;
};

/** A verb's output, then the listener line when the caller has no `wait --mentions` pending and has
 *  not ended (D61), once per call; --json carries it as `next`. */
/** One line per `@…` of `body` that names no member (D63): the closest active names, at most three. */
const unmatchedLines = (board: Board, p: Participant, body: string): string[] => {
  const roster = board.roster(p.repo);
  const runners = roster.filter((r) => r.slice !== "orchestrator");
  const plans = [...new Set(roster.map((r) => r.plan))];
  const names = new Map(runners.map((r) => [nameHandle(r.nick), r.name]));
  const nickOf = new Map(runners.map((r) => [r.name, r.nick.replace(/\s+/g, "")]));
  return unmatchedMentions(body, p.plan, plans, names).map(({ name, closest }) => {
    const guesses = closest.map((c) => (nickOf.has(c) ? `@${c} or @${nickOf.get(c)}` : `@${c}`));
    return `@${name} matched nobody on the board${guesses.length ? `: did you mean ${guesses.join(", ")}?` : ""}`;
  });
};

const emitHeard = (board: Board, p: Participant, json: object, human: string | (() => void)): void => {
  const next = !p.ended && !p.listening ? nextStep(board, p) : null;
  emit(next ? { ...json, next } : json, () => {
    if (typeof human === "string") console.log(human);
    else human();
    if (next) console.log(next);
  });
};

/** The file a relative path means (D6): from the current folder when it exists there, else from
 *  the repository root when it exists there; neither refuses, unless `--new` creates it here. */
function resolveClaimPath(file: string): string {
  if (path.isAbsolute(file)) return file;
  const here = path.resolve(file);
  if (fs.existsSync(here)) return here;
  const root = worktreeOf(process.cwd());
  const fromRoot = root ? path.resolve(root, file) : null;
  if (fromRoot && fs.existsSync(fromRoot)) return fromRoot;
  if (args.has("--new")) return here;
  return fail(`no such file: ${here}${fromRoot && fromRoot !== here ? ` nor ${fromRoot}` : ""}; pass --new if you are creating it`);
}

/** Repository-relative, forward slashes: what the board stores and every answer names. */
function repoRelative(abs: string): string {
  const root = worktreeOf(process.cwd());
  const rel = root ? path.relative(root, abs) : abs;
  return rel.split(path.sep).join("/");
}

/** `--about`: a path (it has a slash) resolved and made repository-relative; a decision id or a bare name as given. */
function aboutArg(): string | undefined {
  const about = args.flag("--about");
  if (about === undefined || !/[\\/]/.test(about)) return about;
  return repoRelative(resolveClaimPath(about));
}

/** `<path>`, `<path>:inside` or `<path>:interface`, the path resolved (D6). */
function parseFile(spec: string): Declared {
  const m = spec.match(/^(.*):(interface|inside)$/);
  const d = m ? { path: m[1], interface: m[2] === "interface" } : { path: spec, interface: false };
  return { ...d, path: repoRelative(resolveClaimPath(d.path)) };
}

function readSlices(file: string): SliceSpec[] {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  } catch (e) {
    return fail(`cannot read slices from ${file}: ${(e as Error).message}`);
  }
  const list = Array.isArray(raw) ? raw : (raw as { slices?: unknown }).slices;
  if (!Array.isArray(list)) return fail(`${file}: expected an array of {id, title, blockers}`);
  return list.map((s: { id?: unknown; title?: unknown; role?: unknown; blockers?: unknown; link?: unknown; on?: unknown; transcript?: unknown }) => {
    if (typeof s.id !== "string") fail(`${file}: a slice without an id`);
    return {
      id: String(s.id),
      title: String(s.title ?? s.id),
      ...(typeof s.role === "string" && s.role ? { role: s.role } : {}),
      blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [],
      link: typeof s.link === "string" && s.link ? s.link : null,
      ...(Array.isArray(s.on) ? { on: s.on.map(String) } : {}),
      ...(typeof s.transcript === "string" && s.transcript ? { transcript: path.resolve(s.transcript) } : {}),
    };
  });
}

/** The board's upkeep, when due (D19, D45, companions-merge D16): prune past the retention, then
 *  flag stale runs and quiet orchestrators. Before every verb and on each tick of a pending wait;
 *  a failure is told on stderr and never stops the verb. */
function boardUpkeep(board: Board): void {
  try {
    board.upkeepIfDue();
  } catch (e) {
    console.error(`swarm: upkeep failed: ${(e as Error).message}`);
  }
}

/** `open`'s kind and group: `--plan <slug>` is `--kind plan --group <slug>` (D22). */
function openKindAndGroup(): { kind: Kind; group: string } {
  const raw = args.flag("--kind") ?? "plan";
  let kind: Kind;
  try {
    kind = profileOf(raw).kind;
  } catch (e) {
    return fail(`open: ${(e as Error).message}`);
  }
  const plan = args.flag("--plan");
  if (plan !== undefined && kind !== "plan") fail(`open: --plan means --kind plan; a ${kind} run takes --group <slug>`);
  const group = args.flag("--group") ?? plan ?? fail(`open: --group <slug> is required (or --plan <slug> for a plan run)\n${USAGE}`);
  return { kind, group };
}

/** `join`'s member id: `--seat` is `--slice` (D49); both, naming different ids, refused. */
function joinedSeat(): string {
  const seat = args.flag("--seat");
  const slice = args.flag("--slice");
  if (seat !== undefined && slice !== undefined && seat !== slice) fail(`join: --seat ${seat} and --slice ${slice} name different members; pass one`);
  return seat ?? slice ?? fail(`--seat (or --slice) is required\n${USAGE}`);
}

/** What a seat's join tells it of its posts, before the listener line (D2). */
const SEAT_POSTS_DRAW = "posts render markdown and mermaid: compare in a table, draw a flow as a mermaid block";

/** The commands a member of a kind without worktree runs next, `--as` filled in (D21, D36). */
const seatCommands = (as: string): string[] => {
  const cli = self().join(" ");
  const who = `--as ${shellWord(as)}`;
  return [
    `${cli} post "…" --about <D id> ${who}`,
    `${cli} agree "…" --about <D id> ${who}`,
    `${cli} endorse <seq> ${who}`,
    `${cli} wait --mentions ${who}    # in the foreground, when waiting`,
  ];
};

/** `--on`/`subscribe`'s events; an unknown name fails, listing the known ones (D59). */
const subscriptionsArg = (spec: string): Subscription[] => {
  try {
    return parseSubscriptions(spec);
  } catch (e) {
    return fail((e as Error).message);
  }
};

/** Main is gone (D12): the conversation is one, a mention says who is meant. */
const NO_MAIN = "there is no Main any more: the conversation is one; mention who you mean (@IW, @IW·SL3, @swarm)";

async function main(board: Board): Promise<void> {
  if ((args.verb === "post" || args.verb === "agree" || args.verb === "endorse") && args.has("--main")) {
    console.error(NO_MAIN);
    process.exitCode = 2;
    return;
  }
  switch (args.verb) {
    case "config": {
      const setting = args.positional[0];
      if (setting !== "retention") fail(`config: the one setting is retention\n${USAGE}`);
      const raw = args.positional[1];
      const value = raw === undefined ? undefined : Number(raw);
      const days = board.setting("retention-days", value);
      emit({ retention: days }, String(days));
      break;
    }
    case "open": {
      const { kind, group } = openKindAndGroup();
      const plan = group;
      const seatsFile = args.flag("--seats") ?? args.flag("--slices") ?? fail(`open: --seats <file.json> is required (or --slices)\n${USAGE}`);
      const rawStall = args.flag("--stall-ms");
      const stallMs = rawStall === undefined ? undefined : Number(rawStall);
      if (stallMs !== undefined && !(Number.isInteger(stallMs) && stallMs > 0)) fail(`--stall-ms takes a positive whole number of ms, got ${rawStall}`);
      const transcript = args.flag("--transcript");
      const run = board.openRun({
        repo: repoOf(process.cwd()),
        kind,
        group,
        title: need("--title"),
        link: args.flag("--link") ?? null,
        seats: readSlices(seatsFile),
        ...(transcript ? { transcript: path.resolve(transcript) } : {}),
        ...(stallMs !== undefined ? { stallMs } : {}),
      });
      startPoller(run.id);
      // a transcript that will not read, said now, naming the path
      const warning = transcript ? transcriptWarning("orchestrator", path.resolve(transcript)) : null;
      // the person watches the project's board in aiview, pinned first (plan D17, D30, D39)
      const doc = registerBoardDocument({ toolRoot: toolRoot(), cwd: process.cwd(), repo: run.repo });
      if (!doc.registered) {
        // the run is open all the same; swarm has no page of its own (companions-merge D13)
        console.error(`swarm: ${doc.reason}: the run is open; its board is read in aiview once aiview is installed and knows this project`);
        emit({ run: run.id, repo: run.repo, kind: run.kind, group: run.group, plan: run.plan, url: null, ...(warning ? { warning } : {}) }, [String(run.id), warning].filter(Boolean).join("\n"));
        break;
      }
      emit({ run: run.id, repo: run.repo, kind: run.kind, group: run.group, plan: run.plan, url: doc.url, ...(warning ? { warning } : {}) }, [String(run.id), doc.url, warning].filter(Boolean).join("\n"));
      break;
    }
    case "slice": {
      if (args.positional[0] === "add") {
        const id = args.positional[1] ?? fail(`slice add: which id?\n${USAGE}`);
        const run = runArg();
        const on = args.flag("--on");
        if (on !== undefined) subscriptionsArg(on);
        const role = args.flag("--role");
        const added = board.addSlice(run, {
          id,
          title: need("--title"),
          ...(role ? { role } : {}),
          blockers: args.list("--blockers"),
          link: args.flag("--link") ?? null,
          ...(on !== undefined ? { on: on.split(",").map((x) => x.trim()).filter(Boolean) } : {}),
        });
        emit({ run, slice: added }, `${id} added`);
        break;
      }
      const id = args.positional[0] ?? fail(`slice: which slice?\n${USAGE}`);
      const run = runArg();
      const transcript = args.flag("--transcript");
      const state = (transcript === undefined ? need("--state") : args.flag("--state")) as SliceState | undefined;
      if (state !== undefined) board.setSliceState(run, id, state);
      // the dispatched member's transcript: its token counter, read for the stall check
      const liveness = transcript !== undefined ? board.registerTranscript(run, id, path.resolve(transcript)) : undefined;
      // a transcript that will not read, said now, naming the path
      const warning = transcript !== undefined ? transcriptWarning(id, path.resolve(transcript)) : null;
      const said = [
        state !== undefined ? `${id} ${state}` : null,
        liveness && !warning ? `${id} transcript ${liveness.state === "ok" ? `read, ${liveness.tokens} tokens` : "not readable yet: the board warned on the thread"}` : null,
        warning,
      ];
      emit({ run, slice: id, ...(state !== undefined ? { state } : {}), ...(liveness ? { liveness } : {}), ...(warning ? { warning } : {}) }, said.filter(Boolean).join("\n"));
      break;
    }
    case "close": {
      const run = runArg();
      board.closeRun(run);
      stopPoller(run);
      emit({ run, state: "closed" }, `run ${run} closed`);
      break;
    }
    case "phase": {
      const p = caller(board);
      const [name, ...said] = args.positional;
      if (!name) fail(`phase: which phase?
${USAGE}`);
      const text = said.join(" ") || fail(`phase ${name}: what does it ask?`);
      const m = board.phase(p, name, text);
      // the orchestrator's next step (rule 10): its listener hears each member's done; the board says when all are in
      const cli = self().join(" ");
      const next = `phase ${name} is open; listen for each member's done in the background: ${cli} wait --mentions --as ${shellWord(p.name)}. When the board says every member is done, open the next phase: ${cli} phase <name> "<text>" --as ${shellWord(p.name)}; after the last, ${cli} close --run ${m.run}`;
      emit({ seq: m.seq, run: m.run, phase: name, next }, () => {
        console.log(seqLine(m));
        console.log(next);
      });
      break;
    }
    case "done": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const name = args.positional[0] ?? fail(`done: which phase?\n${USAGE}`);
      const r = board.done(p, name);
      // the member's next step (rule 10): wait for the next phase
      const next = `wait for the next phase, in the foreground: ${self().join(" ")} wait --mentions --as ${shellWord(p.name)}`;
      emit({ runner: p.name, phase: name, done: r.progress.done, of: r.progress.of, all: r.all, already: r.already, next }, () => {
        console.log(`${r.already ? "already done" : "done"} ${name}: ${r.progress.done}/${r.progress.of} members done${r.all ? "; the orchestrator is told every member is done" : ""}`);
        console.log(next);
      });
      break;
    }
    case "poll": {
      // the run's stall poller, started detached by open: not a member's verb, so not in the usage
      const run = runArg();
      const pidFile = pollerPidFile(run);
      fs.mkdirSync(path.dirname(pidFile), { recursive: true });
      fs.writeFileSync(pidFile, String(process.pid));
      const mine = (): boolean => {
        try {
          return fs.readFileSync(pidFile, "utf8").trim() === String(process.pid);
        } catch {
          return false;
        }
      };
      for (;;) {
        // its run closed, its pid file taken or gone, or the store gone: it stops
        if (!mine() || !fs.existsSync(SQLITE_PATH)) break;
        let open = true;
        try {
          open = board.livenessTick(run);
        } catch (e) {
          console.error(`swarm poll: ${(e as Error).message}`);
        }
        if (!open) break;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }
      if (mine()) fs.rmSync(pidFile, { force: true });
      break;
    }
    case "join": {
      const { runner, roster } = board.join({
        run: runArg(),
        slice: joinedSeat(),
        doing: need("--doing"),
        files: [...args.list("--files"), ...args.flags("--file")].map(parseFile),
        worktree: worktreeOf(process.cwd()) ?? undefined,
        ...(args.flag("--on") !== undefined ? { on: subscriptionsArg(args.flag("--on")!) } : {}),
      });
      // the runner's next step, last: the open phase it owes, then its listener (D61)
      const next = nextStep(board, runner);
      // a kind without worktree: the checkout is shared, so every call names the member (D21, D36)
      const shared = !profileOf(runner.kind).worktree;
      const as = shared ? `pass --as ${runner.name} on every call: this checkout is shared, the board cannot tell you apart` : null;
      const commands = shared ? seatCommands(runner.name) : null;
      // a seat posts what it compares as a table, what flows as mermaid: low-effort seats do what the board prints (D2)
      const drawing = profileOf(runner.kind).member === "seat" ? SEAT_POSTS_DRAW : null;
      // the run's current phase after the roster: a late or restarted member starts in it
      const phase = phaseHeader(board, runner.run);
      emit({ runner: runner.name, nick: runner.nick, roster, phase, ...(shared ? { as: runner.name, commands } : {}), ...(drawing ? { drawing } : {}), next }, () => {
        console.log(`you are ${runner.name}, ${runner.nick}: @${runner.slice} or @${runner.nick.replace(/\s+/g, "")} mentions you`);
        for (const r of roster) console.log(rosterLine(r));
        if (phase) console.log(phase);
        if (as) console.log(as);
        for (const c of commands ?? []) console.log(c);
        if (drawing) console.log(drawing);
        console.log(next);
      });
      break;
    }
    case "subscribe":
    case "unsubscribe": {
      const p = caller(board);
      const subs = subscriptionsArg(args.positional.join(",") || fail(`${args.verb}: which events?`));
      const after = args.verb === "subscribe" ? board.subscribe(p, subs) : board.unsubscribe(p, subs);
      emitHeard(board, p, { runner: p.name, subscriptions: after }, `${p.name} wakes on: ${formatSubscriptions(after) || "mentions and urgent posts only"}`);
      break;
    }
    case "doing": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const text = args.positional.join(" ") || fail("doing: what?");
      board.setDoing(p, text);
      emitHeard(board, p, { runner: p.name, doing: text }, `${p.name} doing: ${text}`);
      break;
    }
    case "post":
    case "agree": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const body = args.positional.join(" ") || fail(`${args.verb}: nothing to say`);
      const m = board.post(p, body, {
        about: aboutArg(),
        kind: args.verb === "agree" ? "agreement" : "msg",
      });
      const unmatched = unmatchedLines(board, p, body);
      emitHeard(board, p, { seq: m.seq, mentions: m.mentions, run: m.run, ...(unmatched.length ? { unmatched } : {}), ...(m.claimed ? { claimed: m.claimed } : {}) }, () => {
        console.log(seqLine(m));
        // posting is claiming (D7)
        if (m.claimed) console.log(`claimed ${m.claimed.path}, shared with ${m.claimed.sharedWith.join(", ")}`);
        for (const line of unmatched) console.log(line);
      });
      break;
    }
    case "endorse": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const raw = (args.positional[0] ?? fail("endorse: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`endorse takes a seq, got ${raw}`);
      const m = board.endorse(p, seq);
      emitHeard(board, p, { seq: m.seq, endorses: m.endorses, run: m.run }, seqLine(m));
      break;
    }
    case "read": {
      const raw = (args.positional[0] ?? fail("read: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`read takes a seq, got ${raw}`);
      // a runner's read is a call of its own (D66); a reader no runner answers to reads all the same
      let by: Participant | undefined;
      try {
        by = caller(board);
      } catch (e) {
        if (!(e instanceof CliError)) throw e;
      }
      if (by && answeredClosed(board, by)) break;
      const m = board.read(seq, by);
      // the phase the message's run is in, first (the caller's run when one is known)
      const phase = phaseHeader(board, by?.run ?? m.run);
      // a member owing the open phase is told to do it, last
      const owes = by ? owedLine(board, by) : null;
      emit({ ...m, phase, ...(owes ? { next: owes } : {}) }, () => {
        if (phase) console.log(phase);
        console.log(fullText(m));
        if (owes) console.log(owes);
      });
      break;
    }
    case "thread": {
      const me = caller(board);
      if (answeredClosed(board, me)) break;
      const name = args.positional[0];
      const posts = board.thread(me, name);
      const phase = phaseHeader(board, me.run);
      const owes = owedLine(board, me, false);
      emit({ phase, posts, ...(owes ? { next: owes } : {}) }, () => {
        if (phase) console.log(phase);
        if (!posts.length) console.log(`no post yet in phase ${name ?? board.currentPhase(me.run)?.name ?? "-"}`);
        for (const m of posts) console.log(fullText(m));
        if (owes) console.log(owes);
      });
      break;
    }
    case "deliver": {
      const me = caller(board);
      if (answeredClosed(board, me)) break;
      const d = withNext(me, board.deliver(me));
      // the run's phase heads every delivery that carries something
      const phase = d.full.length || d.lines.length ? phaseHeader(board, me.run) : null;
      // a member owing the open phase is told to do it, last
      const owes = owedLine(board, me);
      emit({ phase, ...d, ...(owes ? { next: owes } : {}) }, () => {
        if (phase) console.log(phase);
        printDelivery(d);
        if (owes) console.log(owes);
      });
      break;
    }
    case "wait": {
      const p = caller(board);
      if (answeredClosed(board, p)) break;
      const raw = args.flag("--timeout");
      const timeout = raw === undefined ? undefined : Number(raw);
      if (timeout !== undefined && !(timeout >= 0)) fail(`--timeout takes milliseconds, got ${raw}`);
      const mentionsOnly = args.has("--mentions");
      // a run whose members all wait still gets its quiet and stale events: the wait keeps the upkeep going
      const upkeepTicks = setInterval(() => boardUpkeep(board), WAIT_UPKEEP_TICK_MS);
      const d = withNext(p, await board.wait(p, { timeoutMs: timeout, mentionsOnly }).finally(() => clearInterval(upkeepTicks)));
      // the run closed while this wait was pending: the close ended the member
      if (answeredClosed(board, p)) break;
      if (d.superseded) {
        emit(d, "superseded by a newer wait"); // a newer wait of this runner gets what arrives (D64)
        break;
      }
      if (!d.full.length && !d.lines.length) {
        emit(d, ""); // a timeout, or the runner ended: nothing to answer, nothing to re-arm
        break;
      }
      // the runner's next step, before the message: the exact command that re-arms this listener (D49)
      const again = [...self(), "wait"];
      if (mentionsOnly) again.push("--mentions");
      if (args.flag("--as")) again.push("--as", shellWord(args.flag("--as")!));
      if (raw !== undefined) again.push("--timeout", raw);
      if (asJson) again.push("--json");
      // a member owing the open phase does it before it waits again
      const owes = owedLine(board, p);
      const rearm = listensInForeground(p)
        ? owes
          ? `${owes}
only then wait again, in the foreground: ${again.join(" ")}`
          : `answer on the thread if needed, then wait again, in the foreground: ${again.join(" ")}`
        : p.slice === "orchestrator"
          ? `act on it, then start this listener again, in the background: ${again.join(" ")}`
          : `answer on the thread if needed, then start this listener again, in the background while you work, in the foreground when you are waiting: ${again.join(" ")}`;
      const next = owes && !listensInForeground(p) ? `${owes}
${rearm}` : rearm;
      // the run's phase first, so a member always knows which phase it answers in
      const phase = phaseHeader(board, p.run);
      emit({ phase, next, ...d }, () => {
        if (phase) console.log(phase);
        console.log(next);
        printDelivery(d);
      });
      break;
    }
    case "roster": {
      // a member asking (--as) learns its run closed
      if (args.flag("--as") && answeredClosed(board, caller(board))) break;
      const repo = repoOf(path.resolve(args.flag("--repo") ?? process.cwd()));
      const roster = board.roster(repo);
      // each run's title and phase above its members
      const runs = new Map(board.runs().filter((r) => r.repo === repo).map((r) => [r.id, r]));
      const progress = new Map([...runs.keys()].map((id) => [id, board.phaseProgress(id)]));
      emit({ repo, roster, runs: [...runs.values()].map((r) => ({ run: r.id, title: r.title, phase: r.phase, progress: progress.get(r.id) ?? null })) }, () => {
        let shown: number | null = null;
        for (const r of roster) {
          const run = runs.get(r.run);
          if (run && r.run !== shown) console.log(`run ${run.id}  ${run.title}${phaseSuffix(run.phase, progress.get(run.id) ?? null)}`);
          shown = r.run;
          console.log(rosterLine(r));
        }
      });
      break;
    }
    case "claim": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("claim: which path?");
      const abs = resolveClaimPath(file);
      const rel = repoRelative(abs);
      const verdict = board.checkEdit(p, abs, { interface: args.has("--interface") });
      // held (D41): exit 3, the runner posts about the path and claims again
      if (!verdict.allowed) process.exitCode = 3;
      emitHeard(board, p, verdict, () => {
        if (!verdict.allowed) return console.log(verdict.refusal);
        // the other holders are named once per runner and path, when the board says so (D40)
        const also = verdict.notice
          ? verdict.sharedWith.map((o) => `${o.runner} · ${board.participant(o.runner)?.nick ?? "?"}: ${o.doing}`).join("; ")
          : "";
        console.log(also ? `claimed ${rel}, also held by ${also}` : `claimed ${rel}`);
      });
      break;
    }
    case "release": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("release: which path?");
      const abs = resolveClaimPath(file);
      board.release(p, abs);
      emit({ runner: p.name, released: repoRelative(abs) }, `${p.name} released ${repoRelative(abs)}`);
      break;
    }
    case "merge-lock": {
      const p = caller(board);
      // the branch merged into: a worktree does not say which branch it left, so the runner names it (D59)
      const onto = need("--onto");
      // what the branch wrote without a claim, committed or not, before the lock; a flag informs, never blocks
      const reconciled = p.worktree ? branchChangedIn(p.worktree, onto) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      // where the worktree's HEAD reflog stands: merged replays only a rebase past it (D36)
      const reflogMark = p.worktree ? (headReflogLength(p.worktree) ?? undefined) : undefined;
      const r = board.lockMerge(p, onto, reflogMark);
      emit({ runner: p.name, ...r, reconciled, flags }, () => {
        printReconciled(reconciled, flags);
        console.log(r.granted ? "granted: merge, then swarm merged <sha> --files <path>..." : `held by ${r.holder}: swarm wait --mentions for its merged event`);
      });
      break;
    }
    case "merged": {
      const p = caller(board);
      const sha = args.positional[0] ?? fail("merged: which sha?");
      const files = args.list("--files");
      // what a rebase since the lock's grant met, read before the lock goes (D3, D25, D36); no worktree, no lock or no mark: unknown (D33)
      const lock = board.heldMergeLock(p);
      const conflicts = p.worktree && lock && lock.reflogMark !== null ? conflictsOf(p.worktree, lock.onto ?? "", lock.reflogMark) : undefined;
      const sharers = board.merged(p, sha, files.map((f) => path.resolve(f)), conflicts);
      // the post after a resolved conflict, prompted by the command just run (D63)
      const tell = sharers.map(
        (o) => `if you resolved a conflict in ${o.path}, tell them: swarm post "@${o.runner} I resolved ${o.path}: <how>" --about ${o.path}`,
      );
      emit({ runner: p.name, sha, files, tell }, () => {
        console.log(`merged ${sha}: lock released`);
        for (const line of tell) console.log(line);
      });
      break;
    }
    case "end": {
      const p = caller(board);
      // a member already ended, or its run closed: nothing to do, nothing to say
      if (p.ended || board.runs().every((r) => r.id !== p.run)) break;
      // what the runner wrote without claiming it, once, before its claims go (D58)
      const reconciled = p.worktree ? changedIn(p.worktree) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      board.end(p);
      emit({ runner: p.name, ended: true, reconciled, flags }, () => {
        printReconciled(reconciled, flags);
        console.log(`${p.name} ended`);
      });
      break;
    }
    case "stats": {
      // an outside reader's verb: no member identity, no write of its own (board D6)
      const raw = args.flag("--run");
      const run = raw === undefined ? undefined : Number(raw);
      if (run !== undefined && !Number.isInteger(run)) fail(`--run takes a run id, got ${raw}`);
      const all = args.has("--all");
      const since = args.flag("--since");
      if (all && args.has("--since")) fail("stats: --since or --all, not both");
      const kinds = args.list("--kind").map((k) => {
        try {
          return profileOf(k).kind;
        } catch (e) {
          return fail(`stats: ${(e as Error).message}`);
        }
      });
      const stats = board.stats({
        repo: repoOf(path.resolve(args.flag("--repo") ?? process.cwd())),
        ...(run !== undefined ? { run } : {}),
        // a named run is read whatever its age: no default period (plan D40)
        ...(all ? {} : since !== undefined ? { since } : run !== undefined ? {} : { since: "30d" }),
        ...(kinds.length ? { kinds } : {}),
        ...(args.has("--closed") ? { closedOnly: true } : {}),
      });
      emit(stats, () => {
        if (!stats.runs.length) console.log("no run in this scope");
        for (const r of stats.runs) console.log(statsLine(r));
        console.log("swarm stats --json for every figure");
      });
      break;
    }
    case "status": {
      const runs = board.runs();
      // each member's worktree, null for a seat or an orchestrator (D64)
      const membersOf = (r: (typeof runs)[number]) => board.roster(r.repo).filter((m) => m.run === r.id).map((m) => ({ name: m.name, nick: m.nick, worktree: m.worktree }));
      const open = runs.map((r) => ({ run: r.id, kind: r.kind, group: r.plan, title: r.title, phase: r.phase, progress: board.phaseProgress(r.id), members: membersOf(r) }));
      emit({ home: DATA_ROOT, sqlite: SQLITE_PATH, runs: runs.length, open }, () => {
        console.log(`home    ${DATA_ROOT}`);
        console.log(`sqlite  ${SQLITE_PATH}`);
        if (!runs.length) console.log("no open run");
        for (const r of runs) {
          console.log(`run ${r.id}  ${r.kind}  ${r.plan}  ${r.title}${phaseSuffix(r.phase, board.phaseProgress(r.id))}  ${r.repo}`);
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
if (args.verb === "stats" && args.has("--help")) {
  console.log(STATS_USAGE);
  process.exit(0);
}
if (args.verb === "--help") {
  // the core verbs; `--help code` the claim and merge verbs (D22)
  console.log(args.positional[0] === "code" ? CODE_USAGE : USAGE);
  process.exit(0);
}
if (args.verb === "serve") {
  // swarm has no page and no server: aiview reads the board (companions-merge D4)
  console.error(`swarm: unknown verb serve: swarm has no page; the board is read in aiview\n${USAGE}`);
  process.exit(2);
} else {
  const board = await openBoard();
  try {
    boardUpkeep(board);
    await main(board);
  } catch (e) {
    console.error(e instanceof CliError ? e.message : `swarm: ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    board.close();
  }
}

// CLI dispatch — the agent-facing surface of the board. Human output is short lines an
// agent reads; --json prints the same data as one object; errors go to stderr, exit 1.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openBoard, type Board, type Declared, type Delivery, type Flag, type Kind, type Message, type Participant, type RosterEntry, type SliceSpec, type SliceState } from "../board/board.ts";
import { profileOf } from "../board/kinds.ts";
import { EVENTS, eventOf, formatSubscriptions, parseSubscriptions, type Subscription } from "../board/events.ts";
import { DATA_ROOT, SQLITE_PATH } from "../board/home.ts";
import { portFrom, PORT_FILE, readServerStatus } from "../server/state.ts";
import { parseArgs } from "./args.ts";
import { fullText, seqLine } from "./format.ts";
import { nameHandle, unmatchedMentions } from "../board/mentions.ts";
import { boardUrlFor, registerBoardDocument } from "./aiview-document.ts";
import { unclaimedLines } from "./unclaimed.ts";

const args = parseArgs(process.argv.slice(2));
const asJson = args.has("--json");

const USAGE = [
  "usage: swarm <verb> [--json]        (swarm --help code: the claim and merge verbs)",
  "  open    --kind plan|brainstorm --group <slug> --title <t> --seats <file.json> [--link <url>]   # opens a run, registers the project's board in aiview, prints the run id then the board's URL (orchestrator)",
  "          # --plan <slug> --slices <file.json>: the same as --kind plan --group <slug> --seats <file.json>",
  '          # the seats file: [{"id", "title", "role"?, "blockers": [...], "link"?: "<URL>", "on"?: ["agreement", …]}]',
  "  slice   <id> --run <id> --state ready|running|done|blocked      # (orchestrator)",
  "  slice   add <id> --run <id> --title <t> [--blockers a,b] [--link <url>] [--role <r>] [--on <events>]   # adds a slice or seat mid-run (orchestrator)",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --seat <id> --doing <t> [--files "<path>:interface,<path>:inside,…"]   # --slice <id> the same; prints the roster, then the command that starts your listener',
  "          # --on <events>: what wakes your wait --mentions besides mentions and urgent posts, e.g. agreement,main:merged; else the seat row's on, else the kind's defaults",
  "  subscribe   [--as <member>] <events>                            # prints your subscriptions after",
  "  unsubscribe [--as <member>] <events>",
  "  doing   [--as <member>] <text>",
  "  post    [--as <member>] <body> [--about <path|decision id>] [--main]   # prints the seq, (main) when it landed in main",
  "  agree   [--as <member>] <terms> [--about <path|decision id>] [--main]  # prints the seq",
  "  endorse [--as <member>] <seq>                                   # backs an agreement; prints the endorsement's seq",
  "  read    <seq>",
  "  deliver [--as <member>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <member>] [--timeout <ms>] [--mentions]           # blocks until a message for you, then says how to re-arm; nothing on timeout or end; a newer wait supersedes it",
  "          # --mentions: only a mention of you, an urgent post or an event you subscribed to ends it; the rest stays for deliver",
  "  roster  [--repo <path>]",
  "  end     [--as <member>]                                         # claims or flags what you wrote unclaimed, then releases your claims and the lock",
  "  serve   [--port <p>] [--detach]                 # the run pages aiview frames, on :4322 (SWARM_PORT)",
  "  status                                                          # data home, the page's server, open runs",
  "  config  retention [<days>]                                      # prints, or sets then prints, how many days closed runs and main's talk are kept",
  `events: ${Object.keys(EVENTS).join(", ")}; main:<event> for one posted in main`,
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

const git = (cwd: string, ...argv: string[]): string | null => {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

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

/** Starts the page's server detached and waits for its port file (aiview's shape, copied).
 *  The port it listens on, or null when it did not come up. */
function spawnDetachedServer(port: number): number | null {
  try {
    fs.rmSync(PORT_FILE, { force: true });
  } catch {}
  // re-invoke the current entry: swarm.mjs in real use, the TS source under test
  const child = spawn(process.execPath, [process.argv[1], "serve", "--port", String(port)], {
    detached: true,
    stdio: "ignore",
    cwd: DATA_ROOT,
  });
  child.unref();
  const t0 = Date.now();
  for (;;) {
    const st = readServerStatus();
    if (st.running && st.port !== null) return st.port;
    if (Date.now() - t0 > 10_000) return null;
    // a synchronous CLI: a short blocking poll
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},120)"]);
  }
}

/** The running page server's port, starting one when none runs; null when it would not start. */
function ensureServer(): number | null {
  const st = readServerStatus();
  if (st.running && st.port !== null) return st.port;
  fs.mkdirSync(DATA_ROOT, { recursive: true });
  return spawnDetachedServer(portFrom(args.flag("--port")));
}

const pageUrl = (port: number): string => `http://localhost:${port}/`;
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

/** The line that starts a runner's listener: the exact command, --as included (D61). */
const listenNow = (runner: string): string =>
  `start your listener now, in the background (your harness's background task): ${[...self(), "wait", "--mentions", "--as", shellWord(runner)].join(" ")}`;

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

const emitHeard = (p: Participant, json: object, human: string | (() => void)): void => {
  const next = !p.ended && !p.listening ? listenNow(p.name) : null;
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
  return list.map((s: { id?: unknown; title?: unknown; role?: unknown; blockers?: unknown; link?: unknown; on?: unknown }) => {
    if (typeof s.id !== "string") fail(`${file}: a slice without an id`);
    return {
      id: String(s.id),
      title: String(s.title ?? s.id),
      ...(typeof s.role === "string" && s.role ? { role: s.role } : {}),
      blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [],
      link: typeof s.link === "string" && s.link ? s.link : null,
      ...(Array.isArray(s.on) ? { on: s.on.map(String) } : {}),
    };
  });
}

/** The board's upkeep (D19, D45): prune past the retention, then flag stale runs. A failure is
 *  told on stderr and never stops the verb it runs before. */
function boardUpkeep(board: Board): void {
  try {
    board.prune();
    board.flagStale();
  } catch (e) {
    console.error(`swarm: upkeep failed: ${(e as Error).message}`);
  }
}
const UPKEEP_EVERY_MS = 60 * 60 * 1000;
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

async function main(board: Board): Promise<void> {
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
      boardUpkeep(board);
      const { kind, group } = openKindAndGroup();
      const plan = group;
      const seatsFile = args.flag("--seats") ?? args.flag("--slices") ?? fail(`open: --seats <file.json> is required (or --slices)\n${USAGE}`);
      const run = board.openRun({ repo: repoOf(process.cwd()), kind, group, title: need("--title"), link: args.flag("--link") ?? null, seats: readSlices(seatsFile) });
      // the person watches the run on the page: start it when none runs (US1, US6)
      const port = ensureServer();
      const page = port === null ? null : pageUrl(port);
      if (page === null) {
        console.error(`swarm: the page did not start (port ${portFrom(args.flag("--port"))} may be in use; swarm serve --detach --port <n>). The run is open.`);
        emit({ run: run.id, repo: run.repo, kind: run.kind, group: run.group, plan: run.plan, url: null }, String(run.id));
        break;
      }
      // the person watches the project's board in aiview, pinned first (plan D17, D30, D39)
      const doc = registerBoardDocument({ toolRoot: toolRoot(), cwd: process.cwd(), repo: run.repo, pageUrl: page });
      if (!doc.registered) console.error(`swarm: ${doc.reason}: open the URL`);
      const url = doc.registered ? doc.url : boardUrlFor(page, [run.repo]);
      emit({ run: run.id, repo: run.repo, kind: run.kind, group: run.group, plan: run.plan, url }, `${run.id}\n${url}`);
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
      const state = need("--state") as SliceState;
      board.setSliceState(run, id, state);
      emit({ run, slice: id, state }, `${id} ${state}`);
      break;
    }
    case "close": {
      const run = runArg();
      board.closeRun(run);
      emit({ run, state: "closed" }, `run ${run} closed`);
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
      // the runner's next step, last: its listener, started at once (D61)
      const next = listenNow(runner.name);
      // a kind without worktree: the checkout is shared, so every call names the member (D21, D36)
      const shared = !profileOf(runner.kind).worktree;
      const as = shared ? `pass --as ${runner.name} on every call: this checkout is shared, the board cannot tell you apart` : null;
      const commands = shared ? seatCommands(runner.name) : null;
      // a seat posts what it compares as a table, what flows as mermaid: low-effort seats do what the board prints (D2)
      const drawing = profileOf(runner.kind).member === "seat" ? SEAT_POSTS_DRAW : null;
      emit({ runner: runner.name, nick: runner.nick, roster, ...(shared ? { as: runner.name, commands } : {}), ...(drawing ? { drawing } : {}), next }, () => {
        console.log(`you are ${runner.name}, ${runner.nick}: @${runner.slice} or @${runner.nick.replace(/\s+/g, "")} mentions you`);
        for (const r of roster) console.log(rosterLine(r));
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
      emitHeard(p, { runner: p.name, subscriptions: after }, `${p.name} wakes on: ${formatSubscriptions(after) || "mentions and urgent posts only"}`);
      break;
    }
    case "doing": {
      const p = caller(board);
      const text = args.positional.join(" ") || fail("doing: what?");
      board.setDoing(p, text);
      emitHeard(p, { runner: p.name, doing: text }, `${p.name} doing: ${text}`);
      break;
    }
    case "post":
    case "agree": {
      const p = caller(board);
      const body = args.positional.join(" ") || fail(`${args.verb}: nothing to say`);
      const m = board.post(p, body, {
        about: aboutArg(),
        kind: args.verb === "agree" ? "agreement" : "msg",
      });
      const unmatched = unmatchedLines(board, p, body);
      emitHeard(p, { seq: m.seq, mentions: m.mentions, run: m.run, ...(unmatched.length ? { unmatched } : {}), ...(m.claimed ? { claimed: m.claimed } : {}) }, () => {
        console.log(seqLine(m));
        // posting is claiming (D7)
        if (m.claimed) console.log(`claimed ${m.claimed.path}, shared with ${m.claimed.sharedWith.join(", ")}`);
        for (const line of unmatched) console.log(line);
      });
      break;
    }
    case "endorse": {
      const p = caller(board);
      const raw = (args.positional[0] ?? fail("endorse: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`endorse takes a seq, got ${raw}`);
      const m = board.endorse(p, seq);
      emitHeard(p, { seq: m.seq, endorses: m.endorses, run: m.run }, seqLine(m));
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
      const m = board.read(seq, by);
      emit(m, fullText(m));
      break;
    }
    case "deliver": {
      const me = caller(board);
      const d = withNext(me, board.deliver(me));
      emit(d, () => printDelivery(d));
      break;
    }
    case "wait": {
      const p = caller(board);
      const raw = args.flag("--timeout");
      const timeout = raw === undefined ? undefined : Number(raw);
      if (timeout !== undefined && !(timeout >= 0)) fail(`--timeout takes milliseconds, got ${raw}`);
      const mentionsOnly = args.has("--mentions");
      const d = withNext(p, await board.wait(p, { timeoutMs: timeout, mentionsOnly }));
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
      const next = `answer on the thread if needed, then start this listener again, in the background while you work, in the foreground when you are waiting: ${again.join(" ")}`;
      emit({ next, ...d }, () => {
        console.log(next);
        printDelivery(d);
      });
      break;
    }
    case "roster": {
      const repo = repoOf(path.resolve(args.flag("--repo") ?? process.cwd()));
      const roster = board.roster(repo);
      emit({ repo, roster }, () => {
        for (const r of roster) console.log(rosterLine(r));
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
      emitHeard(p, verdict, () => {
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
      const r = board.lockMerge(p, onto);
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
      const sharers = board.merged(p, sha, files.map((f) => path.resolve(f)));
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
    case "status": {
      const runs = board.runs();
      const server = readServerStatus();
      // each member's worktree, null for a seat or an orchestrator (D64)
      const membersOf = (r: (typeof runs)[number]) => board.roster(r.repo).filter((m) => m.run === r.id).map((m) => ({ name: m.name, nick: m.nick, worktree: m.worktree }));
      const open = runs.map((r) => ({ run: r.id, kind: r.kind, group: r.plan, title: r.title, members: membersOf(r) }));
      emit({ home: DATA_ROOT, sqlite: SQLITE_PATH, server, runs: runs.length, open }, () => {
        console.log(`home    ${DATA_ROOT}`);
        console.log(`sqlite  ${SQLITE_PATH}`);
        console.log(
          server.running ? `page    running  pid ${server.pid}  ${pageUrl(server.port as number)}` : `page    not running${server.stale ? " (stale pid file)" : ""}: swarm serve --detach`,
        );
        if (!runs.length) console.log("no open run");
        for (const r of runs) {
          console.log(`run ${r.id}  ${r.kind}  ${r.plan}  ${r.title}  ${r.repo}`);
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
if (args.verb === "--help") {
  // the core verbs; `--help code` the claim and merge verbs (D22)
  console.log(args.positional[0] === "code" ? CODE_USAGE : USAGE);
  process.exit(0);
}
if (args.verb === "serve" && args.has("--detach")) {
  const st = readServerStatus();
  const port = st.running && st.port !== null ? st.port : (fs.mkdirSync(DATA_ROOT, { recursive: true }), spawnDetachedServer(portFrom(args.flag("--port"))));
  if (port === null) {
    console.error(`swarm: the server did not come up within 10 s (port ${portFrom(args.flag("--port"))} may be in use; retry with --port <n>)`);
    process.exitCode = 1;
  } else {
    const server = readServerStatus();
    emit({ server, url: pageUrl(port), already: st.running }, st.running ? `swarm's page already running on ${pageUrl(port)} (pid ${server.pid})` : `swarm's page up on ${pageUrl(port)}`);
  }
} else if (args.verb === "serve") {
  // the server holds its Board for its whole life
  const { startServer } = await import("../server/index.ts");
  const board = await openBoard();
  boardUpkeep(board);
  // hourly while the server runs (D45); never what keeps the process alive
  setInterval(() => boardUpkeep(board), UPKEEP_EVERY_MS).unref();
  startServer(board, { port: portFrom(args.flag("--port")) });
} else {
  const board = await openBoard();
  try {
    await main(board);
  } catch (e) {
    console.error(e instanceof CliError ? e.message : `swarm: ${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    board.close();
  }
}

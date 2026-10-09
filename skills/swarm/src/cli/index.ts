// CLI dispatch — the agent-facing surface of the board. Human output is short lines an
// agent reads; --json prints the same data as one object; errors go to stderr, exit 1.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openBoard, type Board, type Declared, type Delivery, type Flag, type Participant, type RosterEntry, type SliceSpec, type SliceState } from "../board/board.ts";
import { DATA_ROOT, SQLITE_PATH } from "../board/home.ts";
import { portFrom, PORT_FILE, readServerStatus } from "../server/state.ts";
import { parseArgs } from "./args.ts";
import { fullText } from "./format.ts";
import { registerRunDocument } from "./aiview-document.ts";

const args = parseArgs(process.argv.slice(2));
const asJson = args.has("--json");

const USAGE = [
  "usage: swarm <verb> [--json]",
  "  open    --plan <slug> --title <t> --slices <file.json> [--link <url>]   # opens a run, registers it in aiview in the plan's group, prints its id then the aiview URL (orchestrator)",
  '          # the slices file: [{"id", "title", "blockers": [...], "link"?: "<slice document URL>"}]',
  "  slice   <id> --run <id> --state ready|running|done|blocked      # (orchestrator)",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --slice <id> --doing <t> [--files "<path>:interface,<path>:inside,…"]   # prints the roster, then the command that starts your listener',
  "  doing   [--as <runner>] <text>",
  "  post    [--as <runner>] <body> [--about <path>]                 # prints the seq",
  "  agree   [--as <runner>] <terms> [--about <path>]                # prints the seq",
  "  read    <seq>",
  "  deliver [--as <runner>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <runner>] [--timeout <ms>] [--mentions]           # blocks until a message for you, then says how to re-arm; nothing on timeout or end; a newer wait supersedes it",
  "          # --mentions: only a mention of you or an urgent post ends it; the rest stays for deliver",
  "  roster  [--repo <path>]",
  "  claim   [--as <runner>] <path> [--interface]                    # before editing a file: exit 0 claimed, 3 held until you post about it",
  "  release [--as <runner>] <path>                                  # gives up a claim",
  "  merge-lock --onto <branch> [--as <runner>]                      # one merge at a time per repository; claims or flags what your branch wrote unclaimed",
  "  merged  [--as <runner>] <sha> --files <path>...                 # releases the lock, tells who must rebase and who was refused the lock, names whom to tell of a resolved conflict",
  "  end     [--as <runner>]                                         # claims or flags what you wrote unclaimed, then releases your claims and the lock",
  "  serve   [--port <p>] [--detach]                 # the run pages aiview frames, on :4322 (SWARM_PORT)",
  "  status                                                          # data home, the page's server, open runs",
  "a runner is <plan>/<slice>, the orchestrator <plan>/orchestrator; without --as, the runner joined from this worktree",
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
  for (const file of reconciled) console.log(`reconciled ${file}`);
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
/** One run's page, the one aiview frames. */
const runPageUrl = (port: number, run: number): string => `${pageUrl(port)}?run=${run}`;
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
  return `${who}${r.stale ? " (stale)" : ""}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}`;
};

const printDelivery = (d: Delivery): void => {
  for (const m of d.full) console.log(fullText(m));
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
const emitHeard = (p: Participant, json: object, human: string | (() => void)): void => {
  const next = !p.ended && !p.listening ? listenNow(p.name) : null;
  emit(next ? { ...json, next } : json, () => {
    if (typeof human === "string") console.log(human);
    else human();
    if (next) console.log(next);
  });
};

/** `<path>`, `<path>:inside` or `<path>:interface`. */
function parseFile(spec: string): Declared {
  const m = spec.match(/^(.*):(interface|inside)$/);
  return m ? { path: m[1], interface: m[2] === "interface" } : { path: spec, interface: false };
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
  return list.map((s: { id?: unknown; title?: unknown; blockers?: unknown; link?: unknown }) => {
    if (typeof s.id !== "string") fail(`${file}: a slice without an id`);
    return {
      id: String(s.id),
      title: String(s.title ?? s.id),
      blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [],
      link: typeof s.link === "string" && s.link ? s.link : null,
    };
  });
}

async function main(board: Board): Promise<void> {
  switch (args.verb) {
    case "open": {
      const plan = need("--plan");
      const run = board.openRun({ repo: repoOf(process.cwd()), plan, title: need("--title"), link: args.flag("--link") ?? null, slices: readSlices(need("--slices")) });
      // the person watches the run on the page: start it when none runs (US1, US6)
      const port = ensureServer();
      const page = port === null ? null : runPageUrl(port, run.id);
      if (page === null) {
        console.error(`swarm: the page did not start (port ${portFrom(args.flag("--port"))} may be in use; swarm serve --detach --port <n>). The run is open.`);
        emit({ run: run.id, repo: run.repo, plan: run.plan, url: null }, String(run.id));
        break;
      }
      // the person watches the run in aiview, in the plan's group (plan D2, D3)
      const doc = registerRunDocument({ toolRoot: toolRoot(), plan, run: run.id, pageUrl: page, date: new Date().toISOString().slice(0, 10) });
      if (!doc.registered) console.error(`swarm: ${doc.reason}: open the URL`);
      const url = doc.registered ? doc.url : page;
      emit({ run: run.id, repo: run.repo, plan: run.plan, url }, `${run.id}\n${url}`);
      break;
    }
    case "slice": {
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
        slice: need("--slice"),
        doing: need("--doing"),
        files: [...args.list("--files"), ...args.flags("--file")].map(parseFile),
        worktree: worktreeOf(process.cwd()) ?? undefined,
      });
      // the runner's next step, last: its listener, started at once (D61)
      const next = listenNow(runner.name);
      emit({ runner: runner.name, nick: runner.nick, roster, next }, () => {
        console.log(`you are ${runner.name}, ${runner.nick}: @${runner.slice} or @${runner.nick.replace(/\s+/g, "")} mentions you`);
        for (const r of roster) console.log(rosterLine(r));
        console.log(next);
      });
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
      const m = board.post(p, body, { about: args.flag("--about"), kind: args.verb === "agree" ? "agreement" : "msg" });
      emitHeard(p, { seq: m.seq, mentions: m.mentions }, `#${m.seq}`);
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
      const d = board.deliver(caller(board));
      emit(d, () => printDelivery(d));
      break;
    }
    case "wait": {
      const p = caller(board);
      const raw = args.flag("--timeout");
      const timeout = raw === undefined ? undefined : Number(raw);
      if (timeout !== undefined && !(timeout >= 0)) fail(`--timeout takes milliseconds, got ${raw}`);
      const mentionsOnly = args.has("--mentions");
      const d = await board.wait(p, { timeoutMs: timeout, mentionsOnly });
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
      const verdict = board.checkEdit(p, path.resolve(file), { interface: args.has("--interface") });
      // held (D41): exit 3, the runner posts about the path and claims again
      if (!verdict.allowed) process.exitCode = 3;
      emitHeard(p, verdict, () => {
        if (!verdict.allowed) return console.log(verdict.refusal);
        // the other holders are named once per runner and path, when the board says so (D40)
        const also = verdict.notice
          ? verdict.sharedWith.map((o) => `${o.runner} · ${board.participant(o.runner)?.nick ?? "?"}: ${o.doing}`).join("; ")
          : "";
        console.log(also ? `claimed ${file}, also held by ${also}` : `claimed ${file}`);
      });
      break;
    }
    case "release": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("release: which path?");
      board.release(p, path.resolve(file));
      emit({ runner: p.name, released: file }, `${p.name} released ${file}`);
      break;
    }
    case "merge-lock": {
      const p = caller(board);
      // the branch merged into: a worktree does not say which branch it left, so the runner names it (D59)
      const onto = need("--onto");
      // what the branch wrote without a claim, committed or not, before the lock; a flag informs, never blocks
      const reconciled = p.worktree ? branchChangedIn(p.worktree, onto) : [];
      const flags = reconciled.length ? board.reconcileWrites(p, reconciled) : [];
      const r = board.lockMerge(p);
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
      emit({ home: DATA_ROOT, sqlite: SQLITE_PATH, server, runs: runs.length }, () => {
        console.log(`home    ${DATA_ROOT}`);
        console.log(`sqlite  ${SQLITE_PATH}`);
        console.log(
          server.running ? `page    running  pid ${server.pid}  ${pageUrl(server.port as number)}` : `page    not running${server.stale ? " (stale pid file)" : ""}: swarm serve --detach`,
        );
        if (!runs.length) console.log("no open run");
        for (const r of runs) {
          console.log(`run ${r.id}  ${r.plan}  ${r.title}  ${r.repo}`);
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
  startServer(await openBoard(), { port: portFrom(args.flag("--port")) });
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

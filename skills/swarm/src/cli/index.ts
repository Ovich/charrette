// CLI dispatch — the agent-facing surface of the board. Human output is short lines an
// agent reads; --json prints the same data as one object; errors go to stderr, exit 1.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openBoard, type Board, type Declared, type Delivery, type Participant, type RosterEntry, type SliceSpec, type SliceState } from "../board/board.ts";
import { DATA_ROOT, SQLITE_PATH } from "../board/home.ts";
import { runHook } from "../hook/hook.ts";
import { portFrom, PORT_FILE, readServerStatus } from "../server/state.ts";
import { parseArgs } from "./args.ts";
import { fullText } from "./format.ts";

const args = parseArgs(process.argv.slice(2));
const asJson = args.has("--json");

const USAGE = [
  "usage: swarm <verb> [--json]",
  "  open    --plan <slug> --title <t> --slices <file.json>          # opens a run, prints its id then the page's URL (orchestrator)",
  "  slice   <id> --run <id> --state ready|running|done|blocked      # (orchestrator)",
  "  close   --run <id>                                              # (orchestrator)",
  '  join    --run <id> --slice <id> --doing <t> [--files "<path>:interface,<path>:inside,…"]   # prints the roster',
  "  doing   [--as <runner>] <text>",
  "  post    [--as <runner>] <body> [--about <path>]                 # prints the seq",
  "  agree   [--as <runner>] <terms> [--about <path>]                # prints the seq",
  "  read    <seq>",
  "  deliver [--as <runner>]                                         # what you have not had: mentions in full, the rest one line",
  "  wait    [--as <runner>] [--timeout <ms>]                        # blocks until a message for you; nothing on timeout",
  "  roster  [--repo <path>]",
  "  release [--as <runner>] <path>                                  # gives up a claim",
  "  merge-lock [--as <runner>]                                      # one merge at a time per repository",
  "  merged  [--as <runner>] <sha> --files <path>...                 # releases the lock, tells who must rebase",
  "  end     [--as <runner>]                                         # releases your claims and the lock",
  "  hook    pre|post                                                # Claude Code's hooks: hook JSON on stdin",
  "  serve   [--port <p>] [--open] [--detach]                        # the page, on :4322 (SWARM_PORT)",
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
  return `${r.name}${r.stale ? " (stale)" : ""}  run ${r.run}  doing: ${r.doing || "-"}${files ? `  files: ${files}` : ""}`;
};

const printDelivery = (d: Delivery): void => {
  for (const m of d.full) console.log(fullText(m));
  for (const l of d.lines) console.log(l);
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
  return list.map((s: { id?: unknown; title?: unknown; blockers?: unknown }) => {
    if (typeof s.id !== "string") fail(`${file}: a slice without an id`);
    return { id: String(s.id), title: String(s.title ?? s.id), blockers: Array.isArray(s.blockers) ? s.blockers.map(String) : [] };
  });
}

async function main(board: Board): Promise<void> {
  switch (args.verb) {
    case "open": {
      const plan = need("--plan");
      const run = board.openRun({ repo: repoOf(process.cwd()), plan, title: need("--title"), slices: readSlices(need("--slices")) });
      // the person watches the run on the page: start it when none runs (US1, US6)
      const port = ensureServer();
      const url = port === null ? null : pageUrl(port);
      if (url === null) console.error(`swarm: the page did not start (port ${portFrom(args.flag("--port"))} may be in use; swarm serve --detach --port <n>). The run is open.`);
      emit({ run: run.id, repo: run.repo, plan: run.plan, url }, url ? `${run.id}\n${url}` : String(run.id));
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
      emit({ runner: runner.name, roster }, () => {
        console.log(`you are ${runner.name}`);
        for (const r of roster) console.log(rosterLine(r));
      });
      break;
    }
    case "doing": {
      const p = caller(board);
      const text = args.positional.join(" ") || fail("doing: what?");
      board.setDoing(p, text);
      emit({ runner: p.name, doing: text }, `${p.name} doing: ${text}`);
      break;
    }
    case "post":
    case "agree": {
      const p = caller(board);
      const body = args.positional.join(" ") || fail(`${args.verb}: nothing to say`);
      const m = board.post(p, body, { about: args.flag("--about"), kind: args.verb === "agree" ? "agreement" : "msg" });
      emit({ seq: m.seq, mentions: m.mentions }, `#${m.seq}`);
      break;
    }
    case "read": {
      const raw = (args.positional[0] ?? fail("read: which seq?")).replace(/^#/, "");
      const seq = Number(raw);
      if (!Number.isInteger(seq)) fail(`read takes a seq, got ${raw}`);
      const m = board.read(seq);
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
      const d = await board.wait(p, timeout);
      emit(d, () => printDelivery(d));
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
    case "release": {
      const p = caller(board);
      const file = args.positional[0] ?? fail("release: which path?");
      board.release(p, path.resolve(file));
      emit({ runner: p.name, released: file }, `${p.name} released ${file}`);
      break;
    }
    case "merge-lock": {
      const p = caller(board);
      const r = board.lockMerge(p);
      emit(
        { runner: p.name, ...r },
        r.granted ? "granted: merge, then swarm merged <sha> --files <path>..." : `held by ${r.holder}: swarm wait for its merged event`,
      );
      break;
    }
    case "merged": {
      const p = caller(board);
      const sha = args.positional[0] ?? fail("merged: which sha?");
      const files = args.list("--files");
      board.merged(p, sha, files.map((f) => path.resolve(f)));
      emit({ runner: p.name, sha, files }, `merged ${sha}: lock released`);
      break;
    }
    case "end": {
      const p = caller(board);
      board.end(p);
      emit({ runner: p.name, ended: true }, `${p.name} ended`);
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
if (args.verb === "hook") {
  // before the store opens: the hook decides whether it needs it at all
  await runHook(args.positional[0]);
} else if (args.verb === "serve" && args.has("--detach")) {
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
  startServer(await openBoard(), { port: portFrom(args.flag("--port")), open: args.has("--open") });
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

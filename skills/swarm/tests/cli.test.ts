import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openBoard } from "../src/board/board.ts";
import { freePort, stopServer } from "./support/page-server.ts";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli", "index.ts");

let toolRoot: string;
let repo: string;
let port: number;

// SWARM_ROOT = where the code would be; CHARRETTE_HOME = where the data goes.
// The suite points both at one temp dir so a run leaves nothing in the real home.
// SWARM_PORT: `open` starts the page's server; each test on a port of its own.
const env = () => ({ ...process.env, SWARM_ROOT: toolRoot, CHARRETTE_HOME: toolRoot, SWARM_PORT: String(port) });

const runIn = (cwd: string, ...argv: string[]) => spawnSync(process.execPath, [CLI, ...argv], { cwd, encoding: "utf8", env: env() });
const run = (...argv: string[]) => runIn(repo, ...argv);

const git = (cwd: string, ...argv: string[]): void => {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};

const SLICES = JSON.stringify([
  { id: "S3", title: "the page", blockers: [] },
  { id: "S5", title: "the skill", blockers: ["S3"] },
]);

const openRun = (plan = "review-tool", cwd = repo): number => {
  const slices = path.join(toolRoot, `${plan}.slices.json`);
  fs.writeFileSync(slices, SLICES);
  const r = runIn(cwd, "open", "--plan", plan, "--title", "A plan", "--slices", slices);
  assert.equal(r.status, 0, r.stderr);
  return Number(r.stdout.split("\n")[0].trim()); // the run id, then the page's URL
};

beforeEach(async () => {
  port = await freePort();
  toolRoot = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-cli-"));
  repo = path.join(toolRoot, "repo");
  fs.mkdirSync(repo);
  git(repo, "init", "-q");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "root");
});

afterEach(() => {
  stopServer(toolRoot);
  // Windows may briefly hold handles of a just-ended child; a leaked temp dir
  // must not fail the suite.
  for (let i = 0; ; i++) {
    try {
      fs.rmSync(toolRoot, { recursive: true, force: true });
      return;
    } catch {
      if (i >= 5) {
        console.warn(`cleanup: temp dir left behind: ${toolRoot}`);
        return;
      }
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},200)"]);
    }
  }
});

test("no verb prints usage and exits 1", () => {
  const r = run();
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^usage: swarm <verb>/);
});

test("open then join prints the roster", () => {
  const id = openRun();
  assert.ok(id > 0);
  const r = run("join", "--run", String(id), "--slice", "S3", "--doing", "the page", "--file", "src/page.ts:interface", "--file", "src/a.ts");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /you are review-tool\/S3/);
  assert.match(r.stdout, /review-tool\/S3 {2}run \d+ {2}doing: the page {2}files: src\/page\.ts \(interface\), src\/a\.ts/);
  assert.match(r.stdout, /review-tool\/orchestrator/);
});

/** A stand-in for aiview's CLI: `path` answers a file in `<toolRoot>/docs`, `open` logs its argv. */
const fakeAiview = (): { launcher: string; log: string } => {
  const launcher = path.join(toolRoot, "fake-aiview.mjs");
  const log = path.join(toolRoot, "aiview.log");
  fs.writeFileSync(
    launcher,
    `import fs from "node:fs"; import path from "node:path";
const [verb, arg] = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + "\\n");
if (verb === "path") { const dir = path.join(${JSON.stringify(toolRoot)}, "docs"); fs.mkdirSync(dir, { recursive: true }); console.log(JSON.stringify({ path: path.join(dir, arg), dir, project: "p" })); }
else if (verb === "open") console.log(JSON.stringify({ id: 7, url: "http://localhost:4321/#doc=7" }));
else process.exit(1);
`,
  );
  return { launcher, log };
};

const openWith = (aiview: string) => {
  const slices = path.join(toolRoot, "s.json");
  fs.writeFileSync(slices, SLICES);
  return spawnSync(process.execPath, [CLI, "open", "--plan", "review-tool", "--title", "A plan", "--slices", slices], {
    cwd: repo,
    encoding: "utf8",
    env: { ...env(), SWARM_AIVIEW: aiview },
  });
};

test("open writes the run's swarm document and registers it in the plan's group in aiview", () => {
  const { launcher, log } = fakeAiview();
  const r = openWith(launcher);
  assert.equal(r.status, 0, r.stderr);
  const [id, url] = r.stdout.trim().split("\n");
  assert.equal(url, "http://localhost:4321/#doc=7");
  const calls = fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
  const name = calls[0][1];
  assert.match(name, new RegExp(`^\\d{4}-\\d{2}-\\d{2}-review-tool-run-${id}\\.swarm\\.json$`));
  const file = path.join(toolRoot, "docs", name);
  assert.deepEqual(calls[1], ["open", file, "--group", "review-tool-plan", "--json"]);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { run: Number(id), url: `http://localhost:${port}/?run=${id}` });
});

test("open without aiview prints the run's page and says to open it", () => {
  const r = openWith(path.join(toolRoot, "none.mjs"));
  assert.equal(r.status, 0, r.stderr);
  const [id, url] = r.stdout.trim().split("\n");
  assert.equal(url, `http://localhost:${port}/?run=${id}`);
  assert.match(r.stderr, /aiview not found: open the URL/);
});

test("the roster shows a runner's funny name beside it; open keeps the links (D43, D44)", async () => {
  const slices = path.join(toolRoot, "linked.json");
  fs.writeFileSync(slices, JSON.stringify([{ id: "S3", title: "the page", blockers: [], link: "http://localhost:4321/d/7" }]));
  const opened = run("open", "--plan", "review-tool", "--title", "A plan", "--slices", slices, "--link", "http://localhost:4321/d/6", "--json");
  assert.equal(opened.status, 0, opened.stderr);
  const id = String(JSON.parse(opened.stdout).run);
  const joined = JSON.parse(run("join", "--run", id, "--slice", "S3", "--doing", "the page", "--json").stdout);
  assert.match(joined.nick, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
  const roster = run("roster").stdout;
  assert.ok(roster.includes(`${joined.nick} · review-tool/S3  run ${id}`), roster);
  assert.match(roster, /^review-tool\/orchestrator {2}run/m);
  const board = await openBoard(path.join(toolRoot, "swarm.sqlite"));
  try {
    const r = board.runs()[0];
    assert.deepEqual([r.link, r.slices[0].link], ["http://localhost:4321/d/6", "http://localhost:4321/d/7"]);
  } finally {
    board.close();
  }
});

test("--json on every verb parses", () => {
  const slices = path.join(toolRoot, "s.json");
  fs.writeFileSync(slices, SLICES);
  const opened = JSON.parse(run("open", "--plan", "review-tool", "--title", "T", "--slices", slices, "--json").stdout);
  assert.deepEqual(Object.keys(opened).sort(), ["plan", "repo", "run", "url"]);
  const id = String(opened.run);
  const as = ["--as", "review-tool/S3"];
  const verbs: string[][] = [
    ["join", "--run", id, "--slice", "S3", "--doing", "x"],
    ["join", "--run", id, "--slice", "S5", "--doing", "y"],
    ["doing", ...as, "still x"],
    ["post", ...as, "@S5 hello"],
    ["agree", ...as, "@S5 I go first", "--about", "src/a.ts"],
    ["claim", ...as, "src/b.ts"],
    ["read", "1"],
    ["deliver", "--as", "review-tool/S5"],
    ["wait", "--as", "review-tool/S5", "--timeout", "50"],
    ["roster"],
    ["slice", "S3", "--run", id, "--state", "running"],
    ["status"],
    ["end", ...as],
    ["close", "--run", id],
  ];
  for (const argv of verbs) {
    const r = run(...argv, "--json");
    assert.equal(r.status, 0, `${argv[0]}: ${r.stderr}`);
    assert.doesNotThrow(() => JSON.parse(r.stdout), `${argv[0]} printed ${r.stdout}`);
  }
});

test("an unknown run or runner is one line naming it, exit 1", () => {
  const r1 = run("join", "--run", "7", "--slice", "S3", "--doing", "x");
  assert.equal(r1.status, 1);
  assert.match(r1.stderr, /unknown run 7/);
  const r2 = run("post", "--as", "nope/S1", "hi");
  assert.equal(r2.status, 1);
  assert.match(r2.stderr, /unknown runner nope\/S1/);
});

test("wait in a child process wakes on a post from another", async () => {
  const id = String(openRun());
  run("join", "--run", id, "--slice", "S3", "--doing", "x");
  run("join", "--run", id, "--slice", "S5", "--doing", "y");
  run("deliver", "--as", "review-tool/S5");

  const child = spawn(process.execPath, [CLI, "wait", "--as", "review-tool/S5", "--timeout", "15000"], { cwd: repo, env: env() });
  let out = "";
  child.stdout.on("data", (b) => (out += b));
  const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
  await new Promise((r) => setTimeout(r, 1500)); // the child is up and watching
  const posted = run("post", "--as", "review-tool/S3", "@S5 your turn");
  assert.equal(posted.status, 0, posted.stderr);
  const t0 = Date.now();
  const code = await exited;
  assert.equal(code, 0);
  assert.match(out, /review-tool\/S3[^\n]*\n@S5 your turn/);
  assert.ok(Date.now() - t0 < 5000, "wait did not wake on the post");
});

test("wait prints, before the message, the line that re-arms it with the exact command, --as included", () => {
  const id = String(openRun());
  run("join", "--run", id, "--slice", "S3", "--doing", "x");
  run("join", "--run", id, "--slice", "S5", "--doing", "y");
  run("deliver", "--as", "review-tool/S5");
  run("post", "--as", "review-tool/S3", "@S5 your turn");
  const r = run("wait", "--as", "review-tool/S5", "--mentions", "--timeout", "5000");
  assert.equal(r.status, 0, r.stderr);
  const [hint, ...message] = r.stdout.trimEnd().split("\n");
  const script = CLI.replace(/\\/g, "/");
  assert.equal(
    hint,
    `answer on the thread if needed, then start this listener again, in the background while you work, in the foreground when you are waiting: node ${script} wait --mentions --as review-tool/S5 --timeout 5000`,
  );
  assert.match(message.join("\n"), /review-tool\/S3[^\n]*\n@S5 your turn/);
  // the command it names runs as written: nothing more for S5, so it times out, silent
  const again = run("wait", "--as", "review-tool/S5", "--mentions", "--timeout", "50");
  assert.equal(again.status, 0, again.stderr);
  assert.equal(again.stdout, "");
});

const LISTEN = (runner: string): string =>
  `start your listener now, in the background (your harness's background task): node ${CLI.replace(/\\/g, "/")} wait --mentions --as ${runner}`;

test("join ends on the line that starts the listener, the exact command with --as; --json carries it as next (D61)", () => {
  const id = String(openRun());
  const r = run("join", "--run", id, "--slice", "S5", "--doing", "y");
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trimEnd().split("\n");
  assert.equal(lines.at(-1), LISTEN("review-tool/S5"));
  assert.equal(lines.filter((l) => l.startsWith("start your listener")).length, 1);
  const json = JSON.parse(run("join", "--run", id, "--slice", "S3", "--doing", "x", "--json").stdout);
  assert.equal(json.next, LISTEN("review-tool/S3"));
});

test("merged ends, for each merged path another runner holds or held, on the line that tells them; --json carries the lines as tell (D63)", () => {
  const id = String(openRun());
  run("join", "--run", id, "--slice", "S3", "--doing", "x");
  run("join", "--run", id, "--slice", "S5", "--doing", "y");
  const s3 = ["--as", "review-tool/S3"];
  const s5 = ["--as", "review-tool/S5"];
  for (const f of ["src/held.ts", "src/holds.ts"]) assert.equal(run("claim", ...s3, f).status, 0);
  assert.equal(run("release", ...s3, "src/held.ts").status, 0);
  assert.equal(run("claim", ...s5, "src/mine.ts").status, 0);

  const TELL = (f: string): string =>
    `if you resolved a conflict in ${f}, tell them: swarm post "@review-tool/S3 I resolved ${f}: <how>" --about ${f}`;
  const r = run("merged", ...s5, "abc123", "--files", "src/held.ts", "src/holds.ts", "src/mine.ts", "src/nobody.ts");
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trimEnd().split("\n"), ["merged abc123: lock released", TELL("src/held.ts"), TELL("src/holds.ts")]);

  const j = JSON.parse(run("merged", ...s5, "def456", "--files", "src/held.ts", "--json").stdout);
  assert.deepEqual(j.tell, [TELL("src/held.ts")]);

  // a path nobody else held: the merge line alone
  assert.equal(run("merged", ...s5, "fed789", "--files", "src/mine.ts", "src/nobody.ts").stdout, "merged fed789: lock released\n");
});

test("claim, post and doing end on the listener line while no listener is pending, and not while one is (D61)", async () => {
  const id = String(openRun());
  run("join", "--run", id, "--slice", "S5", "--doing", "y");
  const as = ["--as", "review-tool/S5"];
  const unheard = [run("claim", ...as, "src/a.ts"), run("post", ...as, "hello"), run("doing", ...as, "the page")];
  for (const r of unheard) {
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trimEnd().split("\n");
    assert.equal(lines.at(-1), LISTEN("review-tool/S5"), r.stdout);
    assert.equal(lines.length, 2, r.stdout); // the verb's own line, then the listener line, once
  }
  assert.equal(JSON.parse(run("post", ...as, "again", "--json").stdout).next, LISTEN("review-tool/S5"));

  const child = spawn(process.execPath, [CLI, "wait", "--mentions", ...as, "--timeout", "15000"], { cwd: repo, env: env() });
  const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
  try {
    await new Promise((r) => setTimeout(r, 1500)); // the child is up and listening
    const claimed = run("claim", ...as, "src/b.ts");
    assert.equal(claimed.stdout, "claimed src/b.ts\n");
    const posted = run("post", ...as, "hello again");
    assert.match(posted.stdout, /^#\d+\n$/);
    assert.equal(JSON.parse(run("post", ...as, "once more", "--json").stdout).next, undefined);
  } finally {
    run("end", ...as); // releases the child's wait
    await exited;
  }
  // ended: no line
  assert.doesNotMatch(run("doing", ...as, "nothing").stdout, /start your listener/);
});

test("a mentions-only wait in a child process sleeps through a join and wakes on a mention", async () => {
  const id = String(openRun());
  run("join", "--run", id, "--slice", "S5", "--doing", "y");
  run("deliver", "--as", "review-tool/S5");
  const child = spawn(process.execPath, [CLI, "wait", "--mentions", "--as", "review-tool/S5", "--timeout", "15000"], { cwd: repo, env: env() });
  let out = "";
  child.stdout.on("data", (b) => (out += b));
  let exitedAt = 0;
  const exited = new Promise<number | null>((resolve) =>
    child.on("exit", (c) => {
      exitedAt = Date.now();
      resolve(c);
    }),
  );
  await new Promise((r) => setTimeout(r, 1500)); // the child is up and watching
  run("join", "--run", id, "--slice", "S3", "--doing", "x"); // a roster line: not a mention
  await new Promise((r) => setTimeout(r, 800));
  assert.equal(exitedAt, 0, `a join line woke the listener: ${out}`);
  run("post", "--as", "review-tool/S3", "@S5 your turn");
  assert.equal(await exited, 0);
  assert.match(out, /^answer on the thread if needed[^\n]*wait --mentions --as review-tool\/S5 --timeout 15000\n/);
  assert.match(out, /@S5 your turn/);
  assert.doesNotMatch(out, /joined/);
});

test("a foreground wait supersedes the background listener in another process; the listener prints so, the wait gets the mention", async () => {
  const id = String(openRun());
  run("join", "--run", id, "--slice", "S3", "--doing", "x");
  run("join", "--run", id, "--slice", "S5", "--doing", "y");
  run("deliver", "--as", "review-tool/S5");
  const start = (...argv: string[]) => {
    const child = spawn(process.execPath, [CLI, "wait", "--mentions", "--as", "review-tool/S5", "--timeout", "15000", ...argv], { cwd: repo, env: env() });
    let out = "";
    child.stdout.on("data", (b) => (out += b));
    const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
    return { exited, out: () => out };
  };
  const listener = start("--json");
  await new Promise((r) => setTimeout(r, 1500)); // the listener is up and watching
  const foreground = start();
  assert.equal(await listener.exited, 0);
  assert.deepEqual(JSON.parse(listener.out()), { full: [], lines: [], superseded: true });
  run("post", "--as", "review-tool/S3", "@S5 rebase onto abc");
  assert.equal(await foreground.exited, 0);
  assert.match(foreground.out(), /^answer on the thread if needed[^\n]*\n[^\n]*review-tool\/S3[^\n]*\n@S5 rebase onto abc/);
  // the human form, superseded by a short foreground wait
  const third = start();
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(run("wait", "--as", "review-tool/S5", "--timeout", "100").status, 0);
  assert.equal(await third.exited, 0);
  assert.equal(third.out(), "superseded by a newer wait\n");
});

test("end releases a runner's pending wait in another process", async () => {
  const id = String(openRun());
  run("join", "--run", id, "--slice", "S5", "--doing", "y");
  const child = spawn(process.execPath, [CLI, "wait", "--mentions", "--as", "review-tool/S5", "--timeout", "15000"], { cwd: repo, env: env() });
  let out = "";
  child.stdout.on("data", (b) => (out += b));
  const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
  await new Promise((r) => setTimeout(r, 1500));
  const ended = run("end", "--as", "review-tool/S5");
  assert.equal(ended.status, 0, ended.stderr);
  const t0 = Date.now();
  assert.equal(await exited, 0);
  assert.ok(Date.now() - t0 < 5000, "end did not release the wait");
  assert.equal(out, "");
});

test("two worktrees of one repository share one thread", () => {
  const a = path.join(toolRoot, "wt-a");
  const b = path.join(toolRoot, "wt-b");
  git(repo, "worktree", "add", "-q", "-b", "a", a);
  git(repo, "worktree", "add", "-q", "-b", "b", b);
  const id = String(openRun());

  const ja = runIn(a, "join", "--run", id, "--slice", "S3", "--doing", "x", "--json");
  const jb = runIn(b, "join", "--run", id, "--slice", "S5", "--doing", "y", "--json");
  assert.equal(ja.status, 0, ja.stderr);
  assert.deepEqual(JSON.parse(jb.stdout).roster.map((r: { name: string }) => r.name).sort(), [
    "review-tool/S3",
    "review-tool/S5",
    "review-tool/orchestrator",
  ]);
  runIn(a, "deliver");

  // no --as: each worktree's runner is the one that joined from it (D28)
  const posted = runIn(b, "post", "@S3 from the other worktree");
  assert.equal(posted.status, 0, posted.stderr);
  const got = runIn(a, "deliver", "--json");
  assert.equal(got.status, 0, got.stderr);
  const d = JSON.parse(got.stdout);
  assert.equal(d.full.length, 1);
  assert.equal(d.full[0].from, "review-tool/S5");

  const rosters = [repo, a, b].map((cwd) => JSON.parse(runIn(cwd, "roster", "--json").stdout));
  assert.equal(new Set(rosters.map((r) => r.repo)).size, 1);
});

test("two runs of two plans on one repository share one thread and one roster", () => {
  const one = String(openRun("review-tool"));
  const two = String(openRun("swarm"));
  run("join", "--run", one, "--slice", "S3", "--doing", "x");
  run("join", "--run", two, "--slice", "S5", "--doing", "y");
  const roster = JSON.parse(run("roster", "--json").stdout).roster.map((r: { name: string }) => r.name);
  assert.ok(roster.includes("review-tool/S3") && roster.includes("swarm/S5"));
  run("deliver", "--as", "review-tool/S3");
  run("post", "--as", "swarm/S5", "@review-tool/S3 one thread");
  const d = JSON.parse(run("deliver", "--as", "review-tool/S3", "--json").stdout);
  assert.equal(d.full[0].body, "@review-tool/S3 one thread");
});

test("the launcher prints the build command when dist-cli is absent", () => {
  const fake = path.join(toolRoot, "tool");
  fs.mkdirSync(fake);
  const launcher = path.resolve(path.dirname(CLI), "..", "..", "swarm.mjs");
  fs.copyFileSync(launcher, path.join(fake, "swarm.mjs"));
  const r = spawnSync(process.execPath, [path.join(fake, "swarm.mjs"), "status"], { encoding: "utf8", env: env() });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not built\. Run: npm install && npm run build/);
});

test("the launcher has no hook verb: usage, exit 1, and the usage never names a hook (D58)", () => {
  const launcher = path.resolve(path.dirname(CLI), "..", "..", "swarm.mjs");
  assert.ok(fs.existsSync(path.join(path.dirname(launcher), "dist-cli", "cli.mjs")), "build first: npm run build");
  for (const kind of ["pre", "post"]) {
    const r = spawnSync(process.execPath, [launcher, "hook", kind], { cwd: repo, input: "{}", encoding: "utf8", env: env() });
    assert.equal(r.status, 1, kind);
    assert.match(r.stderr, /^usage: swarm <verb>/);
    assert.doesNotMatch(r.stderr, /hook/i);
    assert.equal(r.stdout, "");
  }
});

// ── the page's server (Slice 3) ──────────────────────────────────────────────────

const status = () => JSON.parse(run("status", "--json").stdout);

test("serve --detach starts the server, status reports it, a second reports the one running", () => {
  assert.deepEqual(status().server, { running: false, pid: null, port: null, stale: false });
  const first = run("serve", "--detach", "--json");
  assert.equal(first.status, 0, first.stderr);
  const up = JSON.parse(first.stdout);
  assert.equal(up.server.running, true);
  assert.equal(up.server.port, port);
  assert.equal(up.url, `http://localhost:${port}/`);
  assert.equal(fs.readFileSync(path.join(toolRoot, "swarm.port"), "utf8"), String(port));
  assert.equal(Number(fs.readFileSync(path.join(toolRoot, "swarm.pid"), "utf8")), up.server.pid);

  const st = status();
  assert.equal(st.server.running, true);
  assert.equal(st.server.pid, up.server.pid);
  assert.equal(st.runs, 0);

  const second = run("serve", "--detach");
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, new RegExp(`already running on http://localhost:${port}/ \\(pid ${up.server.pid}\\)`));
  assert.equal(status().server.pid, up.server.pid, "no second server");
});

test("serve --detach --port takes the port asked for", async () => {
  const other = await freePort();
  const r = run("serve", "--detach", "--port", String(other), "--json");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).server.port, other);
});

test("open starts the server when none runs and prints the page's URL", async () => {
  const slices = path.join(toolRoot, "s.json");
  fs.writeFileSync(slices, SLICES);
  const r = run("open", "--plan", "review-tool", "--title", "T", "--slices", slices);
  assert.equal(r.status, 0, r.stderr);
  const [id, url] = r.stdout.trim().split("\n");
  assert.ok(Number(id) > 0);
  assert.equal(url, `http://localhost:${port}/?run=${id}`);
  assert.equal(status().server.running, true);
  const repos = (await (await fetch(`http://127.0.0.1:${port}/api/repos`)).json()) as { runs: { run: number }[] }[];
  assert.equal(repos[0].runs[0].run, Number(id));
  // a second run reuses the server
  const again = run("open", "--plan", "swarm", "--title", "T", "--slices", slices, "--json");
  const second = JSON.parse(again.stdout);
  assert.equal(second.url, `http://localhost:${port}/?run=${second.run}`);
});

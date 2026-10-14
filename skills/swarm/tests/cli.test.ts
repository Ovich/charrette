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

/** A stand-in for aiview's CLI over an index in `<toolRoot>/index.json`: `status` answers project
 *  `p`, `path` a file in `<toolRoot>/docs`, `open` registers (the same id on a second open), `list`
 *  and `remove` read and change the index; every call's argv is logged. */
const fakeAiview = (): { launcher: string; log: string; index: string } => {
  const launcher = path.join(toolRoot, "fake-aiview.mjs");
  const log = path.join(toolRoot, "aiview.log");
  const index = path.join(toolRoot, "index.json");
  fs.writeFileSync(index, "[]");
  fs.writeFileSync(
    launcher,
    `import fs from "node:fs"; import path from "node:path";
const argv = process.argv.slice(2).filter((a) => a !== "--json");
const [verb, arg] = argv;
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + "\\n");
const indexFile = ${JSON.stringify(index)};
const docs = JSON.parse(fs.readFileSync(indexFile, "utf8"));
const kindOf = (f) => path.basename(f).split(".").slice(-2, -1)[0];
if (verb === "status") console.log(JSON.stringify({ cwdProject: "p" }));
else if (verb === "path") { const dir = path.join(${JSON.stringify(toolRoot)}, "docs"); fs.mkdirSync(dir, { recursive: true }); console.log(JSON.stringify({ path: path.join(dir, arg), dir, project: "p" })); }
else if (verb === "open") {
  let d = docs.find((x) => x.file_path === arg);
  if (!d) { d = { id: docs.reduce((m, x) => Math.max(m, x.id), 6) + 1, file_path: arg, kind: kindOf(arg), project: "p" }; docs.push(d); fs.writeFileSync(indexFile, JSON.stringify(docs)); }
  console.log(JSON.stringify({ id: d.id, url: "http://localhost:4321/#doc=" + d.id }));
}
else if (verb === "list") console.log(JSON.stringify(docs.filter((d) => d.kind === argv[argv.indexOf("--kind") + 1])));
else if (verb === "remove") {
  const ids = argv.slice(1).map((r) => Number(r.replace("#", "")));
  fs.writeFileSync(indexFile, JSON.stringify(docs.filter((d) => !ids.includes(d.id))));
  console.log(JSON.stringify({ removed: docs.filter((d) => ids.includes(d.id)) }));
}
else process.exit(1);
`,
  );
  return { launcher, log, index };
};

const aiviewCalls = (log: string): string[][] => fs.readFileSync(log, "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
const boardFile = () => path.join(toolRoot, "docs", "swarm.swarm.json");
const boardRepos = (): string[] => new URL((JSON.parse(fs.readFileSync(boardFile(), "utf8")) as { url: string }).url).searchParams.getAll("repo");
const indexed = (index: string) => JSON.parse(fs.readFileSync(index, "utf8")) as { file_path: string; kind: string }[];

const openWith = (aiview: string, cwd = repo) => {
  const slices = path.join(toolRoot, "s.json");
  fs.writeFileSync(slices, SLICES);
  return spawnSync(process.execPath, [CLI, "open", "--plan", "review-tool", "--title", "A plan", "--slices", slices, "--json"], {
    cwd,
    encoding: "utf8",
    env: { ...env(), SWARM_AIVIEW: aiview },
  });
};

test("the first open writes the project's board document with ?repo= and registers it with no group (D17, D30)", () => {
  const { launcher, log } = fakeAiview();
  const r = openWith(launcher);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout) as { url: string; repo: string };
  assert.equal(out.url, "http://localhost:4321/#doc=7");
  const url = new URL((JSON.parse(fs.readFileSync(boardFile(), "utf8")) as { url: string }).url);
  assert.equal(`${url.origin}${url.pathname}`, `http://localhost:${port}/`);
  assert.deepEqual(boardRepos(), [out.repo]);
  const calls = aiviewCalls(log);
  assert.deepEqual(calls.find((c) => c[0] === "path"), ["path", "swarm.swarm.json", "--project", "p", "--json"]);
  assert.deepEqual(calls.find((c) => c[0] === "open"), ["open", boardFile(), "--kind", "swarm", "--json"]);
});

test("a second open in the same repository writes nothing new and prints the same document", () => {
  const { launcher, index } = fakeAiview();
  const first = JSON.parse(openWith(launcher).stdout) as { url: string };
  const before = fs.readFileSync(boardFile(), "utf8");
  const mtime = fs.statSync(boardFile()).mtimeMs;
  const second = openWith(launcher);
  assert.equal(second.status, 0, second.stderr);
  assert.equal((JSON.parse(second.stdout) as { url: string }).url, first.url);
  assert.equal(fs.readFileSync(boardFile(), "utf8"), before);
  assert.equal(fs.statSync(boardFile()).mtimeMs, mtime);
  assert.deepEqual(fs.readdirSync(path.join(toolRoot, "docs")), ["swarm.swarm.json"]);
  assert.equal(indexed(index).length, 1);
});

test("an open in a second repository of the project adds its repo to the board's URL; still one document (D39)", () => {
  const { launcher, index } = fakeAiview();
  const first = JSON.parse(openWith(launcher).stdout) as { url: string; repo: string };
  const other = path.join(toolRoot, "other");
  fs.mkdirSync(other);
  git(other, "init", "-q");
  git(other, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "root");
  const r = openWith(launcher, other);
  assert.equal(r.status, 0, r.stderr);
  const second = JSON.parse(r.stdout) as { url: string; repo: string };
  assert.notEqual(second.repo, first.repo);
  assert.equal(second.url, first.url);
  assert.deepEqual(boardRepos(), [first.repo, second.repo]);
  assert.equal(indexed(index).length, 1);
});

test("open retires the per-run swarm documents of earlier runs from the index", () => {
  const { launcher, log, index } = fakeAiview();
  const old = path.join(toolRoot, "docs", "2026-10-01-review-tool-run-3.swarm.json");
  const plan = path.join(toolRoot, "docs", "a.plan.md");
  fs.writeFileSync(index, JSON.stringify([{ id: 3, file_path: old, kind: "swarm", project: "p" }, { id: 4, file_path: plan, kind: "plan", project: "p" }]));
  const r = openWith(launcher);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(aiviewCalls(log).some((c) => c[0] === "remove" && c.includes("#3")));
  assert.deepEqual(indexed(index).map((d) => d.file_path).sort(), [plan, boardFile()].sort());
});

test("open without aiview prints the board's URL and says why", () => {
  const r = openWith(path.join(toolRoot, "none.mjs"));
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout) as { url: string; repo: string };
  assert.equal(new URL(out.url).origin, `http://localhost:${port}`);
  assert.deepEqual(new URL(out.url).searchParams.getAll("repo"), [out.repo]);
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
  assert.deepEqual(Object.keys(opened).sort(), ["group", "kind", "plan", "repo", "run", "url"]);
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
  assert.equal(new URL(url).origin + new URL(url).pathname, `http://localhost:${port}/`);
  assert.equal(new URL(url).searchParams.getAll("repo").length, 1);
  assert.equal(status().server.running, true);
  const body = (await (await fetch(`http://127.0.0.1:${port}/api/run?id=${id}`)).json()) as { snapshot: { runs: { run: number }[] } };
  assert.ok(body.snapshot.runs.some((x) => x.run === Number(id)));
  // a second run reuses the server
  const again = run("open", "--plan", "swarm", "--title", "T", "--slices", slices, "--json");
  const second = JSON.parse(again.stdout);
  assert.deepEqual(new URL(second.url).searchParams.getAll("repo"), [second.repo]);
});

// The retention setting (D32): read, set, refuse; prune uses what was set.
test("config retention prints 30, sets 7 that prune then uses, refuses 0", async () => {
  const read = run("config", "retention");
  assert.equal(read.status, 0, read.stderr);
  assert.equal(read.stdout.trim(), "30");
  const set = run("config", "retention", "7");
  assert.equal(set.status, 0, set.stderr);
  assert.equal(set.stdout.trim(), "7");
  assert.equal(run("config", "retention").stdout.trim(), "7");
  const refused = run("config", "retention", "0");
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /positive whole number/);
  const board = await openBoard(path.join(toolRoot, "swarm.sqlite"));
  try {
    assert.equal(board.setting("retention-days"), 7);
    const r = board.openRun({ repo: "/repos/x/.git", group: "g", title: "T", seats: [] });
    board.closeRun(r.id);
    assert.equal(board.prune(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)).runs, 1);
  } finally {
    board.close();
  }
});

// ---- kinds: open, join, post, endorse, delivery, code verbs, help (SL2) ----

const SEATS = JSON.stringify([
  { id: "architect", title: "the architect", role: "designs", blockers: [] },
  { id: "skeptic", title: "the skeptic", role: "doubts", blockers: [] },
]);

const openBrainstorm = (group = "idea"): number => {
  const seats = path.join(toolRoot, `${group}.seats.json`);
  fs.writeFileSync(seats, SEATS);
  const r = run("open", "--kind", "brainstorm", "--group", group, "--title", "An idea", "--seats", seats);
  assert.equal(r.status, 0, r.stderr);
  return Number(r.stdout.split("\n")[0].trim());
};

const joinSeat = (id: number, seat: string, ...extra: string[]) => run("join", "--run", String(id), "--seat", seat, "--doing", "thinking", ...extra);
const seqOf = (out: string): string => out.match(/^#(\d+)/m)![1];

test("open --kind brainstorm --group --seats opens a brainstorm run; a seat's role is accepted", () => {
  const seats = path.join(toolRoot, "seats.json");
  fs.writeFileSync(seats, SEATS);
  const r = run("open", "--kind", "brainstorm", "--group", "idea", "--title", "An idea", "--seats", seats, "--json");
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.kind, "brainstorm");
  assert.equal(out.group, "idea");
  assert.equal(out.plan, "idea");
  assert.equal(JSON.parse(run("status", "--json").stdout).runs, 1);
});

test("open refuses an unknown kind, --plan with a brainstorm kind, and a missing group", () => {
  const seats = path.join(toolRoot, "seats.json");
  fs.writeFileSync(seats, SEATS);
  const nope = run("open", "--kind", "nope", "--group", "g", "--title", "t", "--seats", seats);
  assert.equal(nope.status, 1);
  assert.match(nope.stderr, /unknown kind nope: the kinds are plan, brainstorm/);
  const both = run("open", "--kind", "brainstorm", "--plan", "g", "--title", "t", "--seats", seats);
  assert.equal(both.status, 1);
  assert.match(both.stderr, /--plan means --kind plan/);
  const noGroup = run("open", "--kind", "brainstorm", "--title", "t", "--seats", seats);
  assert.equal(noGroup.status, 1);
  assert.match(noGroup.stderr, /--group <slug> is required/);
});

test("a seats file entry without an id is refused", () => {
  const seats = path.join(toolRoot, "bad.json");
  fs.writeFileSync(seats, JSON.stringify([{ title: "no id", role: "x" }]));
  const r = run("open", "--kind", "brainstorm", "--group", "g", "--title", "t", "--seats", seats);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /without an id/);
});

test("join --seat is --slice; both naming different ids exit 1 (D49)", () => {
  const id = openRun();
  const r = run("join", "--run", String(id), "--seat", "S3", "--doing", "the page");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /you are review-tool\/S3/);
  const both = run("join", "--run", String(id), "--seat", "S5", "--slice", "S3", "--doing", "x");
  assert.equal(both.status, 1);
  assert.match(both.stderr, /--seat S5 and --slice S3 name different members/);
});

test("a seat joining from the shared checkout is told its --as and its next commands, the listener last", () => {
  const id = openBrainstorm();
  const r = joinSeat(id, "architect");
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trimEnd().split("\n");
  assert.match(lines[0], /^you are idea\/architect/);
  assert.ok(lines.includes("pass --as idea/architect on every call: this checkout is shared, the board cannot tell you apart"));
  for (const verb of ["post", "agree", "endorse", "wait --mentions"]) {
    assert.ok(lines.some((l) => l.includes(` ${verb} `) && l.includes("--as idea/architect")), `${verb} line with --as`);
  }
  assert.doesNotMatch(r.stdout, /--slice/);
  assert.match(lines.at(-1)!, /^start your listener now.* wait --mentions --as idea\/architect$/);
  const json = JSON.parse(run("join", "--run", String(id), "--seat", "skeptic", "--doing", "doubting", "--json").stdout);
  assert.equal(json.as, "idea/skeptic");
  assert.equal(json.commands.length, 4);
  assert.ok(json.commands.every((c: string) => c.includes("--as idea/skeptic")));
});

test("a seat's --files is refused by the board", () => {
  const id = openBrainstorm();
  const r = joinSeat(id, "architect", "--files", "src/x.ts");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /join: a brainstorm run has no claims/);
});

test("post --main lands in main; a cross-run mention without --main lands there too", () => {
  const id = openBrainstorm();
  joinSeat(id, "architect");
  const main = run("post", "hello all", "--main", "--as", "idea/architect");
  assert.equal(main.status, 0, main.stderr);
  assert.match(main.stdout, /^#\d+ \(main\)$/m);
  const inRun = run("post", "in the run", "--about", "D3", "--as", "idea/architect");
  assert.match(inRun.stdout, /^#\d+$/m);
  const other = openRun();
  run("join", "--run", String(other), "--slice", "S3", "--doing", "x");
  const cross = run("post", "@review-tool/S3 a question", "--as", "idea/architect");
  assert.equal(cross.status, 0, cross.stderr);
  assert.match(cross.stdout, /^#\d+ \(main\)$/m);
});

test("endorse backs an agreement and prints its seq; a plain post exits 1", () => {
  const id = openBrainstorm();
  joinSeat(id, "architect");
  joinSeat(id, "skeptic");
  const agreed = run("agree", "we keep D3 because it is simple", "--about", "D3", "--as", "idea/architect");
  const ok = run("endorse", `#${seqOf(agreed.stdout)}`, "--as", "idea/skeptic");
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^#\d+/);
  const plain = run("post", "just a note", "--as", "idea/architect");
  const bad = run("endorse", seqOf(plain.stdout), "--as", "idea/skeptic");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /is not an agreement/);
});

test("a seat's wait that receives an agreement prints the back-it line; a plan runner's does not", () => {
  const id = openBrainstorm();
  joinSeat(id, "architect");
  joinSeat(id, "skeptic");
  const agreed = run("agree", "@skeptic we keep D3", "--about", "D3", "--as", "idea/architect");
  const w = run("wait", "--mentions", "--timeout", "2000", "--as", "idea/skeptic");
  assert.equal(w.status, 0, w.stderr);
  assert.match(w.stdout, new RegExp(`back it: node \\S+ endorse ${seqOf(agreed.stdout)} --as idea/skeptic`));
  const plan = openRun();
  run("join", "--run", String(plan), "--slice", "S3", "--doing", "x");
  run("join", "--run", String(plan), "--slice", "S5", "--doing", "y");
  run("agree", "@S5 S3 owns the page", "--as", "review-tool/S3");
  const pw = run("wait", "--mentions", "--timeout", "2000", "--as", "review-tool/S5");
  assert.equal(pw.status, 0, pw.stderr);
  assert.match(pw.stdout, /S3 owns the page/);
  assert.doesNotMatch(pw.stdout, /back it:/);
});

test("the code verbs, called by a seat, exit 1 naming the kind", () => {
  const id = openBrainstorm();
  joinSeat(id, "architect");
  for (const argv of [["claim", "src/x.ts"], ["release", "src/x.ts"], ["merge-lock", "--onto", "main"], ["merged", "abc", "--files", "x"]]) {
    const r = run(...argv, "--as", "idea/architect");
    assert.equal(r.status, 1, argv.join(" "));
    assert.match(r.stderr, new RegExp(`${argv[0]}: a brainstorm run has no claims`));
  }
});

test("--help prints the core verbs, --help code the claim and merge verbs; no verb the core usage", () => {
  const core = run("--help");
  assert.equal(core.status, 0);
  for (const v of ["open", "join", "post", "agree", "endorse", "wait"]) assert.match(core.stdout, new RegExp(`^  ${v} `, "m"));
  for (const v of ["claim", "release", "merge-lock", "merged"]) assert.doesNotMatch(core.stdout, new RegExp(`^  ${v} `, "m"));
  assert.match(core.stdout.trimEnd().split("\n").at(-1)!, /^a member is <group>\/<seat>, the orchestrator <group>\/orchestrator/);
  const code = run("--help", "code");
  assert.equal(code.status, 0);
  for (const v of ["claim", "release", "merge-lock", "merged"]) assert.match(code.stdout, new RegExp(`^  ${v} `, "m"));
  const none = run();
  assert.equal(none.status, 1);
  assert.match(none.stderr, /^  endorse /m);
  assert.doesNotMatch(none.stderr, /^  claim /m);
});

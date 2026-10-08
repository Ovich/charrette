// Claims by the CLI (D58): `swarm claim` before an edit, and `swarm end` reconciling what the
// runner wrote without one. Two runners of one run, each in a worktree of its own.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openBoard } from "../src/board/board.ts";
import { freePort, stopServer } from "./support/page-server.ts";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli", "index.ts");

let home: string;
let repo: string;
let wtA: string;
let wtB: string;
let port: number;

// SWARM_PORT: `open` starts the page's server; each test on a port of its own.
const env = () => ({ ...process.env, SWARM_ROOT: home, CHARRETTE_HOME: home, SWARM_PORT: String(port) });
const swarm = (cwd: string, ...argv: string[]) => spawnSync(process.execPath, [CLI, ...argv], { cwd, encoding: "utf8", env: env() });
const cli = (cwd: string, ...argv: string[]): string => {
  const r = swarm(cwd, ...argv);
  assert.equal(r.status, 0, `${argv.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
/** The claim's own answer: the listener line a runner with no listener gets last (D61), checked
 *  present and taken off; `answerJson` does the same with `next`, its --json form. */
const LISTENER = /^start your listener now, in the background \(your harness's background task\): node \S+ wait --mentions --as \S+\n$/m;
const answer = (stdout: string): string => {
  assert.match(stdout, LISTENER);
  return stdout.replace(LISTENER, "");
};
const answerJson = (stdout: string): Record<string, unknown> => {
  const { next, ...rest } = JSON.parse(stdout);
  assert.match(next, /wait --mentions --as /);
  return rest;
};
const git = (cwd: string, ...argv: string[]): void => {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};

const SLICES = JSON.stringify([
  { id: "S3", title: "the page", blockers: [] },
  { id: "S5", title: "the skill", blockers: [] },
]);

/** A run with S3 in worktree a (holding src/a.ts) and S5 in worktree b; S3's funny name. */
const running = (): string => {
  const slices = path.join(home, "slices.json");
  fs.writeFileSync(slices, SLICES);
  const id = cli(repo, "open", "--plan", "review-tool", "--title", "T", "--slices", slices).split("\n")[0].trim(); // the run id, then the page's URL
  const s3 = JSON.parse(cli(wtA, "join", "--run", id, "--slice", "S3", "--doing", "the page", "--files", "src/a.ts:inside", "--json"));
  cli(wtB, "join", "--run", id, "--slice", "S5", "--doing", "the skill");
  cli(wtA, "deliver");
  cli(wtB, "deliver");
  return s3.nick;
};

beforeEach(async () => {
  port = await freePort();
  home = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-claim-"));
  repo = path.join(home, "repo");
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src", "old.ts"), "export {};\n");
  fs.writeFileSync(path.join(repo, "src", "a.ts"), "export {};\n");
  git(repo, "init", "-q", "-b", "main");
  git(repo, "add", ".");
  git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "root");
  wtA = path.join(home, "wt-a");
  wtB = path.join(home, "wt-b");
  git(repo, "worktree", "add", "-q", "-b", "a", wtA);
  git(repo, "worktree", "add", "-q", "-b", "b", wtB);
});

afterEach(() => {
  stopServer(home);
  for (let i = 0; ; i++) {
    try {
      fs.rmSync(home, { recursive: true, force: true });
      return;
    } catch {
      if (i >= 5) return console.warn(`cleanup: temp dir left behind: ${home}`);
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},200)"]);
    }
  }
});

test("claim on a free path claims it, exit 0; another runner is then held on it", () => {
  running();
  const r = swarm(wtA, "claim", "src/new.ts");
  assert.deepEqual([r.status, answer(r.stdout), r.stderr], [0, "claimed src/new.ts\n", ""]);
  const held = swarm(wtB, "claim", "src/new.ts");
  assert.equal(held.status, 3);
  assert.match(held.stdout, /src\/new\.ts is also held by review-tool\/S3/);
});

test("claim on a shared path before a post holds it: the holder, its note, the post to make, exit 3 (D41)", () => {
  const nick = running();
  const r = swarm(wtB, "claim", "src/a.ts");
  assert.equal(r.status, 3, r.stderr);
  assert.equal(
    answer(r.stdout),
    `src/a.ts is also held by review-tool/S3 (${nick}: the page). You may share it, but first tell its holder what you change in it: ` +
      '`swarm post "@review-tool/S3 …" --about src/a.ts`, then claim again.\n',
  );
  // held again until the post is made
  assert.equal(swarm(wtB, "claim", "src/a.ts").status, 3);
  const json = swarm(wtB, "claim", "src/a.ts", "--json");
  assert.equal(json.status, 3);
  assert.deepEqual(Object.keys(answerJson(json.stdout)).sort(), ["allowed", "refusal"]);
});

test("claim on a shared path after a post: claimed, the other holder named once, exit 0 (D40)", () => {
  const nick = running();
  swarm(wtB, "claim", "src/a.ts");
  cli(wtB, "post", "@S3 I add isExpired() at the end", "--about", "src/a.ts");
  const first = swarm(wtB, "claim", "src/a.ts");
  assert.deepEqual([first.status, answer(first.stdout)], [0, `claimed src/a.ts, also held by review-tool/S3 · ${nick}: the page\n`]);
  assert.equal(answer(cli(wtB, "claim", "src/a.ts")), "claimed src/a.ts\n", "the notice, once per runner and path");
  assert.deepEqual(answerJson(cli(wtB, "claim", "src/a.ts", "--json")), {
    allowed: true,
    sharedWith: [{ runner: "review-tool/S3", doing: "the page" }],
    notice: null,
  });
});

test("claim --interface claims the path as an interface", async () => {
  running();
  assert.equal(answer(cli(wtA, "claim", "src/api.ts", "--interface")), "claimed src/api.ts\n");
  const board = await openBoard(path.join(home, "swarm.sqlite"));
  try {
    const files = board.snapshot(board.repos()[0].repo).files;
    assert.deepEqual(
      files.find((f) => f.path === "src/api.ts"),
      { path: "src/api.ts", holders: ["review-tool/S3"], interface: true },
    );
  } finally {
    board.close();
  }
});

test("end reconciles git status before releasing: a shell write and a rename claimed, a held write flagged", () => {
  running();
  // written by a shell command, never claimed
  const shell = spawnSync("echo x > src/new.ts", { cwd: wtB, shell: true, encoding: "utf8" });
  assert.equal(shell.status, 0, shell.stderr);
  git(wtB, "mv", "src/old.ts", "src/renamed.ts");
  fs.writeFileSync(path.join(wtB, "src", "a.ts"), "// S3's\n");
  const r = JSON.parse(cli(wtB, "end", "--json"));
  assert.equal(r.ended, true);
  assert.deepEqual([...r.reconciled].sort(), ["src/a.ts", "src/new.ts", "src/old.ts", "src/renamed.ts"]);
  assert.deepEqual(
    r.flags.map((f: { path: string; holder: string }) => [f.path, f.holder]),
    [["src/a.ts", "review-tool/S3"]],
  );
  // the flag is on the thread, mentioning both
  const forS3 = JSON.parse(cli(wtA, "deliver", "--json"));
  const flag = forS3.full.find((m: { body: string }) => /flag:/.test(m.body));
  assert.ok(flag, JSON.stringify(forS3));
  assert.deepEqual([...flag.mentions].sort(), ["review-tool/S3", "review-tool/S5"]);
});

test("end lists what it reconciled, then the end", () => {
  running();
  fs.writeFileSync(path.join(wtB, "src", "new.ts"), "export const x = 1;\n");
  fs.writeFileSync(path.join(wtB, "src", "a.ts"), "// S3's\n");
  const out = cli(wtB, "end").split("\n");
  assert.deepEqual(out.filter((l) => l.startsWith("reconciled ")).sort(), ["reconciled src/a.ts", "reconciled src/new.ts"]);
  assert.ok(out.some((l) => /^#\d+ flagged: you wrote src\/a\.ts outside your claim; review-tool\/S3 holds it/.test(l)), out.join("\n"));
  assert.ok(out.includes("review-tool/S5 ended"));
});

const commit = (cwd: string, msg: string): void => {
  git(cwd, "add", "-A");
  git(cwd, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", msg);
};

test("merge-lock reconciles the branch's commits against --onto: a never-claimed file claimed, the lock granted (D59)", () => {
  running();
  fs.writeFileSync(path.join(wtB, "src", "new.ts"), "export const x = 1;\n");
  commit(wtB, "new");
  const out = cli(wtB, "merge-lock", "--onto", "main").split("\n");
  assert.deepEqual(out.filter((l) => l.startsWith("reconciled ")), ["reconciled src/new.ts"]);
  assert.ok(out.some((l) => l.startsWith("granted: ")), out.join("\n"));
  // claimed: another runner is now held on it
  assert.equal(swarm(wtA, "claim", "src/new.ts").status, 3);
});

test("merge-lock flags a committed file another runner holds, mentioning both, and still grants the lock (D59)", () => {
  running();
  fs.writeFileSync(path.join(wtB, "src", "a.ts"), "// S3's\n");
  commit(wtB, "a");
  const r = JSON.parse(cli(wtB, "merge-lock", "--onto", "main", "--json"));
  assert.equal(r.granted, true);
  assert.deepEqual(r.reconciled, ["src/a.ts"]);
  assert.deepEqual(
    r.flags.map((f: { path: string; holder: string }) => [f.path, f.holder]),
    [["src/a.ts", "review-tool/S3"]],
  );
  const forS3 = JSON.parse(cli(wtA, "deliver", "--json"));
  const flag = forS3.full.find((m: { body: string }) => /flag:/.test(m.body));
  assert.ok(flag, JSON.stringify(forS3));
  assert.deepEqual([...flag.mentions].sort(), ["review-tool/S3", "review-tool/S5"]);
});

test("merge-lock claims both paths of a committed rename, and an uncommitted write beside it (D59)", () => {
  running();
  git(wtB, "mv", "src/old.ts", "src/renamed.ts");
  commit(wtB, "rename");
  fs.writeFileSync(path.join(wtB, "src", "wip.ts"), "export {};\n");
  const r = JSON.parse(cli(wtB, "merge-lock", "--onto", "main", "--json"));
  assert.equal(r.granted, true);
  assert.deepEqual([...r.reconciled].sort(), ["src/old.ts", "src/renamed.ts", "src/wip.ts"]);
  for (const f of ["src/old.ts", "src/renamed.ts", "src/wip.ts"]) assert.equal(swarm(wtA, "claim", f).status, 3, f);
});

test("merge-lock without --onto says it is required and grants nothing (D59)", () => {
  running();
  const r = swarm(wtB, "merge-lock");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /--onto is required/);
  assert.ok(cli(wtA, "merge-lock", "--onto", "main").includes("granted: "), "the lock is still free");
});

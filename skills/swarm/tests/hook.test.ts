// The hook adapter, spawned with hook JSON on stdin as Claude Code sends it.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { freePort, stopServer } from "./support/page-server.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.resolve(HERE, "..", "src", "cli", "index.ts");
const LAUNCHER = path.resolve(HERE, "..", "swarm.mjs");

let home: string;
let repo: string;
let wtA: string;
let wtB: string;
let port: number;

// SWARM_PORT: `open` starts the page's server (Slice 3); each test on a port of its own.
const env = () => ({ ...process.env, SWARM_ROOT: home, CHARRETTE_HOME: home, SWARM_PORT: String(port) });
const cli = (cwd: string, ...argv: string[]) => {
  const r = spawnSync(process.execPath, [CLI, ...argv], { cwd, encoding: "utf8", env: env() });
  assert.equal(r.status, 0, `${argv.join(" ")}: ${r.stderr}`);
  return r.stdout;
};
const git = (cwd: string, ...argv: string[]): void => {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};

type Input = { cwd: string; tool_name: string; tool_input: Record<string, unknown>; agent_id?: string; session_id?: string };
const hook = (kind: "pre" | "post", input: Input | string, entry = CLI) => {
  const body =
    typeof input === "string"
      ? input
      : JSON.stringify({
          session_id: "session-main",
          transcript_path: path.join(home, "t.jsonl"),
          hook_event_name: kind === "pre" ? "PreToolUse" : "PostToolUse",
          ...input,
        });
  const r = spawnSync(process.execPath, [entry, "hook", kind], { input: body, encoding: "utf8", env: env(), cwd: home });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, json: r.stdout ? JSON.parse(r.stdout) : null };
};

const SLICES = JSON.stringify([
  { id: "S3", title: "the page", blockers: [] },
  { id: "S5", title: "the skill", blockers: [] },
]);

/** A run with S3 in worktree a (holding src/a.ts) and S5 in worktree b. */
const running = (): string => {
  const slices = path.join(home, "slices.json");
  fs.writeFileSync(slices, SLICES);
  const id = cli(repo, "open", "--plan", "review-tool", "--title", "T", "--slices", slices).split("\n")[0].trim(); // the run id, then the page's URL
  cli(wtA, "join", "--run", id, "--slice", "S3", "--doing", "the page", "--files", "src/a.ts:inside,src/api.ts:interface");
  cli(wtB, "join", "--run", id, "--slice", "S5", "--doing", "the skill");
  cli(wtA, "deliver");
  cli(wtB, "deliver");
  return id;
};

beforeEach(async () => {
  port = await freePort();
  home = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-hook-"));
  repo = path.join(home, "repo");
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.writeFileSync(path.join(repo, "src", "old.ts"), "export {};\n");
  git(repo, "init", "-q");
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

test("pre holds the first edit of a shared file with the holder, the note and the post to make (D41)", () => {
  running();
  const r = hook("pre", { cwd: wtB, agent_id: "agent-b", tool_name: "Edit", tool_input: { file_path: path.join(wtB, "src", "a.ts") } });
  assert.equal(r.status, 0);
  const out = r.json.hookSpecificOutput;
  assert.equal(out.hookEventName, "PreToolUse");
  assert.equal(out.permissionDecision, "deny");
  assert.match(out.permissionDecisionReason, /review-tool\/S3/);
  assert.match(out.permissionDecisionReason, /the page/);
  assert.match(out.permissionDecisionReason, /`swarm post "@review-tool\/S3 …" --about src\/a\.ts`, then retry the edit\./);
  // the holder's own edit, and a free file, pass with nothing printed
  assert.equal(hook("pre", { cwd: wtA, tool_name: "Write", tool_input: { file_path: path.join(wtA, "src", "a.ts") } }).stdout, "");
  assert.equal(hook("pre", { cwd: wtB, tool_name: "NotebookEdit", tool_input: { notebook_path: path.join(wtB, "n.ipynb") } }).stdout, "");
});

test("pre allows a shared file after the post, the other holder named once in its context", () => {
  running();
  const edit = (cwd: string) => hook("pre", { cwd, tool_name: "Edit", tool_input: { file_path: path.join(cwd, "src", "a.ts") } });
  assert.equal(edit(wtB).json.hookSpecificOutput.permissionDecision, "deny");
  cli(wtB, "post", "@S3 I add isExpired() at the end", "--about", "src/a.ts");
  const allowed = edit(wtB).json.hookSpecificOutput;
  assert.deepEqual(allowed, { hookEventName: "PreToolUse", additionalContext: "swarm board: src/a.ts is also held by review-tool/S3: the page" });
  assert.equal(edit(wtB).stdout, "", "told once");
  // the holder, on its next edit, hears of the newcomer once, and is never held
  assert.match(edit(wtA).json.hookSpecificOutput.additionalContext, /src\/a\.ts is also held by review-tool\/S5: the skill/);
  assert.equal(edit(wtA).stdout, "");
});

test("pre maps agent_id on swarm join", () => {
  const slices = path.join(home, "slices.json");
  fs.writeFileSync(slices, SLICES);
  const id = cli(repo, "open", "--plan", "review-tool", "--title", "T", "--slices", slices).split("\n")[0].trim(); // the run id, then the page's URL
  cli(wtA, "join", "--run", id, "--slice", "S3", "--doing", "the page");
  const command = `node "${LAUNCHER}" join --run ${id} --slice S5 --doing "the skill"`;
  const seen = hook("pre", { cwd: wtB, agent_id: "agent-b", tool_name: "Bash", tool_input: { command } });
  assert.equal(seen.status, 0);
  assert.equal(seen.stdout, "");
  cli(wtB, "join", "--run", id, "--slice", "S5", "--doing", "the skill");
  cli(wtB, "deliver");
  cli(wtA, "post", "@S5 over to you");
  // from a directory that is no worktree: only the bound agent id can name the caller
  const r = hook("post", { cwd: home, agent_id: "agent-b", tool_name: "Read", tool_input: {} });
  assert.match(r.json.hookSpecificOutput.additionalContext, /you are review-tool\/S5/);
  assert.match(r.json.hookSpecificOutput.additionalContext, /@S5 over to you/);
});

test("pre maps session_id on swarm open", () => {
  assert.equal(fs.existsSync(path.join(home, "swarm.active")), false, "no run open yet");
  const slices = path.join(home, "slices.json");
  fs.writeFileSync(slices, SLICES);
  const command = `swarm open --plan review-tool --title T --slices ${slices}`;
  assert.equal(hook("pre", { cwd: repo, session_id: "session-orc", tool_name: "Bash", tool_input: { command } }).stdout, "");
  const id = cli(repo, "open", "--plan", "review-tool", "--title", "T", "--slices", slices).split("\n")[0].trim(); // the run id, then the page's URL
  cli(wtA, "join", "--run", id, "--slice", "S3", "--doing", "the page");
  cli(wtA, "post", "@orchestrator S3 needs a decision");
  const r = hook("post", { cwd: home, session_id: "session-orc", tool_name: "Read", tool_input: {} });
  assert.match(r.json.hookSpecificOutput.additionalContext, /you are review-tool\/orchestrator/);
  assert.match(r.json.hookSpecificOutput.additionalContext, /S3 needs a decision/);
});

test("post returns a mention in full and the rest one line each", () => {
  running();
  cli(wtA, "post", "@S5 I take src/a.ts first\nthen the rest");
  cli(wtA, "post", "progress: half way\nsecond line never shown");
  const r = hook("post", { cwd: wtB, tool_name: "Read", tool_input: {} });
  assert.equal(r.status, 0);
  const ctx: string = r.json.hookSpecificOutput.additionalContext;
  assert.equal(r.json.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(ctx, /#\d+ review-tool\/S3 {2}\S+\n@S5 I take src\/a\.ts first\nthen the rest/);
  assert.match(ctx, /#\d+ review-tool\/S3: progress: half way/);
  assert.doesNotMatch(ctx, /second line never shown/);
});

test("post prints nothing when nothing is undelivered", () => {
  running();
  const r = hook("post", { cwd: wtB, tool_name: "Read", tool_input: {} });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");
});

test("post claims a file a Bash call wrote", () => {
  running();
  fs.writeFileSync(path.join(wtB, "src", "new.ts"), "export const x = 1;\n");
  git(wtB, "mv", "src/old.ts", "src/renamed.ts");
  const r = hook("post", { cwd: wtB, tool_name: "Bash", tool_input: { command: "echo x >> src/new.ts" } });
  assert.equal(r.status, 0);
  for (const file of ["src/new.ts", "src/old.ts", "src/renamed.ts"]) {
    const pre = hook("pre", { cwd: wtA, tool_name: "Edit", tool_input: { file_path: path.join(wtA, file) } });
    assert.match(pre.json?.hookSpecificOutput.permissionDecisionReason ?? "", /held by review-tool\/S5/, file);
  }
  // a held file written outside the claim is flagged, mentioning both
  fs.writeFileSync(path.join(wtB, "src", "a.ts"), "// S3's\n");
  const flagged = hook("post", { cwd: wtB, tool_name: "Bash", tool_input: { command: "echo y > src/a.ts" } });
  assert.match(flagged.json.hookSpecificOutput.additionalContext, /flagged: you wrote src\/a\.ts outside your claim; review-tool\/S3 holds it/);
  const forS3 = JSON.parse(cli(wtA, "deliver", "--json"));
  assert.deepEqual([...forS3.full[0].mentions].sort(), ["review-tool/S3", "review-tool/S5"]);
});

test("a failure inside the hook exits 0 and prints nothing", () => {
  running();
  for (const kind of ["pre", "post"] as const) {
    const r = hook(kind, "{ not json");
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""], kind);
  }
  fs.writeFileSync(path.join(home, "swarm.sqlite"), "this is no database");
  for (const kind of ["pre", "post"] as const) {
    const r = hook(kind, { cwd: wtB, tool_name: "Edit", tool_input: { file_path: path.join(wtB, "src", "a.ts") } });
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""], kind);
  }
});

test("with no open run, the hook exits 0 under 100 ms", () => {
  assert.ok(fs.existsSync(path.join(path.dirname(LAUNCHER), "dist-cli", "cli.mjs")), "build first: npm run build");
  const input = { cwd: repo, tool_name: "Edit", tool_input: { file_path: path.join(repo, "src", "a.ts") } };
  const median = (kind: "pre" | "post"): number => {
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t0 = performance.now();
      const r = hook(kind, input, LAUNCHER);
      times.push(performance.now() - t0);
      assert.deepEqual([r.status, r.stdout], [0, ""]);
    }
    times.sort((a, b) => a - b);
    return (times[4] + times[5]) / 2;
  };
  const pre = median("pre");
  const post = median("post");
  console.log(`hook cost, no open run, median of ten spawns: pre ${pre.toFixed(1)} ms, post ${post.toFixed(1)} ms`);
  assert.equal(fs.existsSync(path.join(home, "swarm.sqlite")), false, "the store was never opened");
  assert.ok(pre < 100 && post < 100, `pre ${pre} ms, post ${post} ms`);
});

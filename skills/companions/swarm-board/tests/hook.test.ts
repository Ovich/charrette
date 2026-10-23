// swarm-relay D43: every member always receives the messages for it. The delivery hook, given the agent's key, hands
// the member what is for it after a tool call, once, and blocks a stop while something for it is unread; a session that
// is no member gets nothing. Runs the built bundles (dist-cli), as the plugin does.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerHooked } from "../src/link/hooked.ts";
import { stopServerOf } from "./fixtures/server.ts";

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist-cli");
const CLI = path.join(DIST, "cli.mjs");
const HOOK = path.join(DIST, "hook.mjs");

let home: string;
let repo: string;
const env = () => ({ ...process.env, CHARRETTE_HOME: home, SWARM_ROOT: home, SWARM_NO_POLLER: "1" });
const run = (...argv: string[]) => spawnSync(process.execPath, [CLI, ...argv], { cwd: repo, encoding: "utf8", env: env() });
const hook = (input: object) => spawnSync(process.execPath, [HOOK], { cwd: repo, encoding: "utf8", env: env(), input: JSON.stringify(input) });

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-hook-"));
  repo = path.join(home, "repo");
  fs.mkdirSync(repo);
  spawnSync("git", ["init", "-q"], { cwd: repo });
  const seats = path.join(home, "seats.json");
  fs.writeFileSync(seats, JSON.stringify([{ id: "S1", title: "the page", blockers: [] }]));
  const opened = run("open", "--plan", "p", "--title", "A plan", "--slices", seats);
  assert.equal(opened.status, 0, opened.stderr);
  const id = opened.stdout.split("\n")[0].trim();
  const joined = run("join", "--run", id, "--slice", "S1", "--doing", "the page");
  assert.equal(joined.status, 0, joined.stderr);
  // what was there before the test is for nobody: the member read it
  run("deliver", "--as", "p/S1");
  // the member's agent, a subagent: its link registered it under its transcript's key, and is alive (this process)
  registerHooked(home, path.join(home, "agent-abc.jsonl"), { run: Number(id), member: "p/S1", pid: process.pid, link: "node swarm.mjs link" });
});

afterEach(() => {
  stopServerOf(home);
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("a session that is no member: the hook says nothing", () => {
  const r = hook({ hook_event_name: "PostToolUse", session_id: "someone-else" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "");
});

test("a mention reaches the member at its next tool call, once; it shows unread until then", () => {
  assert.equal(run("post", "--as", "p/orchestrator", "@S1 stop the walk").status, 0);
  const { roster } = JSON.parse(run("roster", "--json").stdout) as { roster: { name: string; unread: number }[] };
  assert.equal(roster.find((m) => m.name === "p/S1")!.unread, 1);
  const first = hook({ hook_event_name: "PostToolUse", session_id: "parent", agent_id: "abc" });
  assert.equal(first.status, 0, first.stderr);
  const out = JSON.parse(first.stdout) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
  assert.match(out.hookSpecificOutput.additionalContext, /stop the walk/);
  assert.equal(hook({ hook_event_name: "PostToolUse", session_id: "parent", agent_id: "abc" }).stdout, "");
});

test("a member cannot stop on an unread mention: the stop is blocked with it", () => {
  assert.equal(hook({ hook_event_name: "SubagentStop", session_id: "parent", agent_id: "abc" }).stdout, "");
  assert.equal(run("post", "--as", "p/orchestrator", "@S1 one more thing").status, 0);
  const r = hook({ hook_event_name: "SubagentStop", session_id: "parent", agent_id: "abc" });
  const out = JSON.parse(r.stdout) as { decision: string; reason: string };
  assert.equal(out.decision, "block");
  assert.match(out.reason, /one more thing/);
});

test("a member whose link stopped is told to start it again", () => {
  registerHooked(home, path.join(home, "agent-abc.jsonl"), { run: 1, member: "p/S1", pid: 999999, link: "node swarm.mjs link --run 1 --as p/S1" });
  const out = JSON.parse(hook({ hook_event_name: "PostToolUse", session_id: "parent", agent_id: "abc" }).stdout) as { hookSpecificOutput: { additionalContext: string } };
  assert.match(out.hookSpecificOutput.additionalContext, /Start it again now, as a background task: node swarm.mjs link --run 1 --as p\/S1/);
});

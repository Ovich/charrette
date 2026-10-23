// The delivery hook (swarm-relay D43): every member always receives the messages for it, whatever its brief or role.
// Claude Code runs it after each tool call (PostToolUse) and when an agent would stop (Stop, SubagentStop), in every
// session where the plugin is on. A session that is no member answers in one missing-file check; a member's agent gets
// what is for it in its context after the call, and cannot stop while something for it is unread.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_ROOT } from "../board/home.ts";
import { hookKey, readHooked } from "../link/hooked.ts";

type HookInput = { hook_event_name?: string; session_id?: string; agent_id?: string; stop_hook_active?: boolean };

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

function readInput(): HookInput {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8")) as HookInput;
  } catch {
    return {};
  }
}

/** What is for the member now, as `deliver --mentions` prints it; empty when nothing, or when the board does not answer. */
function pending(member: string): string {
  const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), "cli.mjs");
  const r = spawnSync(process.execPath, [cli, "deliver", "--mentions", "--from-hook", "--as", member], { encoding: "utf8", timeout: 15_000, windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "";
}

const input = readInput();
const key = hookKey(input);
const hooked = key ? readHooked(DATA_ROOT, key) : null;
if (!hooked) process.exit(0);

const event = input.hook_event_name ?? "";
const messages = pending(hooked.member);
const head = `Swarm board, for you (${hooked.member}). Read it and act on it before you go on:`;

if (event === "Stop" || event === "SubagentStop") {
  // never stop on an unread message: blocked, the agent is handed it as its next instruction
  if (messages) console.log(JSON.stringify({ decision: "block", reason: `${head}\n${messages}` }));
  process.exit(0);
}

const parts: string[] = [];
if (messages) parts.push(`${head}\n${messages}`);
// a link that stopped (the agent was stopped, then resumed): the agent starts it again, or the board sees it gone
if (!isAlive(hooked.pid)) parts.push(`Your swarm link has stopped. Start it again now, as a background task: ${hooked.link}`);
if (parts.length) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: event || "PostToolUse", additionalContext: parts.join("\n\n") } }));

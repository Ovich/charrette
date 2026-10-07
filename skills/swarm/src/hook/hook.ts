// Hook adapter — `swarm hook pre|post`. Reads Claude Code's hook JSON on stdin, calls the
// board, prints the hook JSON on stdout, always exits 0. A broken board must never stop a
// tool call: any failure prints nothing. With no open run on the machine (no active
// marker) it exits before opening the store, so a plugin user outside a swarm pays a
// file check per call.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openBoard, type Board, type Participant } from "../board/board.ts";
import { ACTIVE_MARKER } from "../board/home.ts";
import { deliveryText } from "../cli/format.ts";

export type HookInput = {
  session_id: string;
  transcript_path: string;
  cwd: string;
  agent_id?: string; // present inside a subagent
  agent_type?: string;
  hook_event_name: "PreToolUse" | "PostToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
};
type PreOutput =
  | { hookSpecificOutput: { hookEventName: "PreToolUse"; permissionDecision: "deny"; permissionDecisionReason: string } }
  | { hookSpecificOutput: { hookEventName: "PreToolUse"; additionalContext: string } };
type PostOutput = { hookSpecificOutput: { hookEventName: "PostToolUse"; additionalContext: string } };

const EDITS = new Set(["Edit", "Write", "NotebookEdit"]);

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
};

/** A `swarm join` / `swarm open` in a Bash command, with the flags that name the caller. */
type SwarmCall = { verb: "join"; run: number; slice: string } | { verb: "open"; plan: string };
const SWARM_VERB = /(?:^|[\s;&|("'\/\\])swarm(?:\.mjs)?["']?\s+(join|open)\b([^\n;&|]*)/;
const flagIn = (args: string, name: string): string | undefined => args.match(new RegExp(`--${name}[\\s=]+["']?([^\\s"']+)`))?.[1];
export function swarmCall(command: string): SwarmCall | null {
  const m = command.match(SWARM_VERB);
  if (!m) return null;
  if (m[1] === "open") {
    const plan = flagIn(m[2], "plan");
    return plan ? { verb: "open", plan } : null;
  }
  const run = Number(flagIn(m[2], "run"));
  const slice = flagIn(m[2], "slice");
  return Number.isInteger(run) && slice ? { verb: "join", run, slice } : null;
}

/** Repository-relative paths `git status` shows changed in a worktree; a rename gives both (D31). */
function changedIn(worktree: string): string[] {
  const r = spawnSync("git", ["status", "--porcelain", "-z", "--untracked-files=all"], { cwd: worktree, encoding: "utf8" });
  if (r.status !== 0) return [];
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

function pre(board: Board, input: HookInput): PreOutput | null {
  const who = { agentId: input.agent_id, sessionId: input.session_id };
  if (input.tool_name === "Bash") {
    const call = swarmCall(String(input.tool_input.command ?? ""));
    if (call?.verb === "join") board.bind(who, { run: call.run, slice: call.slice });
    else if (call?.verb === "open") board.bind(who, { plan: call.plan, slice: "orchestrator" });
    return null;
  }
  if (!EDITS.has(input.tool_name)) return null;
  const file = input.tool_input.file_path ?? input.tool_input.notebook_path;
  if (typeof file !== "string" || !file) return null;
  const p = board.identify({ ...who, worktree: input.cwd });
  if (!p) return null;
  const verdict = board.checkEdit(p, path.resolve(input.cwd || ".", file));
  // a shared file: the edit goes through, the other holders named once (D40)
  if (verdict.allowed) return verdict.notice ? { hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: `swarm board: ${verdict.notice}` } } : null;
  return { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: verdict.refusal } };
}

function post(board: Board, input: HookInput): PostOutput | null {
  const p: Participant | null = board.identify({ agentId: input.agent_id, sessionId: input.session_id, worktree: input.cwd });
  if (!p) return null;
  const flags = input.tool_name === "Bash" && p.worktree ? board.reconcileWrites(p, changedIn(p.worktree)) : [];
  const news = deliveryText(board.deliver(p));
  const flagged = flags.map((f) => `#${f.seq} flagged: you wrote ${f.path} outside your claim; ${f.holder} holds it. Settle it with @${f.holder} on the board.`);
  const text = [news, ...flagged].filter(Boolean).join("\n");
  if (!text) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `swarm board (you are ${p.name}, ${p.nick}; full text of a line: swarm read <n>):\n${text}`,
    },
  };
}

export async function runHook(kind: string | undefined): Promise<void> {
  let board: Board | null = null;
  try {
    if (kind !== "pre" && kind !== "post") return;
    const active = fs.existsSync(ACTIVE_MARKER);
    if (!active && kind === "post") return; // the fast exit
    const raw = await readStdin();
    // a `swarm open` is the one call worth seeing while no run is open: it starts one
    if (!active && !raw.includes("open")) return;
    const input = JSON.parse(raw) as HookInput;
    const call = input.tool_name === "Bash" ? swarmCall(String(input.tool_input?.command ?? "")) : null;
    if (!active && call?.verb !== "open") return;
    // the pre hook needs the store for an edit, or a Bash call that joins or opens; no other Bash call
    if (kind === "pre" && input.tool_name === "Bash" && !call) return;
    board = await openBoard();
    // past the fast exit: the hooks are loaded, which `swarm status` reports (D46)
    board.hookSeen();
    const out = kind === "pre" ? pre(board, input) : post(board, input);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
    // a failure inside the hook prints nothing and lets the call through
  } finally {
    try {
      board?.close();
    } catch {
      /* closing a broken store */
    }
    process.exitCode = 0;
  }
}

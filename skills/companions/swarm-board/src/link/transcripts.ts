// Finding and reading a member's transcript (swarm-relay#D8, #D10): the link finds, in its caller's
// session, the harness transcript whose Bash tool call ran the binding verb, then reads from it, a
// growing file at a time, what the board needs to tell the member's state. The token sum stays
// liveness.ts's adapter: one owner. Adding a harness is one entry in LOCATORS.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RunId } from "../board/board.ts";
import { claudeCodeJsonl } from "../board/liveness.ts";
import type { MemberActivity } from "../wire.ts";

/** The verb a member's CLI ran that the link stands for: a runner's or seat's `join`, an orchestrator's `open`. */
export type Binding = { verb: "join"; run: RunId; seat: string } | { verb: "open"; group: string };

/** Where a read of a transcript stopped, and what the lines before it said. */
export type TranscriptCursor = {
  offset: number;
  tokens: number;
  open: Map<string, { name: string; target: string; since: number; boardWait?: boolean }>;
  lastTool: string | null;
  context: number | null;
  grewAt: number | null;
};

export interface HarnessLocator {
  name: string;
  /** The transcript holding the tool call that ran this binding verb, newest first, a finished one skipped; null when not (yet) found. */
  locate(binding: Binding, env: NodeJS.ProcessEnv): string | null;
  /** The harness's own word that the agent ended; null when it keeps none. */
  finished(transcript: string): boolean | null;
}

const TARGET_CHARS = 50;
const SEPARATORS = new Set([";", "&&", "||", "|", "&", "\n"]);

/** A shell command split into words and separators, quotes removed; `;`, `&&`, `|` split even when glued to a word (§7 E8). */
function shellWords(command: string): string[] {
  const words: string[] = [];
  let word = "";
  let inWord = false;
  const flush = () => {
    if (inWord) words.push(word);
    word = "";
    inWord = false;
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (c === "'" || c === '"') {
      const close = command.indexOf(c, i + 1);
      const end = close < 0 ? command.length : close;
      word += command.slice(i + 1, end);
      inWord = true;
      i = end;
    } else if (c === "\\" && i + 1 < command.length && command[i + 1] !== "\n") {
      word += command[++i];
      inWord = true;
    } else if (c === ";" || c === "\n" || c === "|" || c === "&") {
      flush();
      const two = command.slice(i, i + 2);
      if (two === "&&" || two === "||") {
        words.push(two);
        i++;
      } else words.push(c);
    } else if (/\s/.test(c)) flush();
    else {
      word += c;
      inWord = true;
    }
  }
  flush();
  return words;
}

/** A word that invokes the swarm tool: `swarm`, `…/swarm.mjs`, or a variable holding it (`$S`). */
const isSwarmTool = (word: string): boolean => /(^|[\\/])swarm(\.mjs)?$/i.test(word) || /^\$\{?\w+\}?$/.test(word);

/** The value of `--name v` or `--name=v` among a command's words. */
function flagValue(words: string[], names: string[]): string | undefined {
  for (let i = 0; i < words.length; i++) {
    for (const n of names) {
      if (words[i] === n && i + 1 < words.length) return words[i + 1];
      if (words[i].startsWith(n + "=")) return words[i].slice(n.length + 1);
    }
  }
  return undefined;
}

/** Whether this command text runs the swarm tool's `wait` verb (swarm-relay D45). */
export function commandRunsWait(command: string): boolean {
  const words = shellWords(command);
  return words.some((w, i) => w === "wait" && i > 0 && isSwarmTool(words[i - 1]));
}

/** Whether this command text runs the binding verb, matched word by word, flags in any order. */
export function commandRunsBinding(command: string, binding: Binding): boolean {
  const words = shellWords(command);
  let start = 0;
  for (let i = 0; i <= words.length; i++) {
    if (i < words.length && !SEPARATORS.has(words[i])) continue;
    const segment = words.slice(start, i);
    start = i + 1;
    const at = segment.indexOf(binding.verb);
    if (at < 1 || !isSwarmTool(segment[at - 1])) continue;
    const args = segment.slice(at + 1);
    if (binding.verb === "join") {
      if (flagValue(args, ["--run"]) === String(binding.run) && flagValue(args, ["--seat", "--slice"]) === binding.seat) return true;
    } else if (flagValue(args, ["--group", "--plan"]) === binding.group) return true;
  }
  return false;
}

/** Whether a transcript holds a Bash tool_use whose command runs the binding verb. */
function transcriptRunsBinding(file: string, binding: Binding): boolean {
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return false; // unreadable: skipped
  }
  // The cheap test before any parsing: the verb and its distinguishing value appear somewhere.
  const value = binding.verb === "join" ? binding.seat : binding.group;
  if (!text.includes(binding.verb) || !text.includes(value) || !text.includes('"tool_use"')) return false;
  for (const line of text.split("\n")) {
    if (!line.includes('"tool_use"') || !line.includes(binding.verb)) continue;
    let obj: { type?: string; message?: { content?: unknown } };
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj.type !== "assistant" || !Array.isArray(obj.message?.content)) continue;
    for (const part of obj.message.content as { type?: string; name?: string; input?: { command?: unknown } }[]) {
      if (part?.type === "tool_use" && part.name === "Bash" && typeof part.input?.command === "string" && commandRunsBinding(part.input.command, binding)) return true;
    }
  }
  return false;
}

/** The metadata file the harness keeps beside a transcript. */
const metaFileOf = (transcript: string): string => transcript.replace(/\.jsonl$/, ".meta.json");

const mtimeOf = (file: string): number => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};

/** Claude Code: `<root>/<project>/<session>.jsonl` and `<root>/<project>/<session>/subagents/agent-*.jsonl`, each with its `.meta.json` beside. */
const claudeCode: HarnessLocator = {
  name: "claude-code",
  locate(binding, env) {
    const session = env.CLAUDE_CODE_SESSION_ID;
    if (!session) return null;
    const root = env.SWARM_TRANSCRIPTS_ROOT || path.join(env.USERPROFILE || env.HOME || os.homedir(), ".claude", "projects");
    let projects: string[];
    try {
      projects = fs.readdirSync(root);
    } catch {
      return null;
    }
    const candidates: string[] = [];
    for (const project of projects) {
      const main = path.join(root, project, `${session}.jsonl`);
      if (fs.existsSync(main)) candidates.push(main);
      const subagents = path.join(root, project, session, "subagents");
      let names: string[] = [];
      try {
        names = fs.readdirSync(subagents);
      } catch {
        // no subagents in this project's session
      }
      for (const n of names) if (/^agent-.*\.jsonl$/.test(n)) candidates.push(path.join(subagents, n));
    }
    const newestFirst = candidates.map((file) => ({ file, mtime: mtimeOf(file) })).sort((a, b) => b.mtime - a.mtime);
    for (const { file } of newestFirst) {
      if (this.finished(file) === true) continue;
      if (transcriptRunsBinding(file, binding)) return file;
    }
    return null;
  },
  finished(transcript) {
    let text: string;
    try {
      text = fs.readFileSync(metaFileOf(transcript), "utf8");
    } catch {
      return null; // no meta.json: the harness keeps no word on this one
    }
    try {
      return (JSON.parse(text) as { finished?: unknown }).finished === true;
    } catch {
      return false;
    }
  },
};

/** Every harness the link knows, tried in order. */
export const LOCATORS: HarnessLocator[] = [claudeCode];

/** The first harness's transcript of the call that ran this binding; null when none holds it (yet): the link retries each second. */
export function locate(binding: Binding, env: NodeJS.ProcessEnv): string | null {
  for (const l of LOCATORS) {
    const found = l.locate(binding, env);
    if (found) return found;
  }
  return null;
}

/** A tool call's target, as one short line: the command, the file, the pattern… */
function toolTarget(input: unknown): string {
  let text = "";
  if (input && typeof input === "object") {
    const fields = input as Record<string, unknown>;
    for (const k of ["command", "file_path", "path", "pattern", "url", "query", "description", "prompt"]) {
      if (typeof fields[k] === "string") {
        text = fields[k] as string;
        break;
      }
    }
    if (!text) text = JSON.stringify(input);
  } else if (input !== undefined) text = String(input);
  return text.replace(/\s+/g, " ").trim().slice(0, TARGET_CHARS);
}

const timeOf = (line: { timestamp?: unknown }, fallback: number): number => {
  const t = typeof line.timestamp === "string" ? Date.parse(line.timestamp) : NaN;
  return Number.isFinite(t) ? t : fallback;
};

const freshCursor = (): TranscriptCursor => ({ offset: 0, tokens: 0, open: new Map(), lastTool: null, context: null, grewAt: null });

/** Reads what was appended to the transcript since `from` (all of it when null); a vanished or truncated file starts over from 0. */
export function observe(transcript: string, from: TranscriptCursor | null): { activity: MemberActivity; cursor: TranscriptCursor } {
  let cursor: TranscriptCursor = from ? { ...from, open: new Map(from.open) } : freshCursor();
  let chunk = Buffer.alloc(0);
  let mtime = Date.now();
  try {
    const fd = fs.openSync(transcript, "r");
    try {
      const stat = fs.fstatSync(fd);
      mtime = stat.mtimeMs;
      if (stat.size < cursor.offset) cursor = freshCursor();
      chunk = Buffer.alloc(stat.size - cursor.offset);
      fs.readSync(fd, chunk, 0, chunk.length, cursor.offset);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    cursor = freshCursor();
  }
  const counted = claudeCodeJsonl.read(chunk, { offset: cursor.offset, tokens: cursor.tokens });
  const consumed = (counted?.offset ?? cursor.offset) - cursor.offset;
  if (consumed > 0) {
    for (const raw of chunk.subarray(0, consumed).toString("utf8").split("\n")) {
      if (!raw.trim()) continue;
      let line: { type?: string; timestamp?: unknown; message?: { content?: unknown; usage?: Record<string, unknown> } };
      try {
        line = JSON.parse(raw);
      } catch {
        continue;
      }
      const content = Array.isArray(line.message?.content) ? (line.message.content as { type?: string; id?: string; name?: string; input?: unknown; tool_use_id?: string }[]) : [];
      if (line.type === "assistant") {
        const usage = line.message?.usage;
        if (usage) {
          const n = (k: string) => (typeof usage[k] === "number" ? (usage[k] as number) : 0);
          cursor.context = n("input_tokens") + n("cache_creation_input_tokens") + n("cache_read_input_tokens");
        }
        for (const part of content) {
          if (part?.type !== "tool_use" || typeof part.id !== "string") continue;
          const name = part.name ?? "?";
          const target = toolTarget(part.input);
          const command = (part.input as { command?: unknown } | undefined)?.command;
          // D45: only a shell call running the board's `wait` verb is waiting; a browser's wait_for, a sleep, are work
          const boardWait = typeof command === "string" && commandRunsWait(command);
          cursor.open.set(part.id, { name, target, since: timeOf(line, mtime), ...(boardWait ? { boardWait } : {}) });
          cursor.lastTool = target ? `${name} ${target}` : name;
        }
      } else {
        for (const part of content) if (part?.type === "tool_result" && typeof part.tool_use_id === "string") cursor.open.delete(part.tool_use_id);
      }
    }
    cursor.offset += consumed;
    cursor.tokens = counted!.tokens;
    cursor.grewAt = mtime;
  }
  let openTool: MemberActivity["openTool"] = null;
  for (const t of cursor.open.values()) if (!openTool || t.since < openTool.since) openTool = t;
  let finished = false;
  for (const l of LOCATORS) {
    const said = l.finished(transcript);
    if (said !== null) {
      finished = said;
      break;
    }
  }
  return {
    activity: { grewAt: cursor.grewAt, tokens: cursor.tokens, context: cursor.context, openTool: openTool && { ...openTool }, lastTool: cursor.lastTool, finished },
    cursor,
  };
}

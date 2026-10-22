// Fixture sessions shaped like Claude Code's transcripts (the shape only, never real text): a
// projects root holding `<project>/<session>.jsonl` and `<project>/<session>/subagents/agent-*.jsonl`,
// each subagent with its `.meta.json` beside.
import fs from "node:fs";
import path from "node:path";

export type Usage = { input_tokens: number; output_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number };

let ids = 0;

/** An assistant line running one Bash command. */
export const bashCall = (command: string, at = "2026-10-22T10:00:00.000Z", id = `toolu_${++ids}`): object => ({
  type: "assistant",
  timestamp: at,
  message: { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] },
});

/** An assistant line calling any tool, with usage. */
export const toolCall = (name: string, input: object, id: string, at: string, usage?: Usage): object => ({
  type: "assistant",
  timestamp: at,
  message: { role: "assistant", content: [{ type: "tool_use", id, name, input }], ...(usage ? { usage } : {}) },
});

/** An assistant line of plain text, with usage. */
export const textLine = (text: string, usage?: Usage, at = "2026-10-22T10:00:00.000Z"): object => ({
  type: "assistant",
  timestamp: at,
  message: { role: "assistant", content: [{ type: "text", text }], ...(usage ? { usage } : {}) },
});

/** A user line carrying a tool's result. */
export const toolResult = (id: string, at = "2026-10-22T10:00:01.000Z"): object => ({
  type: "user",
  timestamp: at,
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: "ok" }] },
});

/** A user prompt (a brief) as text. */
export const prompt = (text: string): object => ({ type: "user", timestamp: "2026-10-22T09:59:00.000Z", message: { role: "user", content: text } });

export const jsonl = (lines: object[]): string => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";

/** Writes the main transcript of a session. */
export function writeMain(root: string, project: string, session: string, lines: object[]): string {
  const file = path.join(root, project, `${session}.jsonl`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, jsonl(lines));
  return file;
}

/** Writes a subagent transcript and, unless `meta` is null, its meta.json; `mtime` in seconds orders them. */
export function writeSubagent(root: string, project: string, session: string, agent: string, lines: object[], meta: object | null, mtime?: number): string {
  const dir = path.join(root, project, session, "subagents");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `agent-${agent}.jsonl`);
  fs.writeFileSync(file, jsonl(lines));
  if (meta) fs.writeFileSync(path.join(dir, `agent-${agent}.meta.json`), JSON.stringify({ agentType: "general-purpose", description: "fixture", toolUseId: "toolu_x", model: "m", ...meta }));
  if (mtime !== undefined) fs.utimesSync(file, mtime, mtime);
  return file;
}

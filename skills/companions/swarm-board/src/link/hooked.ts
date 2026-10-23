// The agents a link serves, for the delivery hook (swarm-relay D43): one small file per agent, named by its
// transcript's key (`<session id>` for a main session, `agent-<agent id>` for a subagent), so the hook, run at every
// tool call of every session, answers "not a member" with one missing-file check.
import fs from "node:fs";
import path from "node:path";

export type Hooked = { run: number; member: string; pid: number; link: string };

export const hookedDir = (dataRoot: string): string => path.join(dataRoot, "swarm-hooked");

/** The key of a transcript: its file name less `.jsonl`. */
export const transcriptKey = (transcript: string): string => path.basename(transcript).replace(/\.jsonl$/i, "");

/** The key of the agent a hook runs for: a subagent's `agent-<id>`, else the session's id. */
export const hookKey = (input: { session_id?: string; agent_id?: string }): string | null =>
  input.agent_id ? `agent-${input.agent_id}` : (input.session_id ?? null);

const fileOf = (dataRoot: string, key: string): string => path.join(hookedDir(dataRoot), `${key.replace(/[^\w.-]/g, "_")}.json`);

export function registerHooked(dataRoot: string, transcript: string, h: Hooked): void {
  try {
    fs.mkdirSync(hookedDir(dataRoot), { recursive: true });
    fs.writeFileSync(fileOf(dataRoot, transcriptKey(transcript)), JSON.stringify(h));
  } catch {}
}

/** Removed only by the link that wrote it: a newer link of the same agent keeps its own. */
export function unregisterHooked(dataRoot: string, transcript: string, pid: number): void {
  const f = fileOf(dataRoot, transcriptKey(transcript));
  try {
    if ((JSON.parse(fs.readFileSync(f, "utf8")) as Hooked).pid === pid) fs.rmSync(f, { force: true });
  } catch {}
}

export function readHooked(dataRoot: string, key: string): Hooked | null {
  try {
    return JSON.parse(fs.readFileSync(fileOf(dataRoot, key), "utf8")) as Hooked;
  } catch {
    return null;
  }
}

export function forgetHooked(dataRoot: string, key: string): void {
  try {
    fs.rmSync(fileOf(dataRoot, key), { force: true });
  } catch {}
}

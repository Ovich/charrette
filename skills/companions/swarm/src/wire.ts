// The frames between the board server, a member's link and a CLI (swarm-relay D4): one JSON
// text message per frame. A frame type added later is added here only.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Board } from "./board/board.ts";

/** The Board methods a verb calls over the wire: all but onChange, close, livenessTick, recordActivity,
 *  memberStates, upkeepIfDue, prune and flagStale, which only the server's own process runs. */
export const RPC_METHODS = [
  "openRun",
  "setSliceState",
  "addSlice",
  "closeRun",
  "phase",
  "currentPhase",
  "pause",
  "resume",
  "pausedOf",
  "done",
  "phaseProgress",
  "lastActivity",
  "owedPhase",
  "setting",
  "runs",
  "join",
  "participant",
  "identify",
  "setDoing",
  "subscribe",
  "unsubscribe",
  "end",
  "roster",
  "endedMembers",
  "heldBy",
  "post",
  "endorse",
  "read",
  "thread",
  "deliver",
  "wait",
  "checkEdit",
  "reconcileWrites",
  "release",
  "lockMerge",
  "merged",
  "heldMergeLock",
  "stats",
  "repos",
  "snapshot",
] as const satisfies readonly (keyof Board)[];
export type RpcMethod = (typeof RPC_METHODS)[number];

/** The Board methods kept off the wire; with RPC_METHODS, every method of Board (checked below). */
type ServerOnly = "onChange" | "close" | "livenessTick" | "recordActivity" | "memberStates" | "upkeepIfDue" | "prune" | "flagStale";
// a Board method added later must be put on one side or the other: this fails to compile until it is
type Unlisted = Exclude<keyof Board, RpcMethod | ServerOnly>;
const everyMethodPlaced: [Unlisted] extends [never] ? true : Unlisted = true;
void everyMethodPlaced;

export type MemberActivity = {
  /** last time the transcript grew */
  grewAt: number | null;
  /** the counter, as liveness.ts sums it: movement, never cost */
  tokens: number;
  /** the last call's input + cache tokens: how full the member is */
  context: number | null;
  /** a tool_use with no result yet */
  openTool: { name: string; target: string; since: number } | null;
  /** "<name> <target, 50 chars>" */
  lastTool: string | null;
  /** the harness says the agent ended (meta.json) */
  finished: boolean;
};

// up: a link (or a CLI with no member) to the server
export type Hello = { type: "hello"; version: string; secret: string; member?: { name: string; run: number }; supersede?: boolean };
export type Call = { type: "call"; id: string; method: RpcMethod; args: unknown[] };
/** a wait whose CLI went away */
export type Cancel = { type: "cancel"; id: string };
export type Activity = { type: "activity"; at: number; activity: MemberActivity };
export type Bye = { type: "bye"; reason: "ended" | "closed" | "finished" | "idle" };
// down: the server to a link or a CLI
export type Welcome = { type: "welcome"; version: string };
export type Result = { type: "result"; id: string; ok: true; value: unknown } | { type: "result"; id: string; ok: false; error: string };
export type Refused = { type: "refused"; reason: "secret" | "version" | "superseded" | "shutdown" | "closed" };
/** to a reader that called subscribe, after each commit */
export type Changed = { type: "changed"; repo: string };

export type Frame = Hello | Call | Cancel | Activity | Bye | Welcome | Result | Refused | Changed;

const FRAME_TYPES: ReadonlySet<string> = new Set<Frame["type"]>(["hello", "call", "cancel", "activity", "bye", "welcome", "result", "refused", "changed"]);

/** One JSON text. */
export function encode(f: Frame): string {
  return JSON.stringify(f);
}

/** Throws on text that is not JSON, or on a frame of an unknown type. */
export function decode(text: string): Frame {
  const f: unknown = JSON.parse(text);
  const type = f && typeof f === "object" ? (f as { type?: unknown }).type : undefined;
  if (typeof type !== "string" || !FRAME_TYPES.has(type)) throw new Error(`unknown frame type: ${String(type)}`);
  return f as Frame;
}

const versionsByEntry = new Map<string, string>();

/** D28: the hash of the running entry file, read once; a peer of another version is refused. */
export function bundleVersion(entry: string = process.argv[1] ?? ""): string {
  const file = path.resolve(entry);
  let v = versionsByEntry.get(file);
  if (v === undefined) {
    v = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 16);
    versionsByEntry.set(file, v);
  }
  return v;
}

/** What the running server writes for its clients: `<dataRoot>/swarm-server.json` (D7, D17). */
export type ServerState = { pid: number; port: number; secret: string; version: string };

export function serverStateFile(dataRoot: string): string {
  return path.join(dataRoot, "swarm-server.json");
}

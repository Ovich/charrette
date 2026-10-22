// The board as the CLI sees it (swarm-relay D5, D6, D19, D29, D30): every Board call a verb makes,
// awaited over a member's link or straight to the server, either started on demand.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import type { Board, RunId } from "../board/board.ts";
import { RPC_METHODS, bundleVersion, decode, encode, serverStateFile, type Frame, type RpcMethod, type ServerState } from "../wire.ts";
import { linkPipe } from "../link/link.ts";
import type { Binding } from "../link/transcripts.ts";

export type RemoteBoard = { [K in RpcMethod]: (...a: Parameters<Board[K]>) => Promise<Awaited<ReturnType<Board[K]>>> };
export type BoardMember = { name: string; run: RunId };

/** How long a server or a link started here has to answer (D19). */
const START_TIMEOUT_MS = 5000;
const START_POLL_MS = 50;

/** The entry this CLI runs from: what a server or a link is spawned as (D28); no node flag of the caller carried over. */
const entry = (): string[] => [process.argv[1]];

/** The environment a server or a link of `dataRoot` runs in: that data home, whatever the caller's. */
const homeEnv = (dataRoot: string): NodeJS.ProcessEnv => ({ ...process.env, CHARRETTE_HOME: dataRoot });

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM: it lives, owned by someone else
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readServerState(dataRoot: string): ServerState | null {
  try {
    const s = JSON.parse(fs.readFileSync(serverStateFile(dataRoot), "utf8")) as ServerState;
    return Number.isInteger(s.pid) && Number.isInteger(s.port) ? s : null;
  } catch {
    return null;
  }
}

/** A state naming a live process of this CLI's version. */
const isCurrent = (s: ServerState | null): boolean => !!s && s.version === bundleVersion() && isAlive(s.pid);

/** The server's own log, where `serve`'s errors land when the CLI started it. */
const serverLog = (dataRoot: string): string => path.join(dataRoot, "swarm-server.log");

/** The running server's state, started first when the state file names no live process or another
 *  version (D6, D28); a server that does not come up within 5 s fails with the D19 message. */
export async function ensureServer(dataRoot: string): Promise<ServerState> {
  const found = readServerState(dataRoot);
  if (found && isCurrent(found)) return found;
  // another version still running: stopped, then replaced (D28)
  if (found && found.pid !== process.pid && isAlive(found.pid)) {
    try {
      process.kill(found.pid);
    } catch {}
    for (const until = Date.now() + START_TIMEOUT_MS; isAlive(found.pid) && Date.now() < until; ) await pause(START_POLL_MS);
  }
  let log: number | "ignore" = "ignore";
  try {
    fs.mkdirSync(dataRoot, { recursive: true });
    fs.writeFileSync(serverLog(dataRoot), "");
    log = fs.openSync(serverLog(dataRoot), "a");
  } catch {}
  const child = spawn(process.execPath, [...entry(), "serve"], { detached: true, stdio: ["ignore", log, log], windowsHide: true, env: homeEnv(dataRoot) });
  let exited: string | null = null;
  child.on("exit", (code, signal) => (exited = signal ? `it was killed by ${signal}` : `it exited with code ${code}`));
  child.on("error", (e) => (exited = e.message));
  child.unref();
  if (typeof log === "number") fs.closeSync(log);
  for (const until = Date.now() + START_TIMEOUT_MS; Date.now() < until; ) {
    const s = readServerState(dataRoot);
    if (s && isCurrent(s)) return s;
    if (exited) break;
    await pause(START_POLL_MS);
  }
  let said = "";
  try {
    // the error a crash prints, else the server's last word
    const lines = fs.readFileSync(serverLog(dataRoot), "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    said = lines.find((l) => /^(\w*Error|swarm\b)[^:]*:/.test(l)) ?? lines.filter((l) => !/^Node\.js v/.test(l)).pop() ?? "";
  } catch {}
  const reason = said || exited || `it did not answer within ${START_TIMEOUT_MS / 1000} s`;
  throw new Error(`swarm: the board server did not start: ${reason}; run swarm serve to see it`);
}

/** The binding a member's link watches for (D29): the orchestrator's `open`, a member's `join`. */
export function bindingOf(member: BoardMember): Binding {
  const [group, id] = splitMember(member.name);
  return id === "orchestrator" ? { verb: "open", group } : { verb: "join", run: member.run, seat: id };
}

function splitMember(name: string): [string, string] {
  const at = name.lastIndexOf("/");
  return [name.slice(0, at), name.slice(at + 1)];
}

function connectPipe(pipe: string): Promise<net.Socket | null> {
  return new Promise((resolve) => {
    const s = net.createConnection(pipe);
    s.once("connect", () => {
      s.removeAllListeners("error");
      resolve(s);
    });
    s.once("error", () => resolve(null));
  });
}

/** Spawns the member's link when its pipe does not answer; a link that died comes back on the next verb (D6). */
export async function ensureLink(dataRoot: string, member: BoardMember, binding: Binding): Promise<void> {
  const s = await openLinkPipe(dataRoot, member, binding);
  s.destroy();
}

async function openLinkPipe(dataRoot: string, member: BoardMember, binding: Binding): Promise<net.Socket> {
  const pipe = linkPipe(dataRoot, member.run, member.name);
  const there = await connectPipe(pipe);
  if (there) return there;
  const child = spawn(process.execPath, [...entry(), "link", "--run", String(member.run), "--member", member.name, "--binding", JSON.stringify(binding)], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: homeEnv(dataRoot),
  });
  child.on("error", () => {});
  child.unref();
  for (const until = Date.now() + START_TIMEOUT_MS; Date.now() < until; ) {
    const s = await connectPipe(pipe);
    if (s) return s;
    await pause(START_POLL_MS);
  }
  throw new Error(`swarm: ${member.name}'s link did not start`);
}

/** One JSON frame per line, as the pipe carries them (D30). */
function lineFrames(sock: net.Socket, onFrame: (f: Frame) => void): void {
  let buf = "";
  sock.setEncoding("utf8");
  sock.on("data", (chunk: string) => {
    buf += chunk;
    for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onFrame(decode(line));
    }
  });
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

/** Calls by id over one channel; a closed channel fails every call still pending. */
function caller(send: (f: Frame) => void): { call: (method: RpcMethod, args: unknown[]) => Promise<unknown>; settle: (f: Frame) => void; fail: (why: string) => void } {
  const pending = new Map<string, Pending>();
  let next = 0;
  // the server answers a resent id from its cache (D4): ids unique across processes, a pid being reused
  const callPrefix = crypto.randomUUID();
  let closed: string | null = null;
  return {
    call(method, args) {
      if (closed) return Promise.reject(new Error(closed));
      const id = `${callPrefix}-${++next}`;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        send({ type: "call", id, method, args });
      });
    },
    settle(f) {
      if (f.type === "result") {
        const p = pending.get(f.id);
        if (!p) return;
        pending.delete(f.id);
        if (f.ok) p.resolve(f.value);
        else p.reject(new Error(f.error));
      } else if (f.type === "refused") this.fail(`swarm: the board refused the connection: ${f.reason}`);
    },
    fail(why) {
      closed ??= why;
      for (const p of pending.values()) p.reject(new Error(closed));
      pending.clear();
    },
  };
}

/** The anonymous connection to the server: a Hello with no member, then calls. */
async function connectServer(state: ServerState): Promise<{ send: (f: Frame) => void; onFrame: (h: (f: Frame) => void) => void; onClose: (h: () => void) => void; close: () => void }> {
  const ws = new WebSocket(`ws://127.0.0.1:${state.port}`);
  let handler: (f: Frame) => void = () => {};
  let closer: () => void = () => {};
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => ws.send(encode({ type: "hello", version: state.version, secret: state.secret })), { once: true });
    ws.addEventListener("message", (ev) => {
      const f = decode(String(ev.data));
      if (f.type === "welcome") resolve();
      else if (f.type === "refused") reject(new Error(`swarm: the board server refused the connection: ${f.reason}`));
      else handler(f);
    });
    ws.addEventListener("error", () => reject(new Error(`swarm: the board server at port ${state.port} does not answer; run swarm serve to see it`)), { once: true });
    ws.addEventListener("close", () => closer());
  });
  return {
    send: (f) => ws.send(encode(f)),
    onFrame: (h) => (handler = h),
    onClose: (h) => (closer = h),
    close: () => ws.close(),
  };
}

function asRemote(call: (method: RpcMethod, args: unknown[]) => Promise<unknown>): RemoteBoard {
  const board = {} as Record<RpcMethod, (...a: unknown[]) => Promise<unknown>>;
  for (const m of RPC_METHODS) board[m] = (...a: unknown[]) => call(m, a);
  return board as unknown as RemoteBoard;
}

/** The board for a verb: through `member`'s link when given (started when its pipe does not answer),
 *  else straight to the server; the server started first when none of this version runs (D6, D29). */
export async function connectBoard(opts: { dataRoot: string; member?: BoardMember }): Promise<RemoteBoard & { close(): void }> {
  const state = await ensureServer(opts.dataRoot);
  if (opts.member) {
    const sock = await openLinkPipe(opts.dataRoot, opts.member, bindingOf(opts.member));
    const calls = caller((f) => sock.write(`${encode(f)}\n`));
    lineFrames(sock, (f) => calls.settle(f));
    sock.on("close", () => calls.fail(`swarm: ${opts.member!.name}'s link closed the pipe`));
    sock.on("error", () => {});
    return Object.assign(asRemote(calls.call), { close: () => sock.destroy() });
  }
  const conn = await connectServer(state);
  const calls = caller(conn.send);
  conn.onFrame((f) => calls.settle(f));
  conn.onClose(() => calls.fail("swarm: the board server closed the connection"));
  return Object.assign(asRemote(calls.call), { close: conn.close });
}

// A member's link (swarm-relay D1): the pipe its member's CLI calls come in on, one WebSocket to the
// board server, every Call forwarded and its Result sent back to the pipe that asked. It keeps no
// file (D15): a restart re-locates the server and re-reads.
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { bundleVersion, decode, encode, serverStateFile, type Call, type Frame, type ServerState } from "../wire.ts";

import type { Binding } from "./transcripts.ts";

type RunId = number;

/** What started the link, kept for phase 2's transcript search (declared by transcripts.ts). */
export type { Binding };

/** The link's clocks; tests shorten them. */
export type LinkTiming = {
  /** after a drop, how long the link tries to reach a server before it exits (D27) */
  reconnectGiveUpMs: number;
  /** between two reconnect attempts */
  reconnectEveryMs: number;
  /** no call on any pipe for this long, none pending: the link exits (D15) */
  idleMs: number;
  /** at start, how long to wait for the server's state file */
  stateFileWaitMs: number;
};

const DEFAULT_TIMING: LinkTiming = { reconnectGiveUpMs: 60_000, reconnectEveryMs: 500, idleMs: 2 * 60 * 60_000, stateFileWaitMs: 5_000 };

/** D7: keyed by the data home. `\\.\pipe\swarm-<hash>-<run>-<member>` on Windows, a socket file in
 *  the OS temp folder elsewhere. Built in code: a pipe path passed through Git Bash loses its
 *  backslashes. */
export function linkPipe(dataRoot: string, run: RunId, member: string): string {
  const home = crypto.createHash("sha256").update(path.resolve(dataRoot)).digest("hex").slice(0, 12);
  const name = `swarm-${home}-${run}-${member.replace(/[^A-Za-z0-9_-]/g, "_")}`;
  return process.platform === "win32" ? `\\\\.\\pipe\\${name}` : path.join(os.tmpdir(), `${name}.sock`);
}

function readServerState(dataRoot: string): ServerState | null {
  try {
    return JSON.parse(fs.readFileSync(serverStateFile(dataRoot), "utf8")) as ServerState;
  } catch {
    return null;
  }
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Listens on the member's pipe; null when another link of the same member already holds it. */
async function listenOnPipe(pipe: string, onPipe: (s: net.Socket) => void): Promise<net.Server | null> {
  const tryListen = () =>
    new Promise<net.Server | "taken">((resolve, reject) => {
      const server = net.createServer(onPipe);
      server.once("error", (e: NodeJS.ErrnoException) => (e.code === "EADDRINUSE" ? resolve("taken") : reject(e)));
      server.listen(pipe, () => resolve(server));
    });
  const first = await tryListen();
  if (first !== "taken") return first;
  if (process.platform === "win32") return null;
  // a socket file left by a link that died: taken only if someone answers on it
  const alive = await new Promise<boolean>((resolve) => {
    const probe = net.connect(pipe, () => (probe.destroy(), resolve(true)));
    probe.once("error", () => resolve(false));
  });
  if (alive) return null;
  fs.rmSync(pipe, { force: true });
  const second = await tryListen();
  return second === "taken" ? null : second;
}

/** Runs one member's link until it exits: its member's `end`, a `refused`, no server for a minute
 *  after a drop, or idle. Rejects only when no server state file appears at start. */
export async function runLink(opts: {
  dataRoot: string;
  member: string;
  run: RunId;
  session: string | null;
  transcript?: string;
  binding: Binding;
  timing?: Partial<LinkTiming>;
}): Promise<void> {
  const timing = { ...DEFAULT_TIMING, ...opts.timing };

  let state = readServerState(opts.dataRoot);
  for (const startedAt = Date.now(); !state && Date.now() - startedAt < timing.stateFileWaitMs; ) {
    await pause(100);
    state = readServerState(opts.dataRoot);
  }
  if (!state) throw new Error(`no board server state file in ${opts.dataRoot}`);

  /** Calls sent and not yet answered, by id, with the pipe that asked. */
  const unanswered = new Map<string, { call: Call; pipe: net.Socket }>();
  const pipes = new Set<net.Socket>();
  let socket: WebSocket | null = null;
  let welcomed = false;
  let exiting = false;
  let lastCallAt = Date.now();
  let finish!: () => void;
  const finished = new Promise<void>((r) => (finish = r));

  const sendUp = (f: Frame) => {
    if (socket && welcomed && socket.readyState === WebSocket.OPEN) socket.send(encode(f));
  };

  const exit = (bye?: "ended" | "idle") => {
    if (exiting) return;
    exiting = true;
    if (bye) sendUp({ type: "bye", reason: bye });
    clearInterval(idleCheck);
    pipeServer?.close();
    for (const p of pipes) p.end(); // a result just written still reaches its CLI
    socket?.close();
    finish();
  };

  const onDown = (f: Frame) => {
    if (f.type === "welcome") {
      welcomed = true;
      for (const { call } of unanswered.values()) sendUp(call); // D4: resent, answered from the cache
    } else if (f.type === "refused") {
      exit();
    } else if (f.type === "result") {
      const asked = unanswered.get(f.id);
      if (!asked) return; // already answered, or its pipe closed: never delivered twice
      unanswered.delete(f.id);
      if (!asked.pipe.destroyed) asked.pipe.write(encode(f) + "\n");
      if (asked.call.method === "end" && f.ok) exit("ended");
    }
  };

  /** One connection; resolves when it closes, true when the server welcomed it. */
  const connectOnce = (s: ServerState) =>
    new Promise<boolean>((resolve) => {
      welcomed = false;
      let wasWelcomed = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(`ws://127.0.0.1:${s.port}`);
      } catch {
        return resolve(false);
      }
      socket = ws;
      ws.onopen = () =>
        ws.send(encode({ type: "hello", version: bundleVersion(), secret: s.secret, member: { name: opts.member, run: opts.run }, supersede: true }));
      ws.onmessage = (ev) => {
        try {
          onDown(decode(String(ev.data)));
        } catch {
          /* a frame this link does not read */
        }
        wasWelcomed ||= welcomed;
      };
      ws.onclose = () => {
        welcomed = false;
        resolve(wasWelcomed);
      };
      ws.onerror = () => {};
    });

  /** Connects, and after each drop reconnects (re-reading the state file: a restarted server has a
   *  new port and secret); D27: no server answers for a minute after a drop, the link exits. */
  const connectionLoop = async () => {
    let lastAnsweredAt = Date.now();
    let s: ServerState | null = state;
    while (!exiting) {
      if (s) {
        const welcomedThisTime = await connectOnce(s);
        if (exiting) return;
        if (welcomedThisTime) lastAnsweredAt = Date.now();
      }
      if (Date.now() - lastAnsweredAt >= timing.reconnectGiveUpMs) return exit();
      await pause(timing.reconnectEveryMs);
      s = readServerState(opts.dataRoot);
    }
  };

  const onPipe = (pipe: net.Socket) => {
    pipes.add(pipe);
    let buffered = "";
    pipe.setEncoding("utf8");
    pipe.on("data", (chunk: string) => {
      buffered += chunk;
      for (let nl = buffered.indexOf("\n"); nl >= 0; nl = buffered.indexOf("\n")) {
        const line = buffered.slice(0, nl).trim();
        buffered = buffered.slice(nl + 1);
        if (!line) continue;
        let f: Frame;
        try {
          f = decode(line);
        } catch {
          continue;
        }
        if (f.type === "call") {
          lastCallAt = Date.now();
          unanswered.set(f.id, { call: f, pipe });
          sendUp(f);
        } else if (f.type === "cancel") {
          unanswered.delete(f.id);
          sendUp(f);
        }
      }
    });
    pipe.on("error", () => {});
    pipe.on("close", () => {
      pipes.delete(pipe);
      // D16, D30: the CLI went away; its pending wait is cancelled at the server at once
      for (const [id, asked] of unanswered) {
        if (asked.pipe !== pipe) continue;
        unanswered.delete(id);
        if (asked.call.method === "wait") sendUp({ type: "cancel", id });
      }
    });
  };

  const pipeServer = await listenOnPipe(linkPipe(opts.dataRoot, opts.run, opts.member), onPipe);
  if (!pipeServer) return; // one link per member per data home: this one is the second

  const idleCheck = setInterval(() => {
    if (unanswered.size === 0 && Date.now() - lastCallAt >= timing.idleMs) exit("idle");
  }, Math.min(60_000, Math.max(10, Math.floor(timing.idleMs / 4))));

  if (state.version !== bundleVersion()) return exit(); // D28: a server of another version would refuse it
  void connectionLoop();
  return finished;
}

// The board server at its wire (swarm-relay S11): a test client (Node's WebSocket) against
// startBoardServer on a temporary data home.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openBoard } from "../src/board/board.ts";
import { startBoardServer, stopBoardServer } from "../src/server/server.ts";
import { decode, encode, serverStateFile, type Frame, type Hello, type RpcMethod, type ServerState } from "../src/wire.ts";

const REPO = "/repos/one/.git";
const SEATS = [
  { id: "S1", title: "one", blockers: [] },
  { id: "S2", title: "two", blockers: [] },
];

let dir: string;
let server: { url: string; close(): Promise<void> } | null;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-server-"));
  server = await startBoardServer({ dataRoot: dir });
});

afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await server?.close();
  server = null;
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const state = (): ServerState => JSON.parse(fs.readFileSync(serverStateFile(dir), "utf8")) as ServerState;

/** A connected test client: every frame it receives, in order, awaited one by one. */
type Client = { send(f: Frame): void; next(): Promise<Frame>; closed: Promise<void>; socket: WebSocket };
const connect = async (): Promise<Client> => {
  const socket = new WebSocket(server!.url);
  sockets.push(socket);
  const queue: Frame[] = [];
  const waiting: ((f: Frame) => void)[] = [];
  socket.addEventListener("message", (e) => {
    const f = decode(String(e.data));
    const w = waiting.shift();
    if (w) w(f);
    else queue.push(f);
  });
  const closed = new Promise<void>((r) => socket.addEventListener("close", () => r()));
  await new Promise<void>((r, j) => {
    socket.addEventListener("open", () => r());
    socket.addEventListener("error", () => j(new Error("no connection")));
  });
  return {
    socket,
    closed,
    send: (f) => socket.send(encode(f)),
    next: () => (queue.length ? Promise.resolve(queue.shift()!) : new Promise((r) => waiting.push(r))),
  };
};
const hello = async (over: Partial<Hello> = {}): Promise<{ c: Client; reply: Frame }> => {
  const c = await connect();
  c.send({ type: "hello", version: state().version, secret: state().secret, ...over });
  return { c, reply: await c.next() };
};
const welcomed = async (over: Partial<Hello> = {}): Promise<Client> => {
  const { c, reply } = await hello(over);
  assert.equal(reply.type, "welcome");
  return c;
};
let ids = 0;
const call = async (c: Client, method: string, ...args: unknown[]): Promise<Frame> => {
  const id = `c${++ids}`;
  c.send({ type: "call", id, method: method as RpcMethod, args });
  const f = await c.next();
  assert.equal(f.type === "result" && f.id, id);
  return f;
};
const value = async (c: Client, method: string, ...args: unknown[]): Promise<any> => {
  const f = await call(c, method, ...args);
  assert.ok(f.type === "result" && f.ok, JSON.stringify(f));
  return f.type === "result" && f.ok ? f.value : undefined;
};

test("a hello with the secret and this version is welcomed; a wrong secret or version refused", async () => {
  const c = await welcomed();
  c.socket.close();
  assert.deepEqual((await hello({ secret: "nope" })).reply, { type: "refused", reason: "secret" });
  assert.deepEqual((await hello({ version: "other" })).reply, { type: "refused", reason: "version" });
});

test("a second hello for the same member with supersede refuses the older connection", async () => {
  const member = { name: "p/S1", run: 1 };
  const old = await welcomed({ member });
  await welcomed({ member, supersede: true });
  assert.deepEqual(await old.next(), { type: "refused", reason: "superseded" });
});

test("every method answers over the wire what the Board answers in process; an unknown one names itself", async () => {
  const c = await welcomed();
  const run = await value(c, "openRun", { repo: REPO, group: "g", title: "T", seats: SEATS });
  const s1 = (await value(c, "join", { run: run.id, slice: "S1", doing: "x", files: [] })).runner;
  const s2 = (await value(c, "join", { run: run.id, slice: "S2", doing: "y", files: [] })).runner;
  await value(c, "post", s1, "hello @S2");
  // the same store opened in process reads what the wire answered
  const local = await openBoard(path.join(dir, "swarm.sqlite"));
  try {
    const same: [string, unknown[]][] = [
      ["runs", []],
      ["roster", [REPO]],
      ["participant", [s1.name]],
      ["heldBy", [s1]],
      ["read", [1]],
      ["thread", [s1]],
      ["currentPhase", [run.id]],
      ["pausedOf", [run.id]],
      ["phaseProgress", [run.id]],
      ["lastActivity", [run.id]],
      ["owedPhase", [s2]],
      ["setting", ["retention-days"]],
      ["endedMembers", [REPO]],
      ["heldMergeLock", [s1]],
      ["repos", []],
      ["snapshot", [REPO]],
      ["stats", [{ repo: REPO }]],
    ];
    for (const [m, args] of same) {
      const wire = await value(c, m, ...args);
      const here = JSON.parse(JSON.stringify((local as any)[m](...args) ?? null));
      // a read counts a call: compared on the fields a call does not move
      if (m === "snapshot" || m === "roster" || m === "stats" || m === "runs" || m === "repos" || m === "lastActivity") assert.equal(typeof wire, typeof here, m);
      else assert.deepEqual(wire, here, m);
    }
  } finally {
    local.close();
  }
  // writes answer as in process
  assert.equal((await value(c, "deliver", s2)).full.length, 1);
  assert.equal(typeof (await value(c, "checkEdit", s1, "a.ts")).allowed, "boolean");
  const unknown = await call(c, "flagStale");
  assert.deepEqual(unknown.type === "result" && !unknown.ok && unknown.error, "unknown method flagStale");
  const thrown = await call(c, "read", 99999);
  assert.ok(thrown.type === "result" && !thrown.ok && /unknown message/.test(thrown.error));
});

test("a resent call is answered from the cache: one post in the store, not two", async () => {
  const c = await welcomed();
  const run = await value(c, "openRun", { repo: REPO, group: "g", title: "T", seats: SEATS });
  const s1 = (await value(c, "join", { run: run.id, slice: "S1", doing: "x", files: [] })).runner;
  const frame: Frame = { type: "call", id: "post-once", method: "post", args: [s1, "only once"] };
  c.send(frame);
  const first = await c.next();
  // reconnected, the same call resent
  const again = await welcomed();
  again.send(frame);
  assert.deepEqual(await again.next(), first);
  const local = await openBoard(path.join(dir, "swarm.sqlite"));
  try {
    const all = local.snapshot(REPO).events.filter((e) => e.body === "only once");
    assert.equal(all.length, 1);
  } finally {
    local.close();
  }
});

test("a wait returns within 200 ms of a post on another connection; a cancelled wait clears waiting", async () => {
  const a = await welcomed();
  const run = await value(a, "openRun", { repo: REPO, group: "g", title: "T", seats: SEATS });
  const s1 = (await value(a, "join", { run: run.id, slice: "S1", doing: "x", files: [] })).runner;
  const s2 = (await value(a, "join", { run: run.id, slice: "S2", doing: "y", files: [] })).runner;
  await value(a, "deliver", s1);
  await value(a, "deliver", s2);
  const b = await welcomed({ member: { name: s2.name, run: run.id } });
  b.send({ type: "call", id: "w7", method: "wait", args: [s2, { mentionsOnly: true }] });
  await new Promise((r) => setTimeout(r, 100));
  const t0 = Date.now();
  await value(a, "post", s1, "@S2 wake");
  const woke = await b.next();
  assert.ok(Date.now() - t0 < 200, `woke after ${Date.now() - t0} ms`);
  assert.ok(woke.type === "result" && woke.id === "w7" && woke.ok && (woke.value as { full: unknown[] }).full.length === 1);

  b.send({ type: "call", id: "w8", method: "wait", args: [s2, {}] });
  await new Promise((r) => setTimeout(r, 100));
  const local = await openBoard(path.join(dir, "swarm.sqlite"));
  try {
    const waiting = (): boolean => local.snapshot(REPO).roster.find((r) => r.runner === s2.name)!.state === "waiting";
    assert.equal(waiting(), true);
    b.send({ type: "cancel", id: "w8" });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(waiting(), false);
  } finally {
    local.close();
  }
});

test("closeRun over the wire refuses every member connection of that run", async () => {
  const a = await welcomed();
  const run = await value(a, "openRun", { repo: REPO, group: "g", title: "T", seats: SEATS });
  const s1 = (await value(a, "join", { run: run.id, slice: "S1", doing: "x", files: [] })).runner;
  const link = await welcomed({ member: { name: s1.name, run: run.id } });
  await value(a, "closeRun", run.id);
  assert.deepEqual(await link.next(), { type: "refused", reason: "closed" });
});

test("serve stop refuses every connection with shutdown and removes the state file", async () => {
  const c = await welcomed();
  assert.equal(await stopBoardServer(dir), true);
  assert.deepEqual(await c.next(), { type: "refused", reason: "shutdown" });
  assert.equal(fs.existsSync(serverStateFile(dir)), false);
  assert.equal(await stopBoardServer(dir), false);
  server = null;
});

test("the built bundle, alone in an empty folder, runs serve, answers a client and stops on serve stop", { timeout: 60000 }, async () => {
  await server!.close();
  server = null;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const out = path.join(dir, "alone", "cli.mjs");
  // the package's own build, written elsewhere: what ships, with nothing beside it
  const built = spawn(process.execPath, [path.join(here, "..", "build.mjs"), "--outfile", out], { cwd: path.join(here, ".."), stdio: "ignore" });
  assert.equal(await new Promise((r) => built.on("exit", r)), 0);
  const home = path.join(dir, "home");
  const env = { ...process.env, CHARRETTE_HOME: home };
  const serve = spawn(process.execPath, [out, "serve"], { cwd: path.dirname(out), env, stdio: ["ignore", "pipe", "pipe"] });
  const exited = new Promise<number | null>((r) => serve.on("exit", (code) => r(code)));
  const url = await new Promise<string>((r, j) => {
    let text = "";
    serve.stdout.on("data", (d) => {
      text += String(d);
      const m = /ws:\/\/\S+/.exec(text);
      if (m) r(m[0]);
    });
    serve.on("exit", () => j(new Error(`serve exited early`)));
  });
  const st = JSON.parse(fs.readFileSync(serverStateFile(home), "utf8")) as ServerState;
  const socket = new WebSocket(url);
  sockets.push(socket);
  const frames: Frame[] = [];
  const got = (n: number): Promise<void> =>
    new Promise((r) => {
      const look = (): void => (frames.length >= n ? r() : void setTimeout(look, 20));
      look();
    });
  socket.addEventListener("message", (e) => frames.push(decode(String(e.data))));
  await new Promise((r) => socket.addEventListener("open", r));
  socket.send(encode({ type: "hello", version: st.version, secret: st.secret }));
  await got(1);
  assert.equal(frames[0].type, "welcome");
  socket.send(encode({ type: "call", id: "r1", method: "runs", args: [] }));
  await got(2);
  assert.deepEqual(frames[1], { type: "result", id: "r1", ok: true, value: [] });
  const stop = spawn(process.execPath, [out, "serve", "stop"], { cwd: path.dirname(out), env, stdio: "ignore" });
  assert.equal(await new Promise((r) => stop.on("exit", r)), 0);
  assert.equal(await exited, 0);
  await got(3);
  assert.deepEqual(frames[2], { type: "refused", reason: "shutdown" });
  assert.equal(fs.existsSync(serverStateFile(home)), false);
});

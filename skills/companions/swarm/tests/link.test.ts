// A member's link, at its pipe (swarm-relay D4, D7, D15, D16, D27, D30), against a stub board
// server written here: it speaks the plan's §3 frames over a bare WebSocket, so the test owns
// every answer, every drop and every refusal.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { linkPipe, runLink, type LinkTiming } from "../src/link/link.ts";
import { bundleVersion, decode, encode, serverStateFile, type Call, type Frame } from "../src/wire.ts";

const MEMBER = "plan-x/S1";
const RUN = 68;
const FAST: Partial<LinkTiming> = { reconnectEveryMs: 50, reconnectGiveUpMs: 60_000, idleMs: 60 * 60_000, stateFileWaitMs: 500 };

/** A connection the stub accepted: the frames it got, and how to answer or drop it. */
type StubConnection = { frames: Frame[]; send(f: Frame): void; drop(): void };

/** A minimal WebSocket server: text frames, close, ping; enough for the link's client. */
async function stubServer(onFrame: (f: Frame, conn: StubConnection) => void = defaultAnswers) {
  const connections: StubConnection[] = [];
  const sockets = new Set<net.Socket>();
  const server = http.createServer();
  server.on("upgrade", (req, socket: net.Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    const accept = crypto.createHash("sha1").update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const sendRaw = (opcode: number, payload: Buffer) => {
      const len = payload.length;
      const head = len < 126 ? Buffer.from([0x80 | opcode, len]) : len < 65536 ? Buffer.from([0x80 | opcode, 126, len >> 8, len & 255]) : null;
      if (!head) throw new Error("frame too long for the stub");
      if (!socket.destroyed) socket.write(Buffer.concat([head, payload]));
    };
    const conn: StubConnection = { frames: [], send: (f) => sendRaw(1, Buffer.from(encode(f))), drop: () => socket.destroy() };
    connections.push(conn);
    let buf = Buffer.alloc(0);
    socket.on("data", (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 2) return;
        const opcode = buf[0] & 15;
        let len = buf[1] & 127;
        let at = 2;
        if (len === 126) (len = buf.readUInt16BE(2), (at = 4));
        else if (len === 127) (len = Number(buf.readBigUInt64BE(2)), (at = 10));
        if (buf.length < at + 4 + len) return;
        const mask = buf.subarray(at, at + 4);
        const payload = Buffer.from(buf.subarray(at + 4, at + 4 + len)).map((b, i) => b ^ mask[i % 4]);
        buf = buf.subarray(at + 4 + len);
        if (opcode === 8) return void (sendRaw(8, Buffer.alloc(0)), socket.end());
        if (opcode === 9) sendRaw(10, Buffer.from(payload));
        if (opcode !== 1) continue;
        const f = decode(Buffer.from(payload).toString("utf8"));
        conn.frames.push(f);
        onFrame(f, conn);
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as net.AddressInfo).port;
  return {
    port,
    connections,
    /** every frame of every connection, in order */
    frames: () => connections.flatMap((c) => c.frames),
    /** stops listening and cuts every connection: the server is gone */
    stop: () => new Promise<void>((r) => (server.close(() => r()), sockets.forEach((s) => s.destroy()))),
  };
}

/** Welcomes a hello; answers every call but a wait at once, with its method as the value. */
function defaultAnswers(f: Frame, conn: StubConnection) {
  if (f.type === "hello") conn.send({ type: "welcome", version: f.version });
  if (f.type === "call" && f.method !== "wait") conn.send({ type: "result", id: f.id, ok: true, value: f.method });
}

const homes: string[] = [];
const servers: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await s.stop();
  for (const h of homes.splice(0)) fs.rmSync(h, { recursive: true, force: true });
});

function dataHome(port?: number): string {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-link-"));
  homes.push(home);
  if (port !== undefined) writeState(home, port);
  return home;
}
function writeState(home: string, port: number) {
  fs.writeFileSync(serverStateFile(home), JSON.stringify({ pid: process.pid, port, secret: "s3cret", version: bundleVersion() }));
}

function startLink(home: string, timing: Partial<LinkTiming> = FAST, member = MEMBER) {
  let exited = false;
  const done = runLink({ dataRoot: home, member, run: RUN, session: null, binding: { verb: "join", run: RUN, seat: "S1" }, timing }).then(() => {
    exited = true;
  });
  return { done, exited: () => exited };
}

/** A CLI's end of the pipe: lines it writes, results it reads. */
async function openPipe(home: string, member = MEMBER) {
  const pipePath = linkPipe(home, RUN, member);
  let socket: net.Socket | null = null;
  for (let i = 0; i < 100 && !socket; i++) {
    socket = await new Promise<net.Socket | null>((r) => {
      const s = net.connect(pipePath, () => r(s));
      s.once("error", () => r(null));
    });
    if (!socket) await pause(20);
  }
  assert.ok(socket, "the link's pipe never listened");
  const received: Frame[] = [];
  let buffered = "";
  socket.setEncoding("utf8");
  socket.on("data", (c: string) => {
    buffered += c;
    for (let nl = buffered.indexOf("\n"); nl >= 0; nl = buffered.indexOf("\n")) {
      received.push(decode(buffered.slice(0, nl)));
      buffered = buffered.slice(nl + 1);
    }
  });
  return { received, call: (c: Omit<Call, "type">) => socket!.write(encode({ type: "call", ...c }) + "\n"), close: () => socket!.destroy() };
}

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function until(what: string, ok: () => boolean, ms = 3000) {
  for (const start = Date.now(); !ok(); await pause(10)) if (Date.now() - start > ms) assert.fail(`timed out: ${what}`);
}
const callsOf = (frames: Frame[], id: string) => frames.filter((f) => f.type === "call" && f.id === id);
const exitLink = async (server: { connections: StubConnection[] }, link: { done: Promise<void> }) => {
  server.connections.at(-1)!.send({ type: "refused", reason: "shutdown" });
  await link.done;
};

test("a call through the pipe reaches the server once and its result comes back; two pipes are not crossed", async () => {
  const server = await stubServer();
  servers.push(server);
  const home = dataHome(server.port);
  const link = startLink(home);
  const a = await openPipe(home);
  const b = await openPipe(home);
  a.call({ id: "a1", method: "roster", args: [] });
  b.call({ id: "b1", method: "post", args: ["hi"] });
  a.call({ id: "a2", method: "deliver", args: [] });
  await until("three results", () => a.received.length === 2 && b.received.length === 1);
  assert.deepEqual(a.received.map((f) => f.type === "result" && f.id), ["a1", "a2"]);
  assert.deepEqual(b.received, [{ type: "result", id: "b1", ok: true, value: "post" }]);
  for (const id of ["a1", "a2", "b1"]) assert.equal(callsOf(server.frames(), id).length, 1);
  await exitLink(server, link);
});

test("a wait pending on a pipe that closes is cancelled at the server (D16, D30)", async () => {
  const server = await stubServer();
  servers.push(server);
  const home = dataHome(server.port);
  const link = startLink(home);
  const cli = await openPipe(home);
  cli.call({ id: "w7", method: "wait", args: [] });
  await until("the wait reached the server", () => callsOf(server.frames(), "w7").length === 1);
  cli.close();
  await until("the cancel", () => server.frames().some((f) => f.type === "cancel" && f.id === "w7"));
  await exitLink(server, link);
});

for (const reason of ["secret", "version", "superseded", "shutdown", "closed"] as const) {
  test(`hello names the member with supersede; refused ${reason} makes the link exit (D15, D27, D30)`, async () => {
    const server = await stubServer((f, conn) => f.type === "hello" && conn.send({ type: "refused", reason }));
    servers.push(server);
    const link = startLink(dataHome(server.port));
    await link.done;
    const hello = server.frames()[0];
    assert.equal(hello.type, "hello");
    assert.deepEqual(hello.type === "hello" && [hello.member, hello.supersede, hello.secret], [{ name: MEMBER, run: RUN }, true, "s3cret"]);
  });
}

test("the server dropped and back: unanswered calls are resent, none answered twice to a pipe", async () => {
  let answering = false;
  const server = await stubServer((f, conn) => {
    if (f.type === "hello") conn.send({ type: "welcome", version: f.version });
    if (f.type === "call" && answering) {
      // the server answers from its cache, and once more for good measure: the pipe sees it once
      conn.send({ type: "result", id: f.id, ok: true, value: f.method });
      conn.send({ type: "result", id: f.id, ok: true, value: f.method });
    }
  });
  servers.push(server);
  const home = dataHome(server.port);
  const link = startLink(home);
  const cli = await openPipe(home);
  cli.call({ id: "w7", method: "wait", args: [] });
  cli.call({ id: "p3", method: "post", args: ["x"] });
  await until("both calls up", () => server.frames().filter((f) => f.type === "call").length === 2);
  answering = true;
  server.connections[0].drop();
  await until("a second connection resent both", () => server.connections.length === 2 && server.connections[1].frames.filter((f) => f.type === "call").length === 2);
  await until("both answers", () => cli.received.length === 2);
  await pause(100);
  assert.deepEqual(cli.received.map((f) => f.type === "result" && f.id).sort(), ["p3", "w7"]);
  await exitLink(server, link);
});

test("no server answers for the give-up time after a drop: the link exits (D27)", async () => {
  const server = await stubServer();
  const home = dataHome(server.port);
  const link = startLink(home, { ...FAST, reconnectGiveUpMs: 300 });
  await openPipe(home);
  await until("connected", () => server.connections.length === 1);
  await server.stop();
  await link.done;
});

test("the member's end relayed: the link sends bye ended and exits (D15)", async () => {
  const server = await stubServer();
  servers.push(server);
  const home = dataHome(server.port);
  const link = startLink(home);
  const cli = await openPipe(home);
  cli.call({ id: "e1", method: "end", args: [] });
  await link.done;
  await until("the end's result", () => cli.received.length === 1);
  assert.deepEqual(cli.received, [{ type: "result", id: "e1", ok: true, value: "end" }]);
  await until("bye ended", () => server.frames().some((f) => f.type === "bye" && f.reason === "ended"));
});

test("no call on any pipe for the idle time: the link exits (D15)", async () => {
  const server = await stubServer();
  servers.push(server);
  const home = dataHome(server.port);
  const link = startLink(home, { ...FAST, idleMs: 300 });
  const cli = await openPipe(home);
  cli.call({ id: "r1", method: "roster", args: [] });
  await pause(150);
  assert.equal(link.exited(), false);
  await link.done;
  await until("bye idle", () => server.frames().some((f) => f.type === "bye" && f.reason === "idle"));
});

test("pipe names differ by data home; a second link of the same member exits at once (D7)", async () => {
  assert.notEqual(linkPipe("/home/one", RUN, MEMBER), linkPipe("/home/two", RUN, MEMBER));
  assert.equal(linkPipe("/home/one", RUN, MEMBER), linkPipe("/home/one", RUN, MEMBER));
  const server = await stubServer();
  servers.push(server);
  const home = dataHome(server.port);
  const first = startLink(home);
  await openPipe(home);
  await until("connected", () => server.connections.length === 1);
  await startLink(home).done;
  assert.equal(first.exited(), false);
  await exitLink(server, first);
});

test("no server state file: the link gives up after its wait, naming the data home", async () => {
  const home = dataHome();
  await assert.rejects(startLink(home, { ...FAST, stateFileWaitMs: 200 }).done, (e: Error) => e.message.includes(home));
});

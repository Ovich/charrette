import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSseHub, type SseHub } from "../src/server/sse.ts";
import { servedBuild } from "../src/server/index.ts";

/** A hub on its own server, with a heartbeat fast enough for a test. */
const serve = async (heartbeatMs: number, hello?: () => Record<string, unknown>): Promise<{ hub: SseHub; base: string; stop: () => Promise<void> }> => {
  const hub = createSseHub(heartbeatMs, hello);
  const server = http.createServer((_req, res) => hub.add(res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    hub,
    base,
    stop: async () => {
      hub.close();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
};

/** Read frames off the stream until `want` of them have arrived. */
const frames = async (res: Response, want: number): Promise<string[]> => {
  const reader = res.body!.getReader();
  const out: string[] = [];
  let buf = "";
  while (out.length < want) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += new TextDecoder().decode(value);
    for (const f of buf.split("\n\n")) if (f.startsWith("data: ")) out.push(f.slice(6));
    buf = buf.endsWith("\n\n") ? "" : (buf.split("\n\n").pop() ?? "");
  }
  await reader.cancel();
  return out;
};

test("a client is greeted, then pinged: the stream is never silent", async () => {
  const { base, stop } = await serve(25);
  const res = await fetch(`${base}/events`);
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  const got = await frames(res, 3);
  assert.deepEqual(JSON.parse(got[0]!), { type: "hello" });
  // What the tab's watchdog hears: a `ping` on `onmessage`, not a comment frame it
  // would never see.
  assert.deepEqual(JSON.parse(got[1]!), { type: "ping" });
  assert.deepEqual(JSON.parse(got[2]!), { type: "ping" });
  await stop();
});

test("a client whose socket broke without a FIN is pruned by the heartbeat", async () => {
  const { hub, base, stop } = await serve(25);
  const port = Number(new URL(base).port);
  // A raw socket: it asks for the stream, then dies without closing the response, the
  // way a sleeping machine or an embedded browser leaves one behind.
  const sock = net.connect(port, "127.0.0.1");
  await new Promise<void>((r) => sock.on("connect", () => r()));
  sock.write("GET /events HTTP/1.1\r\nHost: x\r\n\r\n");
  await new Promise<void>((r) => sock.once("data", () => r()));
  assert.equal(hub.size(), 1);
  sock.destroy();
  await new Promise((r) => setTimeout(r, 200));
  assert.equal(hub.size(), 0, "the dead client is gone, so the server is not writing into a black hole");
  await stop();
});

test("close() stops the heartbeat and lets go of every client", async () => {
  const { hub, base, stop } = await serve(25);
  const res = await fetch(`${base}/events`);
  await frames(res, 1);
  assert.equal(hub.size(), 1);
  hub.close();
  assert.equal(hub.size(), 0);
  await stop();
});

test("the hello names the build dist/ serves, read at each connection: a tab of another build reloads", async () => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-build-"));
  try {
    assert.equal(servedBuild(dist), null);
    fs.writeFileSync(path.join(dist, "index.html"), '<script type="module" crossorigin src="/assets/index-Bgbrqk2o.js"></script>');
    assert.equal(servedBuild(dist), "index-Bgbrqk2o.js");
    const { base, stop } = await serve(60_000, () => ({ build: servedBuild(dist) }));
    try {
      assert.deepEqual(JSON.parse((await frames(await fetch(`${base}/events`), 1))[0]!), { type: "hello", build: "index-Bgbrqk2o.js" });
      // rebuilt while the server runs: the next connection hears the new one
      fs.writeFileSync(path.join(dist, "index.html"), '<script type="module" src="/assets/index-NEW.js"></script>');
      assert.deepEqual(JSON.parse((await frames(await fetch(`${base}/events`), 1))[0]!), { type: "hello", build: "index-NEW.js" });
    } finally {
      await stop();
    }
  } finally {
    fs.rmSync(dist, { recursive: true, force: true });
  }
});

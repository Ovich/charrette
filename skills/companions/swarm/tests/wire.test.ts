// The frames (swarm-relay D4, D28): one JSON text each; an unknown type refused on decode.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RPC_METHODS, bundleVersion, decode, encode, serverStateFile, type Frame } from "../src/wire.ts";

test("a frame round-trips through encode and decode", () => {
  const frames: Frame[] = [
    { type: "hello", version: "v", secret: "s", member: { name: "p/S1", run: 3 }, supersede: true },
    { type: "call", id: "c1", method: "post", args: [{ name: "p/S1" }, "hi"] },
    { type: "result", id: "c1", ok: false, error: "no" },
    { type: "refused", reason: "shutdown" },
  ];
  for (const f of frames) assert.deepEqual(decode(encode(f)), f);
});

test("decode throws on an unknown type and on text that is not JSON", () => {
  assert.throws(() => decode(JSON.stringify({ type: "shout" })), /unknown frame type: shout/);
  assert.throws(() => decode(JSON.stringify([1])), /unknown frame type/);
  assert.throws(() => decode("{"));
});

test("the methods kept off the wire are not callable", () => {
  for (const m of ["onChange", "close", "livenessTick", "upkeepIfDue", "prune", "flagStale"]) assert.ok(!(RPC_METHODS as readonly string[]).includes(m), m);
});

test("bundleVersion hashes the entry file; another content, another version", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-wire-"));
  try {
    const a = path.join(dir, "a.mjs");
    const b = path.join(dir, "b.mjs");
    fs.writeFileSync(a, "one");
    fs.writeFileSync(b, "two");
    assert.equal(bundleVersion(a), bundleVersion(a));
    assert.notEqual(bundleVersion(a), bundleVersion(b));
    assert.equal(serverStateFile(dir), path.join(dir, "swarm-server.json"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The page's server over a Board on a temporary data home, on port 0, claiming no pid file.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { openBoard, type Board, type BoardSnapshot, type RepoSummary } from "../src/board/board.ts";
import { startServer } from "../src/server/index.ts";

const REPO = "/repos/one/.git";
const SLICES = [
  { id: "S3", title: "the page", blockers: [] },
  { id: "S5", title: "the skill", blockers: ["S3"] },
];

let dir: string;
let board: Board;
let writer: Board; // a second Board on the same file: another process's writes
let server: http.Server;
let base: string;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-server-"));
  board = await openBoard(path.join(dir, "swarm.sqlite"));
  writer = await openBoard(path.join(dir, "swarm.sqlite"));
  server = startServer(board, { port: 0, open: false, toolRoot: dir, writeState: false, heartbeatMs: 200 });
  await new Promise<void>((r) => server.on("listening", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  board.close();
  writer.close();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

/** Reads the SSE stream until `until` holds over the events seen, or the time runs out. */
function listen(until: (events: { type: string; repo?: string }[]) => boolean, ms: number): Promise<{ type: string; repo?: string }[]> {
  return new Promise((resolve, reject) => {
    const events: { type: string; repo?: string }[] = [];
    const req = http.get(`${base}/events`, (res) => {
      let buf = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        buf += chunk;
        let i: number;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (frame.startsWith("data: ")) events.push(JSON.parse(frame.slice(6)));
        }
        if (until(events)) {
          clearTimeout(timer);
          req.destroy();
          resolve(events);
        }
      });
    });
    req.on("error", () => {});
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error(`timed out; saw ${JSON.stringify(events)}`));
    }, ms);
  });
}

test("GET /api/repos is empty, then lists a repository once a run opens", async () => {
  assert.deepEqual(await (await fetch(`${base}/api/repos`)).json(), []);
  writer.openRun({ repo: REPO, plan: "review-tool", title: "Review tool", slices: SLICES });
  const repos = (await (await fetch(`${base}/api/repos`)).json()) as RepoSummary[];
  assert.equal(repos.length, 1);
  assert.equal(repos[0].repo, REPO);
  assert.equal(repos[0].name, "one");
  assert.deepEqual(repos[0].runs.map((r) => [r.plan, r.code, r.open]), [["review-tool", "RT", true]]);
});

test("GET /api/board returns the snapshot; an unknown repository is a 404 naming it", async () => {
  const r = await fetch(`${base}/api/board?repo=${encodeURIComponent(REPO)}`);
  assert.equal(r.status, 200);
  const snap = (await r.json()) as BoardSnapshot;
  assert.equal(snap.repo, REPO);
  assert.deepEqual(Object.keys(snap.queues), ["review-tool"]);
  assert.ok(snap.roster.some((p) => p.runner === "review-tool/orchestrator"));

  const missing = await fetch(`${base}/api/board?repo=${encodeURIComponent("/repos/none/.git")}`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "no repository /repos/none/.git" });
});

test("GET /api/run returns the run's repository snapshot; an unknown run is a 404", async () => {
  const run = writer.runs()[0];
  const r = await fetch(`${base}/api/run?id=${run.id}`);
  assert.equal(r.status, 200);
  const body = (await r.json()) as { run: number; snapshot: BoardSnapshot };
  assert.equal(body.run, run.id);
  assert.equal(body.snapshot.repo, REPO);
  assert.ok(body.snapshot.runs.some((x) => x.run === run.id));
  const missing = await fetch(`${base}/api/run?id=999`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: "no run 999" });
});

test("/events sends hello, pings, and changed with the repository within a second of a post", async () => {
  const run = writer.runs()[0];
  const s3 = writer.join({ run: run.id, slice: "S3", doing: "page", files: [] }).runner;
  // let that join's change go by before listening
  await new Promise((r) => setTimeout(r, 300));
  let posted = 0;
  const seen = listen((ev) => ev.some((e) => e.type === "changed") && ev.some((e) => e.type === "ping"), 5000);
  setTimeout(() => {
    posted = Date.now();
    writer.post(s3, "@S5 from another Board");
  }, 300);
  const events = await seen;
  const latency = Date.now() - posted;
  assert.equal(events[0].type, "hello");
  assert.deepEqual(events.find((e) => e.type === "changed"), { type: "changed", repo: REPO });
  assert.ok(latency < 1000, `changed after ${latency} ms`);
});

test("no route accepts a write method", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    for (const route of ["/api/repos", `/api/board?repo=${encodeURIComponent(REPO)}`, "/events", "/"]) {
      const r = await fetch(`${base}${route}`, { method, body: method === "DELETE" ? undefined : "{}" });
      assert.equal(r.status, 405, `${method} ${route}`);
    }
  }
});

test("the page is served from dist/, its own routes fall back to index.html", async () => {
  assert.equal((await fetch(`${base}/`)).status, 404, "not built yet: says so");
  fs.mkdirSync(path.join(dir, "dist", "assets"), { recursive: true });
  fs.writeFileSync(path.join(dir, "dist", "index.html"), "<!doctype html><title>swarm</title>");
  fs.writeFileSync(path.join(dir, "dist", "assets", "a.js"), "export {};");
  const js = await fetch(`${base}/assets/a.js`);
  assert.match(js.headers.get("content-type") ?? "", /javascript/);
  assert.match(await (await fetch(`${base}/some/route`)).text(), /<title>swarm<\/title>/);
});

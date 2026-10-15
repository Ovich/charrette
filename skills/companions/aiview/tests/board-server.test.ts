// aiview's server answering swarm's board (SL2): the board routes through HTTP on a test
// server, port 0, no pid files, over a store in a temp data home. The board is written as
// swarm's own process writes it, through openBoard on the same file. Ported from swarm's
// page-server tests (the /api/board and /events cases); the static page is aiview's own.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { openIndex, type Index } from "../src/core/db.ts";
import { startServer } from "../src/server/index.ts";
import { openBoard, type Board, type BoardSnapshot } from "../../swarm/src/board/board.ts";

const REPO = "/repos/one/.git";
const OTHER = "/repos/two/.git";
const SLICES = [
  { id: "S3", title: "the page", blockers: [] },
  { id: "S5", title: "the skill", blockers: ["S3"] },
];
type BoardBody = { repos: { repo: string }[]; snapshot: BoardSnapshot };
type Event = { type: string; repo?: string; id?: number };

let tmp: string;
let index: Index;
let writer: Board; // swarm's own process, writing the board aiview reads
let server: http.Server;
let base: string;
let docId: number;
let docPath: string;

const listening = (s: http.Server): Promise<string> =>
  new Promise((r) => s.on("listening", () => r(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)));
const closing = async (s: http.Server): Promise<void> => {
  s.closeAllConnections();
  await new Promise<void>((r) => s.close(() => r()));
};

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-board-server-"));
  const root = path.join(tmp, "repo");
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  index = openIndex(path.join(tmp, "aiview.sqlite"), root);
  docPath = path.join(root, "docs", "x.brainstorm.md");
  fs.mkdirSync(path.dirname(docPath), { recursive: true });
  fs.writeFileSync(docPath, "# Board X\n");
  docId = index.register(docPath).id;

  const dbPath = path.join(tmp, "swarm.sqlite");
  writer = await openBoard(dbPath);
  writer.openRun({ repo: REPO, group: "review-tool", title: "Review tool", seats: SLICES });
  server = startServer(index, { port: 0, open: false, startDoc: null, toolRoot: tmp, writeState: false, heartbeatMs: 200, boardDbPath: dbPath });
  base = await listening(server);
});

after(async () => {
  await closing(server);
  writer.close();
  await new Promise((r) => setTimeout(r, 250)); // a watcher debounce in flight lands on an open index
  index.close();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

/** Reads the SSE stream until `until` holds over the events seen, or the time runs out. */
function listen(until: (events: Event[]) => boolean, ms: number): Promise<Event[]> {
  return new Promise((resolve, reject) => {
    const events: Event[] = [];
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

test("answers the most recent repository", async () => {
  const only = (await (await fetch(`${base}/api/board`)).json()) as BoardBody;
  assert.equal(only.snapshot.repo, REPO);
  writer.openRun({ repo: OTHER, group: "other", title: "Other", seats: [] });
  const r = await fetch(`${base}/api/board`);
  assert.equal(r.status, 200);
  const latest = (await r.json()) as BoardBody;
  assert.equal(latest.snapshot.repo, OTHER);
  assert.deepEqual(latest.repos.map((x) => x.repo), [OTHER, REPO]);
  assert.deepEqual(latest.snapshot, writer.snapshot(OTHER));
  const byKey = (await (await fetch(`${base}/api/board?repo=${encodeURIComponent(REPO)}`)).json()) as BoardBody;
  assert.equal(byKey.snapshot.repo, REPO);
});

test("answers a run's repository", async () => {
  const run = writer.runs().find((x) => x.repo === REPO)!;
  const byRun = (await (await fetch(`${base}/api/board?run=${run.id}`)).json()) as BoardBody;
  assert.equal(byRun.snapshot.repo, REPO);
  assert.ok(byRun.repos.some((x) => x.repo === OTHER));
  // /api/run?id= is kept as an alias of ?run=
  const alias = await fetch(`${base}/api/run?id=${run.id}`);
  assert.equal(alias.status, 200);
  assert.deepEqual(await alias.json(), byRun);
});

test("404 for an unknown run", async () => {
  for (const route of ["/api/board?run=999", "/api/run?id=999"]) {
    const r = await fetch(`${base}${route}`);
    assert.equal(r.status, 404, route);
    assert.deepEqual(await r.json(), { error: "no run 999" });
  }
});

test("404 for an unknown repository", async () => {
  const r = await fetch(`${base}/api/board?repo=${encodeURIComponent("/nowhere/.git")}`);
  assert.equal(r.status, 404);
  assert.deepEqual(await r.json(), { error: "no repository /nowhere/.git" });
});

test("404 no run yet without a store, and the server stays up", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-board-empty-"));
  const dbPath = path.join(home, "swarm.sqlite");
  const bare = startServer(index, { port: 0, open: false, startDoc: null, toolRoot: home, writeState: false, boardDbPath: dbPath });
  const at = await listening(bare);
  try {
    const r = await fetch(`${at}/api/board`);
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), { error: "no run on the board yet" });
    assert.equal(fs.existsSync(dbPath), false, "asking created no store");
    assert.equal((await fetch(`${at}/api/documents`)).status, 200, "the server is still up");
    // a store that appears after start is opened on the next request
    const late = await openBoard(dbPath);
    try {
      late.openRun({ repo: REPO, group: "late", title: "Late", seats: [] });
      const body = (await (await fetch(`${at}/api/board`)).json()) as BoardBody;
      assert.equal(body.snapshot.repo, REPO);
    } finally {
      late.close();
    }
  } finally {
    await closing(bare);
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test("a post is heard as board-changed", async () => {
  const run = writer.runs().find((x) => x.repo === REPO)!;
  const s3 = writer.join({ run: run.id, slice: "S3", doing: "page", files: [] }).runner;
  await new Promise((r) => setTimeout(r, 300)); // let that join's change go by before listening
  let posted = 0;
  const seen = listen((ev) => ev.some((e) => e.type === "board-changed") && ev.some((e) => e.type === "ping"), 5000);
  setTimeout(() => {
    posted = Date.now();
    writer.post(s3, "@S5 from swarm's process");
  }, 300);
  const events = await seen;
  const latency = Date.now() - posted;
  assert.equal(events[0].type, "hello");
  assert.deepEqual(events.find((e) => e.type === "board-changed"), { type: "board-changed", repo: REPO });
  assert.ok(!events.some((e) => e.type === "changed"), "a board write is never a document's changed");
  assert.ok(latency < 1000, `board-changed after ${latency} ms`);
});

test("document events unchanged", async () => {
  await fetch(`${base}/api/document/${docId}`); // the server watches a document once it is read
  const seen = listen((ev) => ev.some((e) => e.type === "changed"), 5000);
  setTimeout(() => fs.writeFileSync(docPath, "# Board X\n\nedited\n"), 300);
  const events = await seen;
  assert.deepEqual(events.find((e) => e.type === "changed"), { type: "changed", id: docId });
  assert.ok(!events.some((e) => e.type === "board-changed"), "a document edit is never board-changed");
});

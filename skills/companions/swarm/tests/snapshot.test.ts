import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openBoard, type Board } from "../src/board/board.ts";
import { openBoardReader, type BoardReader } from "../src/board/snapshot.ts";

const REPO = "/repos/one/.git";
const SLICES = [
  { id: "S1", title: "the board", blockers: [] },
  { id: "S3", title: "the page", blockers: ["S1"] },
];

let dir: string;
let board: Board;
let reader: BoardReader;
let readerOpen: boolean;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "swarm-reader-"));
  const db = path.join(dir, "swarm.sqlite");
  board = await openBoard(db);
  reader = await openBoardReader(db);
  readerOpen = true;
});

afterEach(() => {
  if (readerOpen) reader.close();
  board.close();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const aRunWithARunner = () => {
  const run = board.openRun({ repo: REPO, group: "review-tool", title: "Review tool", seats: SLICES });
  const s1 = board.join({ run: run.id, slice: "S1", doing: "the schema", files: [] }).runner;
  return { run, s1 };
};

// Resolves with the first repository heard, or null when nothing is heard within ms.
const firstHeard = (reader: BoardReader, ms: number): Promise<string | null> =>
  new Promise((resolve) => {
    const stop = reader.onChange((repo) => (clearTimeout(timer), stop(), resolve(repo)));
    const timer = setTimeout(() => (stop(), resolve(null)), ms);
  });

test("repos lists a repository with a run", () => {
  const { run } = aRunWithARunner();
  const repos = reader.repos();
  assert.deepEqual(repos, board.repos());
  assert.equal(repos.length, 1);
  assert.equal(repos[0].repo, REPO);
  assert.deepEqual(repos[0].runs.map((r) => r.run), [run.id]);
});

test("snapshot equals the board's snapshot", () => {
  const { s1 } = aRunWithARunner();
  board.post(s1, "@orchestrator the schema is in", { about: "src/schema.ts" });
  assert.deepEqual(reader.snapshot(REPO), board.snapshot(REPO));
  assert.throws(() => reader.snapshot("/repos/none/.git"), /no repository \/repos\/none\/\.git/);
});

test("onChange hears a post", async () => {
  const { s1 } = aRunWithARunner();
  const listening = firstHeard(reader, 2000);
  board.post(s1, "progress: half way");
  assert.equal(await listening, REPO);
});

test("close releases the watch", async () => {
  const { s1 } = aRunWithARunner();
  const repos: string[] = [];
  reader.onChange((repo) => repos.push(repo));
  reader.close();
  readerOpen = false;
  board.post(s1, "after the reader closed");
  await new Promise((r) => setTimeout(r, 1000));
  assert.deepEqual(repos, []);
  assert.throws(() => reader.repos()); // the store is released
});

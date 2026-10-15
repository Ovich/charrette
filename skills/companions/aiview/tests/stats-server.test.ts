// aiview's GET /api/stats against `swarm stats --json` (US3, D34, D40, D41, SL4): one store in a temp
// data home, seeded once through swarm's board, read by the route on a test server and by the swarm
// CLI spawned on the same store from a real repository. Closed runs only: an open run is computed to now.
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { openIndex, type Index } from "../src/core/db.ts";
import { startServer } from "../src/server/index.ts";
// The board is written here as swarm's own process would write it: seeding only.
import { openBoard } from "../../swarm/src/board/board.ts";

const SWARM_CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "swarm", "src", "cli", "index.ts");
const DAY_MS = 24 * 60 * 60 * 1000;

let home: string;
let repoDir: string;
let repo: string; // the repository's identity, as swarm resolves it from the repository's folder
let index: Index;
let server: http.Server;
let base: string;
const runs: { plan20: number; plan3: number; idea10: number } = { plan20: 0, plan3: 0, idea10: 0 };

const listening = (s: http.Server): Promise<string> =>
  new Promise((r) => s.on("listening", () => r(`http://127.0.0.1:${(s.address() as AddressInfo).port}`)));

const swarmStats = (...argv: string[]): string => {
  const r = spawnSync(process.execPath, [SWARM_CLI, "stats", ...argv, "--json"], {
    cwd: repoDir,
    encoding: "utf8",
    env: { ...process.env, SWARM_ROOT: home, CHARRETTE_HOME: home },
  });
  assert.equal(r.status, 0, `stats ${argv.join(" ")}: ${r.stderr}`);
  return r.stdout.trimEnd();
};
const route = async (query: string): Promise<string> => {
  const r = await fetch(`${base}/api/stats?repo=${encodeURIComponent(repo)}&${query}`);
  assert.equal(r.status, 200, `${query}: ${r.status}`);
  return r.text();
};

before(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-stats-server-"));
  repoDir = path.join(home, "repo");
  fs.mkdirSync(repoDir);
  const init = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: repoDir, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  repo = fs.realpathSync.native(path.join(repoDir, ".git"));

  // the board's clock moved back, so runs close 20, 10 and 3 days ago; the records begin before them
  const now = Date.now();
  mock.timers.enable({ apis: ["Date"], now: now - 40 * DAY_MS });
  const at = (daysAgo: number): void => mock.timers.setTime(now - daysAgo * DAY_MS);
  const board = await openBoard(path.join(home, "swarm.sqlite"));
  try {
    const seats = [
      { id: "S1", title: "the schema", blockers: [] },
      { id: "S2", title: "the page", blockers: [] },
    ];
    const planRun = (title: string, opened: number, closed: number): number => {
      at(opened);
      const run = board.openRun({ repo, group: title.toLowerCase().replace(/ /g, "-"), title, seats });
      const s1 = board.join({ run: run.id, slice: "S1", doing: "the schema", files: [{ path: "src/a.ts", interface: true }] }).runner;
      const s2 = board.join({ run: run.id, slice: "S2", doing: "the page", files: [] }).runner;
      board.deliver(s1);
      board.deliver(s2);
      board.checkEdit(s2, "src/a.ts");
      board.post(s2, `@${s1.name} I add a helper at the end of src/a.ts`, { about: "src/a.ts" });
      board.checkEdit(s2, "src/a.ts");
      board.post(s1, `@${s2.name} S2 adds the helper, S1 the rest`, { about: "src/a.ts", kind: "agreement" });
      at(opened - 0.5);
      board.lockMerge(s1, "main");
      board.merged(s1, "abc123", ["src/a.ts"], { files: [] });
      board.end(s1);
      board.end(s2);
      at(closed);
      board.closeRun(run.id);
      return run.id;
    };
    runs.plan20 = planRun("Old plan", 21, 20);
    runs.plan3 = planRun("New plan", 4, 3);

    at(11);
    const idea = board.openRun({
      repo,
      kind: "brainstorm",
      group: "idea",
      title: "An idea",
      seats: [
        { id: "skeptic", title: "the skeptic", role: "skeptic", blockers: [] },
        { id: "builder", title: "the builder", role: "builder", blockers: [] },
      ],
    });
    const skeptic = board.join({ run: idea.id, slice: "skeptic", doing: "doubting", files: [] }).runner;
    const builder = board.join({ run: idea.id, slice: "builder", doing: "building", files: [] }).runner;
    board.post(builder, "a cache in front, see src/a.ts:12", { about: "D1" });
    board.post(skeptic, "how stale can it get?", { about: "D1" });
    const agreed = board.post(builder, "a cache with a one-minute TTL", { about: "D1", kind: "agreement" });
    board.endorse(skeptic, agreed.seq);
    board.end(skeptic);
    board.end(builder);
    at(10);
    board.closeRun(idea.id);
    runs.idea10 = idea.id;
  } finally {
    board.close();
    mock.timers.reset();
  }

  index = openIndex(path.join(home, "aiview.sqlite"), repoDir);
  server = startServer(index, { port: 0, open: false, startDoc: null, toolRoot: home, writeState: false, boardDbPath: path.join(home, "swarm.sqlite") });
  base = await listening(server);
});

after(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  index.close();
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the body equals `swarm stats --json`, text for text, for since=30d&closedOnly=1, since=7d&closedOnly=1, since=all&closedOnly=1, kind=brainstorm&since=all&closedOnly=1, and for run=<id> against --run <id> (US3, D34, D40, D41, SL4)", async () => {
  const pairs: [string, string[]][] = [
    ["since=30d&closedOnly=1", ["--since", "30d", "--closed"]],
    ["since=7d&closedOnly=1", ["--since", "7d", "--closed"]],
    ["since=all&closedOnly=1", ["--all", "--closed"]],
    ["kind=brainstorm&since=all&closedOnly=1", ["--kind", "brainstorm", "--all", "--closed"]],
    [`run=${runs.plan20}`, ["--run", String(runs.plan20)]],
    [`run=${runs.idea10}`, ["--run", String(runs.idea10)]],
  ];
  for (const [query, flags] of pairs) assert.equal(await route(query), swarmStats(...flags), query);
  // the scopes are not all the same answer: the period and the kind narrow
  const runsOf = async (query: string): Promise<number[]> => (JSON.parse(await route(query)) as { runs: { run: number }[] }).runs.map((r) => r.run);
  assert.deepEqual(await runsOf("since=all&closedOnly=1"), [runs.plan20, runs.idea10, runs.plan3]);
  assert.deepEqual(await runsOf("since=7d&closedOnly=1"), [runs.plan3]);
  assert.deepEqual(await runsOf("kind=brainstorm&since=all&closedOnly=1"), [runs.idea10]);
});

test("an unknown repository or run answers 404 with its error, and the server stays up (SL4)", async () => {
  const unknownRepo = await fetch(`${base}/api/stats?repo=${encodeURIComponent("/nowhere/.git")}`);
  assert.equal(unknownRepo.status, 404);
  assert.deepEqual(await unknownRepo.json(), { error: "no repository /nowhere/.git" });
  for (const query of ["run=999", `repo=${encodeURIComponent(repo)}&run=999`]) {
    const unknownRun = await fetch(`${base}/api/stats?${query}`);
    assert.equal(unknownRun.status, 404, query);
    assert.deepEqual(await unknownRun.json(), { error: "no run 999" }, query);
  }
  assert.equal((await fetch(`${base}/api/stats?repo=${encodeURIComponent(repo)}&since=all`)).status, 200, "the server is still up");
});

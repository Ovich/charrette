// A run's length on the page and in `swarm stats`, one rule in both (D46, SL11): runs of lengths around a minute's edge
// seeded through swarm's board, the CLI's run lines read against the page's formatting of the same JSON.
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatDuration, runLength } from "../app/lib/board/analytics.ts";
// The board is written here as swarm's own process would write it: seeding only.
import { openBoard } from "../../swarm/src/board/board.ts";

const SWARM_CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "swarm", "src", "cli", "index.ts");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
/** The lengths seeded: under a minute, under ten minutes with seconds, past ten with seconds, past an hour. */
const LENGTHS = [40 * SECOND, 5 * MINUTE + 30 * SECOND, 14 * MINUTE + 47 * SECOND, 59 * MINUTE + 59 * SECOND, 2 * 60 * MINUTE + 5 * MINUTE + 10 * SECOND];

let home: string;
let repoDir: string;

const swarmStats = (...argv: string[]): string => {
  const r = spawnSync(process.execPath, [SWARM_CLI, "stats", "--all", ...argv], {
    cwd: repoDir,
    encoding: "utf8",
    env: { ...process.env, SWARM_ROOT: home, CHARRETTE_HOME: home },
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trimEnd();
};

before(async () => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-run-length-"));
  repoDir = path.join(home, "repo");
  fs.mkdirSync(repoDir);
  const init = spawnSync("git", ["init", "-q", "-b", "main"], { cwd: repoDir, encoding: "utf8" });
  assert.equal(init.status, 0, init.stderr);
  const repo = fs.realpathSync.native(path.join(repoDir, ".git"));
  const start = Date.now() - 2 * 24 * 60 * MINUTE;
  mock.timers.enable({ apis: ["Date"], now: start });
  const board = await openBoard(path.join(home, "swarm.sqlite"));
  try {
    LENGTHS.forEach((length, i) => {
      mock.timers.setTime(start + i * 3 * 60 * MINUTE);
      const run = board.openRun({ repo, group: `run-${i}`, title: `Run ${i}`, seats: [{ id: "S1", title: "the work", blockers: [] }] });
      mock.timers.setTime(start + i * 3 * 60 * MINUTE + length);
      board.closeRun(run.id);
    });
  } finally {
    board.close();
    mock.timers.reset();
  }
});

after(() => {
  fs.rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the page writes each run's length as the CLI's run line does, floored to the minute (D46, SL11)", () => {
  const runs = (JSON.parse(swarmStats("--json")) as { runs: { lengthMs: number }[] }).runs;
  assert.deepEqual(
    runs.map((r) => r.lengthMs),
    LENGTHS,
  );
  // `<code> <title> · <kind> · <length> · <open|closed> · conflicts <n>`, one line per run, oldest first
  const cliLengths = swarmStats()
    .split(/\r?\n/)
    .filter((l) => / · plan · /.test(l))
    .map((l) => l.split(" · ")[2]);
  assert.deepEqual(cliLengths, ["40s", "5m", "14m", "59m", "2h 05m"]);
  assert.deepEqual(
    runs.map((r) => runLength(r.lengthMs)),
    cliLengths,
  );
});

test("a duration elsewhere on the page floors, never rounds up: 14m 47s reads 14m, 59m 59s reads 59m (D46, SL11)", () => {
  assert.deepEqual(LENGTHS.map(formatDuration), ["40s", "5m 30s", "14m", "59m", "2h 05m"]);
});

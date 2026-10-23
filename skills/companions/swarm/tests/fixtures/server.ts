// The board server a test's spawned CLI started on its temporary data home, stopped when the test
// ends (swarm-relay D27): its links exit with it, and no node process of the suite is left behind.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAlive, serverLockHolder, serverStartLock } from "../../src/wire.ts";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli", "index.ts");
/** How long a server killed here has to be gone. */
const KILL_WAIT_MS = 5000;

/** `swarm serve stop` on `home`; nothing to stop is no error. A server still holding the start lock
 *  after it (one that had not yet written its state file, a test failing while it started) is killed:
 *  whatever the test did, no `serve` of it outlives it (D40). */
export function stopServerOf(home: string): void {
  spawnSync(process.execPath, [CLI, "serve", "stop"], { cwd: home, encoding: "utf8", env: { ...process.env, SWARM_ROOT: home, CHARRETTE_HOME: home, SWARM_NO_POLLER: "1" } });
  const holder = serverLockHolder(home);
  if (holder === null || holder === process.pid || !isAlive(holder)) return;
  try {
    process.kill(holder);
  } catch {}
  for (const until = Date.now() + KILL_WAIT_MS; isAlive(holder) && Date.now() < until; ) spawnSync(process.execPath, ["-e", "setTimeout(()=>{},50)"]);
  fs.rmSync(serverStartLock(home), { force: true });
}

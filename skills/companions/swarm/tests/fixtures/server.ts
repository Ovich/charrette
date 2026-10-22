// The board server a test's spawned CLI started on its temporary data home, stopped when the test
// ends (swarm-relay D27): its links exit with it, and no node process of the suite is left behind.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli", "index.ts");

/** `swarm serve stop` on `home`; nothing to stop is no error. */
export function stopServerOf(home: string): void {
  spawnSync(process.execPath, [CLI, "serve", "stop"], { cwd: home, encoding: "utf8", env: { ...process.env, SWARM_ROOT: home, CHARRETTE_HOME: home, SWARM_NO_POLLER: "1" } });
}

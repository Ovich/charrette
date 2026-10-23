// The swarm board a test seeds and aiview reads (swarm-relay D23): swarm's board server started in
// this process on a temporary data home, written through a client as a member's verbs would write
// it; never a second writable store. Importing this module makes the test process version as the
// swarm CLI does (D28), so the reader, a spawned `swarm` verb and this server speak to each other.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectBoard, type RemoteBoard } from "../../../swarm-board/src/client/remote.ts";
import { startBoardServer } from "../../../swarm-board/src/server/server.ts";

/** swarm's CLI entry: what a board server is started and versioned from in a test. */
export const SWARM_CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "swarm-board", "src", "cli", "index.ts");
process.argv[1] = SWARM_CLI;

export type TestBoard = { writer: RemoteBoard; close(): Promise<void> };

/** The board server of `dataRoot`, in this process, and a client writing to it. */
export async function startTestBoard(dataRoot: string): Promise<TestBoard> {
  const server = await startBoardServer({ dataRoot });
  const writer = await connectBoard({ dataRoot });
  return {
    writer,
    async close() {
      writer.close();
      await server.close();
    },
  };
}

/** `swarm serve stop` on `dataRoot`: a server a reader started there is stopped; none is no error. */
export function stopSpawnedBoard(dataRoot: string): void {
  spawnSync(process.execPath, [SWARM_CLI, "serve", "stop"], { cwd: dataRoot, encoding: "utf8", env: { ...process.env, SWARM_ROOT: dataRoot, SWARMSTORM_HOME: dataRoot } });
}

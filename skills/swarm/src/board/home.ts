// Where the board's store lives: the data home, beside aiview's index, never in a repository.
import os from "node:os";
import path from "node:path";

/** Data home: $CHARRETTE_HOME, else ~/charrette_appdata. */
export const DATA_ROOT = process.env.CHARRETTE_HOME
  ? path.resolve(process.env.CHARRETTE_HOME)
  : path.join(os.homedir(), "charrette_appdata");

export const SQLITE_PATH = path.join(DATA_ROOT, "swarm.sqlite");

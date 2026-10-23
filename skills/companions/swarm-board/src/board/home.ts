// Where the board's store lives: the data home, beside aiview's index, never in a repository.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Data home: $SWARMSTORM_HOME (or $CHARRETTE_HOME, its name before the rename), else ~/swarmstorm_appdata;
 *  an install from before the rename keeps ~/charrette_appdata while no ~/swarmstorm_appdata exists, so nothing moves. */
const homeFromEnv = process.env.SWARMSTORM_HOME ?? process.env.CHARRETTE_HOME;
const NEW_HOME = path.join(os.homedir(), "swarmstorm_appdata");
const OLD_HOME = path.join(os.homedir(), "charrette_appdata");
export const DATA_ROOT = homeFromEnv ? path.resolve(homeFromEnv) : !fs.existsSync(NEW_HOME) && fs.existsSync(OLD_HOME) ? OLD_HOME : NEW_HOME;

export const SQLITE_PATH = path.join(DATA_ROOT, "swarm.sqlite");

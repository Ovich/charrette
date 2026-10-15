// The old git, at the process boundary (plan D41): a `--require` preload for the spawned CLI that
// answers `git version` as 2.30, older than merge-tree --write-tree (2.38), and passes every other
// git call through to the real git. git is outside our code, so it is stood in for, never spied on.
const childProcess = require("node:child_process");
const { syncBuiltinESMExports } = require("node:module");

const realSpawnSync = childProcess.spawnSync;
const OLD_VERSION = "git version 2.30.0\n";

childProcess.spawnSync = function spawnSyncWithOldGit(command, args, options) {
  if (command === "git" && Array.isArray(args) && args[0] === "version") {
    const text = options && options.encoding && options.encoding !== "buffer";
    const stdout = text ? OLD_VERSION : Buffer.from(OLD_VERSION);
    const stderr = text ? "" : Buffer.alloc(0);
    return { pid: 0, status: 0, signal: null, stdout, stderr, output: [null, stdout, stderr] };
  }
  return realSpawnSync.apply(this, arguments);
};
// the CLI imports spawnSync as an ES module: carry the stand-in over to the named export
syncBuiltinESMExports();

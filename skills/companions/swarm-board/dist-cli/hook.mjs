// src/hook/hook.ts
import { spawnSync } from "node:child_process";
import fs2 from "node:fs";
import path3 from "node:path";
import { fileURLToPath } from "node:url";

// src/board/home.ts
import os from "node:os";
import path from "node:path";
var DATA_ROOT = process.env.CHARRETTE_HOME ? path.resolve(process.env.CHARRETTE_HOME) : path.join(os.homedir(), "charrette_appdata");
var SQLITE_PATH = path.join(DATA_ROOT, "swarm.sqlite");

// src/link/hooked.ts
import fs from "node:fs";
import path2 from "node:path";
var hookedDir = (dataRoot) => path2.join(dataRoot, "swarm-hooked");
var hookKey = (input2) => input2.agent_id ? `agent-${input2.agent_id}` : input2.session_id ?? null;
var fileOf = (dataRoot, key2) => path2.join(hookedDir(dataRoot), `${key2.replace(/[^\w.-]/g, "_")}.json`);
function readHooked(dataRoot, key2) {
  try {
    return JSON.parse(fs.readFileSync(fileOf(dataRoot, key2), "utf8"));
  } catch {
    return null;
  }
}

// src/hook/hook.ts
var isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};
function readInput() {
  try {
    return JSON.parse(fs2.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}
function pending(member) {
  const cli = path3.join(path3.dirname(fileURLToPath(import.meta.url)), "cli.mjs");
  const r = spawnSync(process.execPath, [cli, "deliver", "--mentions", "--from-hook", "--as", member], { encoding: "utf8", timeout: 15e3, windowsHide: true });
  return r.status === 0 ? r.stdout.trim() : "";
}
var input = readInput();
var key = hookKey(input);
var hooked = key ? readHooked(DATA_ROOT, key) : null;
if (!hooked) process.exit(0);
var event = input.hook_event_name ?? "";
var messages = pending(hooked.member);
var head = `Swarm board, for you (${hooked.member}). Read it and act on it before you go on:`;
if (event === "Stop" || event === "SubagentStop") {
  if (messages) console.log(JSON.stringify({ decision: "block", reason: `${head}
${messages}` }));
  process.exit(0);
}
var parts = [];
if (messages) parts.push(`${head}
${messages}`);
if (!isAlive(hooked.pid)) parts.push(`Your swarm link has stopped. Start it again now, as a background task: ${hooked.link}`);
if (parts.length) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: event || "PostToolUse", additionalContext: parts.join("\n\n") } }));

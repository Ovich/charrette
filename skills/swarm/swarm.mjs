#!/usr/bin/env node
// swarm launcher — the ONLY public entry point; its path never changes.
// Runs the built CLI bundle (dist-cli/cli.mjs); prints the build command if missing.
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// respect a pre-set SWARM_ROOT (tests); default to the tool's home
process.env.SWARM_ROOT ??= here;

// SWARM_CLI_BUNDLE: tests only, to prove which calls never load the bundle (D57)
const bundle = process.env.SWARM_CLI_BUNDLE ?? path.join(here, "dist-cli", "cli.mjs");

// The hooks' fast exit, before the bundle loads (D57): `swarm hook pre|post` runs on every
// tool call of every session, and with no run open on the machine it has nothing to do.
// The marker is resolved as src/board/home.ts resolves it. The one call that must still
// reach the bundle is a `swarm open` on the pre hook: it maps the orchestrator's session
// before any run exists. Stdin, read here, is handed on to the bundle unchanged.
const [verb, kind] = process.argv.slice(2);
if (verb === "hook" && (kind === "pre" || kind === "post")) {
  const home = process.env.CHARRETTE_HOME ? path.resolve(process.env.CHARRETTE_HOME) : path.join(os.homedir(), "charrette_appdata");
  if (!existsSync(path.join(home, "swarm.active"))) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const raw = Buffer.concat(chunks);
    if (kind === "post" || !mayOpen(raw.toString("utf8"))) process.exit(0);
    const { Readable } = await import("node:stream");
    Object.defineProperty(process, "stdin", { value: Readable.from([raw]), configurable: true, enumerable: true });
  }
}

/** A Bash call whose command could be a `swarm open`; the bundle's hook decides exactly. */
function mayOpen(raw) {
  try {
    const input = JSON.parse(raw);
    const command = String(input?.tool_input?.command ?? "");
    return input?.tool_name === "Bash" && /swarm/.test(command) && /\bopen\b/.test(command);
  } catch {
    return false; // the bundle's hook prints nothing on a broken input either
  }
}

if (!existsSync(bundle)) {
  console.error(`swarm: not built. Run: npm install && npm run build  (in ${here})`);
  process.exit(1);
}
await import(pathToFileURL(bundle).href);

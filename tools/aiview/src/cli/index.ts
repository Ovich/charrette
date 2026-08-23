// CLI dispatch — the agent-facing surface. `open` is the standard gesture:
// ensure registered, ensure server, print URL. Unknown verbs fall to legacy
// (dies in Phase 8 cutover).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { openIndex, SQLITE_PATH, TOOL_ROOT, type Document, type RegisterOptions, type UpdatePatch } from "../core/db.ts";
import { readServerStatus, PORT_FILE, type ServerStatus } from "../core/serverstate.ts";
import { parseArgs } from "./args.ts";

const args = parseArgs(process.argv.slice(2));
const asJson = args.has("--json");

const USAGE = [
  "usage: aiview <verb> [--json]",
  "  open <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO] [--port p] [--open]",
  "  add <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO]",
  "  update <file|#id> [--kind k] [--tag t]... [--untag t]... [--group g|--ungroup] [--group-title T] [--started ISO]",
  "  list [--kind k] [--tag t]...",
  "  remove <file|#id>...",
  "  serve [file] [--port 4321] [--open] [--detach]",
  "  status",
].join("\n");

const registerOpts = (): RegisterOptions => ({
  kind: args.flag("--kind") ?? "",
  tags: args.flags("--tag"),
  started: args.flag("--started") ?? "",
  group: args.flag("--group") ?? "",
  groupTitle: args.flag("--group-title") ?? "",
});

const docLine = (d: Document): string =>
  `#${d.id}  ${d.kind} [${d.tags.join(", ")}]${d.group_slug ? `  group:${d.group_slug}` : ""}  started ${d.created_at}  ${d.title}`;

const emit = (json: unknown, human: string | (() => void)): void => {
  if (asJson) console.log(JSON.stringify(json));
  else if (typeof human === "string") console.log(human);
  else human();
};

/** dist/ missing but the app source present -> build once; on failure, print the command. */
function ensureDist(): void {
  if (fs.existsSync(path.join(TOOL_ROOT, "dist", "index.html"))) return;
  if (!fs.existsSync(path.join(TOOL_ROOT, "app", "index.html"))) return; // no app source: legacy ui
  console.error("aiview: dist/ missing — building the UI once…");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["run", "build"], { cwd: TOOL_ROOT, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error(`aiview: UI build failed. Run: npm install && npm run build  (in ${TOOL_ROOT})`);
    process.exit(1);
  }
}

/** Spawn a detached server and wait for its portfile. Returns the actual port. */
function spawnDetachedServer(port: number): number {
  try {
    fs.rmSync(PORT_FILE, { force: true });
  } catch {}
  // re-invoke the current entry (aiview.mjs in real use, the TS source under test)
  const child = spawn(process.execPath, [process.argv[1], "serve", "--port", String(port)], {
    detached: true,
    stdio: "ignore",
    cwd: TOOL_ROOT,
  });
  child.unref();
  const t0 = Date.now();
  for (;;) {
    const st = readServerStatus();
    if (st.running && st.port !== null) return st.port;
    if (Date.now() - t0 > 10_000) {
      console.error("aiview: server did not come up within 10s");
      process.exit(1);
    }
    // synchronous CLI: a short busy-wait poll is fine here
    spawnSync(process.execPath, ["-e", "setTimeout(()=>{},120)"]);
  }
}

function resolveRef(ref: string): Document | undefined {
  const index = openIndex();
  try {
    return /^#?\d+$/.test(ref) ? index.get(Number(ref.replace("#", ""))) : index.getByPath(path.resolve(ref));
  } finally {
    index.close();
  }
}

function cmdStatus(): void {
  const index = openIndex();
  const documents = index.all().length;
  index.close();
  const server = readServerStatus();
  emit({ sqlite: SQLITE_PATH, documents, server }, () => {
    console.log(`sqlite     ${SQLITE_PATH}`);
    console.log(`documents  ${documents}`);
    console.log(
      `server     ${server.running ? `up (pid ${server.pid}, port ${server.port})` : server.stale ? "down (stale pidfile)" : "down"}`,
    );
  });
}

function cmdAdd(): void {
  if (!args.positional[0]) {
    console.error("usage: aiview add <file.md> [--kind k] [--tag t]...");
    process.exit(1);
  }
  const index = openIndex();
  const d = index.register(path.resolve(args.positional[0]), registerOpts());
  index.close();
  emit(d, docLine(d));
}

function cmdUpdate(): void {
  if (!args.positional[0]) {
    console.error("usage: aiview update <file|#id> [--kind k] [--tag t] [--untag t] [--group g|--ungroup] [--group-title T] [--started ISO]");
    process.exit(1);
  }
  const target = resolveRef(args.positional[0]);
  if (!target) {
    console.error(`not in index: ${args.positional[0]}`);
    process.exit(1);
  }
  const patch: UpdatePatch = {
    kind: args.flag("--kind"),
    addTags: args.flags("--tag"),
    removeTags: args.flags("--untag"),
    group: args.has("--ungroup") ? null : (args.flag("--group") ?? undefined),
    groupTitle: args.flag("--group-title"),
    started: args.flag("--started"),
  };
  const index = openIndex();
  const d = index.update(target.id, patch)!;
  index.close();
  emit(d, docLine(d));
}

function cmdList(): void {
  const want = args.flags("--tag");
  const wantKind = args.flag("--kind") ?? "";
  const index = openIndex();
  const docs = index
    .all()
    .filter((d) => (!wantKind || d.kind === wantKind) && (!want.length || want.every((t) => d.tags.includes(t))));
  index.close();
  emit(docs, () => {
    for (const d of docs)
      console.log(
        `started ${d.created_at}  ${d.kind.padEnd(12)} [${d.tags.join(", ")}]  ${d.title}${d.exists ? "" : "  (missing)"}\n    ${d.file_path}`,
      );
  });
}

function cmdRemove(): void {
  if (!args.positional.length) {
    console.error("usage: aiview remove <file|#id>...");
    process.exit(1);
  }
  const index = openIndex();
  const removed: Document[] = [];
  for (const ref of args.positional) {
    const row = /^#?\d+$/.test(ref) ? index.get(Number(ref.replace("#", ""))) : index.getByPath(path.resolve(ref));
    if (!row) {
      console.error(`not in index: ${ref}`);
      continue;
    }
    index.remove(row.id);
    removed.push(row);
    if (!asJson) console.log(`removed #${row.id}  ${row.title}  (file untouched)`);
  }
  index.close();
  if (asJson) console.log(JSON.stringify({ removed }));
}

function cmdOpen(): void {
  if (!args.positional[0]) {
    console.error("usage: aiview open <file> [--kind k] [--tag t]... [--group g] [--port p] [--open]");
    process.exit(1);
  }
  ensureDist();
  const index = openIndex();
  const d = index.register(path.resolve(args.positional[0]), registerOpts());
  index.close();
  const st: ServerStatus = readServerStatus();
  const port = st.running && st.port !== null ? st.port : spawnDetachedServer(Number(args.flag("--port") ?? process.env.AIVIEW_PORT ?? 4321));
  const url = `http://localhost:${port}/#doc=${d.id}`;
  if (args.has("--open")) {
    const [c, a] =
      process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
    try {
      spawn(c, a as string[], { detached: true, stdio: "ignore" }).unref();
    } catch {}
  }
  emit({ id: d.id, url, server: readServerStatus() }, url);
}

async function cmdServe(): Promise<void> {
  if (args.has("--detach")) {
    ensureDist();
    if (args.positional[0]) {
      // register the start doc in-process; the detached server serves the index
      const index = openIndex();
      index.register(path.resolve(args.positional[0]), registerOpts());
      index.close();
    }
    const st = readServerStatus();
    const port = st.running && st.port !== null ? st.port : spawnDetachedServer(Number(args.flag("--port") ?? process.env.AIVIEW_PORT ?? 4321));
    emit({ server: readServerStatus() }, `aiview server up on http://localhost:${port}/`);
    return;
  }
  ensureDist();
  const { startServer } = await import("../server/index.ts");
  const index = openIndex();
  const startDoc = args.positional[0] ? index.register(path.resolve(args.positional[0]), registerOpts()) : null;
  startServer(index, {
    port: Number(args.flag("--port") ?? process.env.AIVIEW_PORT ?? 4321),
    open: args.has("--open"),
    startDoc,
  });
}

switch (args.verb) {
  case "status":
    cmdStatus();
    break;
  case "add":
    cmdAdd();
    break;
  case "update":
    cmdUpdate();
    break;
  case "list":
    cmdList();
    break;
  case "remove":
    cmdRemove();
    break;
  case "open":
    cmdOpen();
    break;
  case "serve":
    await cmdServe();
    break;
  default:
    console.error(USAGE);
    process.exit(1);
}

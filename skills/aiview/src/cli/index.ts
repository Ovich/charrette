// CLI dispatch — the agent-facing surface. `open` is the standard gesture:
// ensure registered, ensure server, print URL. Unknown verbs fall to legacy
// (dies in Phase 8 cutover).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  ALL_PROJECTS,
  openIndex,
  SQLITE_PATH,
  TOOL_ROOT,
  type Document,
  type Index,
  type RegisterOptions,
  type UpdatePatch,
} from "../core/db.ts";
import { listComponents, resolveBindings } from "../core/bind.ts";
import { isHtml, readDoc } from "../core/paths.ts";
import { projectForCwd } from "../core/projects.ts";
import { adoptLegacyIndex, DATA_ROOT, docsDirFor, DOCS_ROOT, ensureHome } from "../core/home.ts";
import { readServerStatus, PORT_FILE, type ServerStatus } from "../core/serverstate.ts";
import { parseArgs } from "./args.ts";

const args = parseArgs(process.argv.slice(2));
const asJson = args.has("--json");

const USAGE = [
  "usage: aiview <verb> [--json]",
  "  open <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO] [--port p] [--open]",
  "  add <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO]",
  "  update <file|#id> [--kind k] [--tag t]... [--untag t]... [--group g|--ungroup] [--group-title T] [--started ISO]",
  "  list [--kind k] [--tag t]... [--project p | --all]   # defaults to the active project",
  "  project <add|list|rm> [slug] [--title T] [--path P]...",
  "  use <slug|*>                             # set the active project",
  "  remove <file|#id>...",
  "  move <file|#id>... [--project <slug>]    # refile: file + index together",
  "  serve [file] [--port 4321] [--open] [--detach]",
  "  pending add <file|#id> --label L [--note N]   # work the reader is waiting on",
  "  pending done <#pendingId>                     # the work landed; the card goes away",
  "  pending list [<file|#id>] | clear <file|#id>",
  "  status",
  "  path <filename> [--project <slug>]       # where this document belongs, joined for this OS",
  "  components <file|#id>                    # what this mockup offers to siblings, and what it pulls",
  "  check <file|#id>                         # do this mockup's bindings resolve? errors as text, exit 1 if any",
  "  mermaid-check <file|#id>                 # parse every mermaid block of a document; exit 1 if one fails",
  "  init                                     # create the data home; report where everything lives",
].join("\n");

const registerOpts = (): RegisterOptions => ({
  kind: args.flag("--kind") ?? "",
  tags: args.flags("--tag"),
  started: args.flag("--started") ?? "",
  group: args.flag("--group") ?? "",
  groupTitle: args.flag("--group-title") ?? "",
  project: args.flag("--project") ?? "",
});

/** POST to the running server, synchronously (the CLI has no event loop to await on).
 *  false = no server, or it refused; the caller decides whether that matters. */
function postToServer(route: string, body: unknown): boolean {
  const st = readServerStatus();
  if (!st.running || st.port === null) return false;
  const b = JSON.stringify(body);
  const r = spawnSync(
    process.execPath,
    [
      "-e",
      `const b=${JSON.stringify(b)};const q=require('node:http').request(
         {host:'127.0.0.1',port:${st.port},path:${JSON.stringify(route)},method:'POST',
          headers:{'content-type':'application/json','content-length':Buffer.byteLength(b)}},
         r=>{r.resume();r.on('end',()=>process.exit(r.statusCode===200?0:1))});
       q.on('error',()=>process.exit(1));q.end(b);`,
    ],
    { timeout: 5000 },
  );
  return r.status === 0;
}

/** Set the active project through the ONE write path: POST so the server writes the
 *  row and broadcasts in the same step. With no server there is nobody to tell, so
 *  writing the row directly is correct, not a fallback hack. */
function setActive(index: Index, slug: string): string {
  if (!postToServer("/api/active", { project: slug })) index.setActiveProject(slug);
  return slug;
}

/** Tell an open tab that one document's pending cards moved. Reuses the `changed`
 *  event, so the tab reloads through the path the file watcher already uses. */
function notifyPendingChanged(documentId: number): void {
  postToServer("/api/pending-changed", { id: documentId });
}

/** Tell an open tab that the document list moved. The CLI writes sqlite in its own
 *  process, so without this a newly registered document is invisible until a refresh. */
function notifyIndexChanged(): void {
  postToServer("/api/index-changed", {});
}

/** Verbs that change what the sidebar should be showing. */
const MUTATES_INDEX = new Set(["add", "open", "update", "remove", "move", "project"]);

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
      console.error(`aiview: server did not come up within 10s (port ${port} may be in use — retry with --port <n>)`);
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
  const project = index.activeProject();
  // Where the agent writes: ask, never construct (D14).
  const projectDocs = project === ALL_PROJECTS ? DOCS_ROOT : docsDirFor(project);
  // Which project the agent is standing in, if any project claims this directory.
  const cwdProject = projectForCwd(process.cwd(), index.allProjects())?.slug ?? null;
  index.close();
  const server = readServerStatus();
  emit(
    { home: DATA_ROOT, docs: DOCS_ROOT, project, projectDocs, cwdProject, sqlite: SQLITE_PATH, tool: TOOL_ROOT, documents, server },
    () => {
    console.log(`home       ${DATA_ROOT}`);
    console.log(`docs       ${DOCS_ROOT}`);
    console.log(`project    ${project === ALL_PROJECTS ? "(all)" : project}`);
    console.log(`write to   ${projectDocs}`);
    if (cwdProject) console.log(`cwd is in  ${cwdProject}`);
    console.log(`sqlite     ${SQLITE_PATH}`);
    console.log(`tool       ${TOOL_ROOT}`);
    console.log(`documents  ${documents}`);
    console.log(
      `server     ${server.running ? `up (pid ${server.pid}, port ${server.port})` : server.stale ? "down (stale pidfile)" : "down"}`,
    );
  });
}

/** Where a document with this name belongs. The tool joins the path — with this OS's
 *  separator, under this machine's home — so no caller ever builds one by hand. */
function cmdPath(): void {
  const name = args.positional[0];
  if (!name) {
    console.error("usage: aiview path <filename> [--project <slug>]");
    process.exit(1);
  }
  const index = openIndex();
  const slug = args.flag("--project") ?? index.activeProject();
  const known = index.allProjects().map((p) => p.slug);
  index.close();
  if (slug === ALL_PROJECTS) {
    console.error(`no active project — run: aiview use <slug>, or pass --project${known.length ? `\nknown: ${known.join(", ")}` : ""}`);
    process.exit(1);
  }
  if (!known.includes(slug)) {
    console.error(`no such project: ${slug}${known.length ? `\nknown: ${known.join(", ")}` : ""}`);
    process.exit(1);
  }
  const dir = docsDirFor(slug);
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, path.basename(name)); // basename: a name, not a path
  emit({ path: full, dir, project: slug }, full);
}

/** An html mockup by registered ref or by path, for the binding verbs. */
function mockupArg(usage: string): string {
  const ref = args.positional[0];
  if (!ref) {
    console.error(usage);
    process.exit(1);
  }
  const abs = resolveRef(ref)?.abs_path ?? path.resolve(ref);
  if (!fs.existsSync(abs)) {
    console.error(`no such file: ${abs}`);
    process.exit(1);
  }
  if (!isHtml(abs)) {
    console.error(`not an html mockup: ${abs}`);
    process.exit(1);
  }
  return abs;
}

/** What a mockup offers to its siblings and what it pulls from them, so an agent never
 *  greps a 90 KB file for data-component before writing a placeholder. */
function cmdComponents(): void {
  const abs = mockupArg("usage: aiview components <file|#id>");
  const r = listComponents(readDoc(abs));
  emit({ file: path.basename(abs), ...r }, () => {
    if (!r.offers.length) console.log("offers   nothing: no data-component in this file");
    for (const o of r.offers)
      console.log(
        `offers   ${o.name}  <${o.tag}>${o.within ? `  within ${o.within}` : ""}${o.warnings.length ? `  !! ${o.warnings.join(", ")}` : ""}`,
      );
    for (const x of r.pulls) console.log(`pulls    ${x.name || x.ref}  from ${x.file || "(invalid ref)"}`);
    if (!r.pulls.length) console.log("pulls    nothing: no data-bind in this file");
  });
}

/** Resolve a host the way the server does and say what went wrong, as text. Exit 1 on errors. */
function cmdCheck(): void {
  const abs = mockupArg("usage: aiview check <file|#id>");
  const dir = path.dirname(abs);
  const reader = (name: string): string | undefined => {
    if (/[\\/]/.test(name) || name.includes("..")) return undefined;
    const f = path.join(dir, name);
    return fs.existsSync(f) && fs.statSync(f).isFile() ? readDoc(f) : undefined;
  };
  const r = resolveBindings(readDoc(abs), reader);
  emit({ file: path.basename(abs), bound: r.bound, sources: r.sources, errors: r.errors, warnings: r.warnings }, () => {
    console.log(`${r.bound} bound from ${r.sources.length} source${r.sources.length === 1 ? "" : "s"}${r.sources.length ? `: ${r.sources.join(", ")}` : ""}`);
    for (const e of r.errors) console.log(`error    ${e.ref}: ${e.message}`);
    for (const w of r.warnings) console.log(`warning  ${w.ref}: ${w.message}`);
    if (!r.errors.length && !r.warnings.length) console.log("ok");
  });
  if (r.errors.length) process.exit(1);
}

/** Parse every mermaid block of a document, the way the viewer will. The checker is a
 *  separate bundle next to the CLI bundle, loaded only here. */
async function cmdMermaidCheck(): Promise<void> {
  const ref = args.positional[0];
  if (!ref) {
    console.error("usage: aiview mermaid-check <file|#id>");
    process.exit(1);
  }
  const abs = resolveRef(ref)?.abs_path ?? path.resolve(ref);
  if (!fs.existsSync(abs)) {
    console.error(`no such file: ${abs}`);
    process.exit(1);
  }
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundle = [path.join(here, "mermaid-check.mjs"), path.join(here, "..", "..", "dist-cli", "mermaid-check.mjs")].find((f) => fs.existsSync(f));
  if (!bundle) {
    console.error(`aiview: the mermaid checker is not built. Run: npm install && npm run build  (in ${TOOL_ROOT})`);
    process.exit(1);
  }
  const { blocksOf, checkBlocks } = (await import(pathToFileURL(bundle).href)) as typeof import("../mermaid/check.ts");
  const content = fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n");
  const blocks = blocksOf(content, /\.(md|markdown)$/i.test(abs));
  const results = await checkBlocks(blocks);
  const failed = results.filter((r) => !r.ok).length;
  emit({ file: path.basename(abs), blocks: results.length, failed, results }, () => {
    if (!results.length) return console.log("no mermaid block in this document");
    for (const r of results) console.log(r.ok ? `ok     line ${r.line}  ${r.type}` : `FAIL   line ${r.line}  ${r.error}`);
    console.log(`${results.length} block${results.length === 1 ? "" : "s"}, ${failed} failed`);
  });
  if (failed) process.exit(1);
}

/** First clone / new machine: make the data home exist and say what lives where. */
function cmdInit(): void {
  ensureHome();
  adoptLegacyIndex(TOOL_ROOT, SQLITE_PATH);
  emit({ home: DATA_ROOT, docs: DOCS_ROOT, sqlite: SQLITE_PATH, tool: TOOL_ROOT }, () => {
    console.log(`data home  ${DATA_ROOT}      (yours: index, server files, documents — never versioned)`);
    console.log(`documents  ${path.join(DOCS_ROOT, "<project>")}`);
    console.log(`tool       ${TOOL_ROOT}      (the checkout: rebuildable, safe to delete)`);
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
  // Kind, tags and group are metadata; project is a directory. Silently ignoring
  // --project here would look like it worked.
  if (args.flag("--project")) {
    console.error(`project is a directory, not metadata — use: aiview move ${args.positional[0]} --project <slug>`);
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
  // Scope defaults to the active project (D10); --all or --project override it.
  const scope = args.has("--all") ? ALL_PROJECTS : (args.flag("--project") ?? index.activeProject());
  const docs = index
    .all()
    .filter(
      (d) =>
        (scope === ALL_PROJECTS || d.project === scope) &&
        (!wantKind || d.kind === wantKind) &&
        (!want.length || want.every((t) => d.tags.includes(t))),
    );
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

function cmdProject(): void {
  const sub = args.positional[0] ?? "list";
  const index = openIndex();
  try {
    if (sub === "list") {
      const projects = index.allProjects();
      const docs = index.all();
      const active = index.activeProject();
      const count = (slug: string) => docs.filter((d) => d.project === slug).length;
      emit(
        projects.map((p) => ({ ...p, documents: count(p.slug), active: p.slug === active })),
        () => {
          for (const p of projects)
            console.log(
              `${p.slug === active ? "*" : " "} ${p.slug.padEnd(14)} ${String(count(p.slug)).padStart(3)} docs  ${docsDirFor(p.slug)}${p.paths.length ? `\n    covers ${p.paths.join(", ")}` : ""}`,
            );
        },
      );
      return;
    }

    const slug = args.positional[1];
    if (!slug) {
      console.error(`usage: aiview project ${sub} <slug>`);
      process.exit(1);
    }

    if (sub === "add") {
      const p = index.upsertProject(slug, { title: args.flag("--title"), addPaths: args.flags("--path") });
      fs.mkdirSync(docsDirFor(slug), { recursive: true });
      emit({ ...p, docs: docsDirFor(slug) }, `${p.slug}  ${docsDirFor(slug)}${p.paths.length ? `\n  covers ${p.paths.join(", ")}` : ""}`);
      return;
    }

    if (sub === "rm") {
      const r = index.removeProject(slug);
      if (!r.removed) {
        console.error(
          r.documents > 0
            ? `${slug} still has ${r.documents} document${r.documents === 1 ? "" : "s"}. Move or remove them first.`
            : `no such project: ${slug}`,
        );
        process.exit(1);
      }
      emit(r, `removed project ${slug}  (its directory is left on disk)`);
      return;
    }

    console.error("usage: aiview project <add|list|rm> [slug] [--title T] [--path P]...");
    process.exit(1);
  } finally {
    index.close();
  }
}

/** Set the active project. `*` = All projects. */
function cmdUse(): void {
  const slug = args.positional[0];
  if (!slug) {
    console.error("usage: aiview use <slug|*>");
    process.exit(1);
  }
  const index = openIndex();
  try {
    if (slug !== ALL_PROJECTS && !index.allProjects().some((p) => p.slug === slug)) {
      const known = index.allProjects().map((p) => p.slug);
      console.error(`no such project: ${slug}${known.length ? `\nknown: ${known.join(", ")}` : ""}`);
      process.exit(1);
    }
    setActive(index, slug);
    emit(
      { project: slug, docs: slug === ALL_PROJECTS ? DOCS_ROOT : docsDirFor(slug) },
      slug === ALL_PROJECTS ? `all projects  ${DOCS_ROOT}` : `${slug}  ${docsDirFor(slug)}`,
    );
  } finally {
    index.close();
  }
}

/** Refile a document: `--project` puts it in another project, bare pulls a stray back
 *  into its own project's directory. The project IS the directory (D14), so this is
 *  the only way to reclassify one — and the caller names a project, never a path. */
function cmdMove(): void {
  if (!args.positional.length) {
    console.error("usage: aiview move <file|#id>... [--project <slug>]");
    process.exit(1);
  }
  const target = args.flag("--project");
  const index = openIndex();
  if (target && !index.allProjects().some((p) => p.slug === target)) {
    const known = index.allProjects().map((p) => p.slug);
    console.error(`no such project: ${target}${known.length ? `\nknown: ${known.join(", ")}` : ""}`);
    index.close();
    process.exit(1);
  }
  const moved: Document[] = [];
  for (const ref of args.positional) {
    const row = /^#?\d+$/.test(ref) ? index.get(Number(ref.replace("#", ""))) : index.getByPath(path.resolve(ref));
    if (!row) {
      console.error(`not in index: ${ref}`);
      continue;
    }
    const from = row.abs_path;
    const dir = docsDirFor(target ?? row.project);
    const dest = path.join(dir, path.basename(from));
    if (dest === from) {
      console.error(`already there: ${from}`);
      continue;
    }
    // File already at the destination with a stale row: a previous run moved the
    // file and then failed to write the index. Re-point the row and carry on.
    const orphaned = !fs.existsSync(from) && fs.existsSync(dest);
    if (!fs.existsSync(from) && !orphaned) {
      console.error(`missing file, not moved: ${from}`);
      continue;
    }
    if (fs.existsSync(dest) && !orphaned) {
      console.error(`target exists, skipped: ${dest}`);
      continue;
    }
    fs.mkdirSync(dir, { recursive: true });
    if (!orphaned) {
      try {
        fs.renameSync(from, dest);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
        fs.copyFileSync(from, dest); // different volume: copy, then drop the original
        fs.rmSync(from);
      }
    }
    const d = index.move(row.id, dest)!;
    moved.push(d);
    if (!asJson) console.log(`moved #${d.id}  ${from}\n           -> ${dest}`);
  }
  index.close();
  if (asJson) console.log(JSON.stringify({ moved }));
}

function cmdOpen(): void {
  if (!args.positional[0]) {
    console.error("usage: aiview open <file> [--kind k] [--tag t]... [--group g] [--port p] [--open]");
    process.exit(1);
  }
  ensureDist();
  const index = openIndex();
  const d = index.register(path.resolve(args.positional[0]), registerOpts());
  // Opening a document moves the mode to it (D9): the selector always states where
  // you are, and the agent never has to switch-then-open in two steps.
  setActive(index, d.project);
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

function cmdPending(): void {
  const sub = args.positional[0];
  const index = openIndex();
  const needDoc = (ref: string | undefined): Document => {
    if (!ref) {
      console.error("usage: aiview pending <add|done|list|clear> ...");
      process.exit(1);
    }
    const doc = resolveRef(ref);
    if (!doc) {
      console.error(`no such document: ${ref}`);
      process.exit(1);
    }
    return doc;
  };

  if (sub === "add") {
    const doc = needDoc(args.positional[1]);
    const label = args.flag("--label");
    if (!label) {
      console.error("usage: aiview pending add <file|#id> --label L [--note N]");
      process.exit(1);
    }
    const id = index.addPending(doc.id, label, args.flag("--note") ?? "");
    index.close();
    notifyPendingChanged(doc.id);
    emit({ id, document: doc.id, label }, `pending #${id}  ${label}  (doc #${doc.id})`);
    return;
  }
  if (sub === "done") {
    const raw = (args.positional[1] ?? "").replace(/^#/, "");
    const id = Number(raw);
    if (!raw || Number.isNaN(id)) {
      console.error("usage: aiview pending done <#pendingId>");
      process.exit(1);
    }
    const docId = index.donePending(id);
    index.close();
    if (docId === null) {
      console.error(`no such pending item: #${id}`);
      process.exit(1);
    }
    notifyPendingChanged(docId);
    emit({ id, document: docId }, `done #${id}`);
    return;
  }
  if (sub === "clear") {
    const doc = needDoc(args.positional[1]);
    index.clearPending(doc.id);
    index.close();
    notifyPendingChanged(doc.id);
    emit({ document: doc.id, cleared: true }, `cleared pending for #${doc.id}`);
    return;
  }
  // list, the default
  const ref = args.positional[1];
  const rows = ref ? index.pendingFor(needDoc(ref).id) : index.allPending();
  index.close();
  emit(rows, () => {
    if (!rows.length) return console.log("nothing pending");
    for (const r of rows) console.log(`#${r.id}  doc #${r.document_id}  ${r.label}${r.note ? ` — ${r.note}` : ""}  since ${r.started_at}`);
  });
}

switch (args.verb) {
  case "pending":
    cmdPending();
    break;
  case "status":
    cmdStatus();
    break;
  case "path":
    cmdPath();
    break;
  case "init":
    cmdInit();
    break;
  case "components":
    cmdComponents();
    break;
  case "check":
    cmdCheck();
    break;
  case "mermaid-check":
    await cmdMermaidCheck();
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
  case "move":
    cmdMove();
    break;
  case "project":
    cmdProject();
    break;
  case "use":
    cmdUse();
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

// One notification per invocation, after the work is done: any open tab reloads its
// list. Error paths exit before here, so nothing is announced that did not happen.
if (MUTATES_INDEX.has(args.verb ?? "")) notifyIndexChanged();

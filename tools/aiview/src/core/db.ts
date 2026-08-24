// The index — the ONLY module that sees SQL (spec A7). Everything else calls the
// typed functions returned by openIndex().
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adoptLegacyIndex, DATA_ROOT, DOCS_ROOT, ensureHome } from "./home.ts";
import { resolveProject, type Project } from "./projects.ts";
import {
  formatOf,
  isPdf,
  kindFromName,
  projectRoot,
  readDoc,
  titleOf,
  toAbs,
  toStored,
  type DocFormat,
} from "./paths.ts";

// node:sqlite prints an ExperimentalWarning on import; keep every other warning.
process.removeAllListeners("warning");
process.on("warning", (w) => {
  if (w.name !== "ExperimentalWarning") console.warn(w);
});
const { DatabaseSync } = await import("node:sqlite");

/** Tool root: where the code and its build output live (app/, dist/, dist-cli/).
 *  The launcher sets AIVIEW_ROOT; the fallback walks up from this module to the
 *  directory holding package.json, which covers both dist-cli/cli.mjs and direct
 *  src/ execution (tests). User data does NOT live here — see core/home.ts. */
function findToolRoot(): string {
  if (process.env.AIVIEW_ROOT) return process.env.AIVIEW_ROOT;
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}
export const TOOL_ROOT = findToolRoot();
export const SQLITE_PATH = path.join(DATA_ROOT, "aiview.sqlite");
/** Stored paths are relative to the data home when inside it — so a synced home
 *  carries a working index to another machine — and absolute anywhere else. */
export const STORE_ROOT = DATA_ROOT;

export interface Document {
  id: number;
  file_path: string; // stored form: posix-relative to root when inside it
  abs_path: string;
  project: string;
  title: string | null;
  kind: string;
  tags: string[];
  /** Exclusive membership: at most one group per doc. null = ungrouped. */
  group_slug: string | null;
  created_at: string;
  last_seen_at: string;
}

export interface Group {
  slug: string;
  /** Display title; falls back to the slug in the UI. */
  title: string | null;
}

export interface DocumentWithState extends Document {
  exists: boolean;
  /** The file's own mtime: the honest "last changed". `last_seen_at` is index
   *  bookkeeping and gets bumped by re-registering or moving a document, which must
   *  not make a year-old board look like today's work. null when the file is gone. */
  updated_at: string | null;
  format: DocFormat;
}

export interface RegisterOptions {
  kind?: string;
  tags?: string[];
  started?: string;
  group?: string;
  groupTitle?: string;
  /** Explicit --project; wins over every other resolution rule. */
  project?: string;
}

/** `*` means All projects: no scope. */
export const ALL_PROJECTS = "*";

interface Row {
  id: number;
  file_path: string;
  project: string;
  title: string | null;
  kind: string;
  tags: string;
  group_slug: string | null;
  created_at: string;
  last_seen_at: string;
}

const now = () => new Date().toISOString();

export interface UpdatePatch {
  kind?: string;
  addTags?: string[];
  removeTags?: string[];
  /** string = set (creates the group), null = ungroup, undefined = keep. */
  group?: string | null;
  groupTitle?: string;
  started?: string;
}

export interface Index {
  register(absFile: string, opts?: RegisterOptions): Document;
  update(id: number, patch: UpdatePatch): Document | undefined;
  /** Re-point a row at a file that has already been moved on disk. */
  move(id: number, newAbs: string): Document | undefined;
  get(id: number): Document | undefined;
  getByPath(absFile: string): Document | undefined;
  all(): DocumentWithState[];
  allGroups(): Group[];
  /** Create the group if new; a non-empty title also renames it. */
  upsertGroup(slug: string, title?: string): Group;
  allProjects(): Project[];
  /** Create the project if new; a non-empty title renames it, paths are merged in. */
  upsertProject(slug: string, patch?: { title?: string; addPaths?: string[] }): Project;
  /** Refused while documents still reference it: `documents` reports how many. */
  removeProject(slug: string): { removed: boolean; documents: number };
  /** The active project slug, or `*` for All projects. */
  activeProject(): string;
  setActiveProject(slug: string): string;
  remove(id: number): boolean;
  touch(id: number): void;
  close(): void;
}

export function openIndex(dbPath: string = SQLITE_PATH, root: string = STORE_ROOT): Index {
  if (dbPath === SQLITE_PATH) {
    ensureHome();
    adoptLegacyIndex(TOOL_ROOT, SQLITE_PATH);
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
    -- The server writes on every file change while the CLI writes too; without a
    -- busy timeout a concurrent verb fails outright with SQLITE_BUSY.
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      project TEXT NOT NULL,
      title TEXT,
      kind TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
  `);
  // Schema upkeep for indexes created by earlier versions.
  const cols = (db.prepare("PRAGMA table_info(documents)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("tags")) db.exec("ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'");
  if (!cols.includes("kind")) db.exec("ALTER TABLE documents ADD COLUMN kind TEXT NOT NULL DEFAULT ''");
  if (!cols.includes("group_slug")) db.exec("ALTER TABLE documents ADD COLUMN group_slug TEXT");
  db.exec("CREATE TABLE IF NOT EXISTS groups (slug TEXT PRIMARY KEY, title TEXT)");
  db.exec(
    "CREATE TABLE IF NOT EXISTS projects (slug TEXT PRIMARY KEY, title TEXT, paths TEXT NOT NULL DEFAULT '[]')",
  );
  db.exec("CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  db.exec("DROP TABLE IF EXISTS revisions");

  const parse = (row: Row): Document => ({
    ...row,
    tags: JSON.parse(row.tags) as string[],
    abs_path: toAbs(row.file_path, root),
  });

  interface ProjectRow {
    slug: string;
    title: string | null;
    paths: string;
  }
  const parseProject = (row: ProjectRow): Project => ({
    slug: row.slug,
    title: row.title,
    paths: JSON.parse(row.paths) as string[],
  });

  const upsertProject = (slug: string, patch: { title?: string; addPaths?: string[] } = {}): Project => {
    const existing = db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as ProjectRow | undefined;
    const paths = [...new Set([...(existing ? (JSON.parse(existing.paths) as string[]) : []), ...(patch.addPaths ?? [])])];
    const title = patch.title || existing?.title || null;
    db.prepare(
      `INSERT INTO projects (slug, title, paths) VALUES (?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET title = excluded.title, paths = excluded.paths`,
    ).run(slug, title, JSON.stringify(paths));
    return parseProject(db.prepare("SELECT * FROM projects WHERE slug = ?").get(slug) as unknown as ProjectRow);
  };

  const upsertGroup = (slug: string, title?: string): Group => {
    db.prepare(
      `INSERT INTO groups (slug, title) VALUES (?, ?)
       ON CONFLICT(slug) DO UPDATE SET title = CASE WHEN excluded.title IS NOT NULL THEN excluded.title ELSE groups.title END`,
    ).run(slug, title ?? null);
    return db.prepare("SELECT * FROM groups WHERE slug = ?").get(slug) as unknown as Group;
  };

  return {
    register(absFile, { kind = "", tags: extraTags = [], started = "", group = "", groupTitle = "", project = "" } = {}) {
      if (!fs.existsSync(absFile)) throw new Error(`no such file: ${absFile}`);
      const file = toStored(absFile, root);
      const content = isPdf(absFile) ? "" : readDoc(absFile); // binary formats title by filename
      const existing = db.prepare("SELECT * FROM documents WHERE file_path = ?").get(file) as Row | undefined;
      const finalKind = (kind || existing?.kind || kindFromName(file)).toLowerCase();
      if (!finalKind)
        throw new Error(
          "kind is mandatory: name the file <name>.<kind>.md or pass --kind <kind> (e.g. brainstorm, mockup, pr-analysis)",
        );
      const tags = [...new Set([...(existing ? (JSON.parse(existing.tags) as string[]) : []), ...extraTags])].filter(
        (t) => t !== finalKind,
      );
      const t = now();
      // created_at = start of the work: first registration, or an explicit --started ISO date-time.
      const startedAt = started ? new Date(started).toISOString() : (existing?.created_at ?? t);
      const groupSlug = (group || existing?.group_slug || null) as string | null;
      if (group) upsertGroup(group, groupTitle || undefined);
      // Declared, not derived (D6/D8): projectRoot survives only as the last resort.
      const proj = resolveProject({
        explicit: project,
        absFile,
        docsRoot: DOCS_ROOT,
        existing: existing?.project,
        fallback: projectRoot(absFile),
      });
      upsertProject(proj); // never leave a document pointing at a project with no record
      db.prepare(
        `INSERT INTO documents (file_path, project, title, kind, tags, group_slug, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(file_path) DO UPDATE SET last_seen_at = excluded.last_seen_at, title = excluded.title,
           kind = excluded.kind, tags = excluded.tags, group_slug = excluded.group_slug,
           project = excluded.project, created_at = excluded.created_at`,
      ).run(file, proj, titleOf(content, absFile), finalKind, JSON.stringify(tags), groupSlug, startedAt, t);
      return parse(db.prepare("SELECT * FROM documents WHERE file_path = ?").get(file) as unknown as Row);
    },

    update(id, patch) {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id)) as Row | undefined;
      if (!row) return undefined;
      const kind = patch.kind ? patch.kind.toLowerCase() : row.kind;
      const tags = [
        ...new Set([...(JSON.parse(row.tags) as string[]), ...(patch.addTags ?? [])]),
      ].filter((t) => t !== kind && !(patch.removeTags ?? []).includes(t));
      const group = patch.group === undefined ? row.group_slug : patch.group;
      if (patch.group) upsertGroup(patch.group, patch.groupTitle || undefined);
      else if (patch.groupTitle && row.group_slug) upsertGroup(row.group_slug, patch.groupTitle);
      const createdAt = patch.started ? new Date(patch.started).toISOString() : row.created_at;
      db.prepare(
        "UPDATE documents SET kind = ?, tags = ?, group_slug = ?, created_at = ?, last_seen_at = ? WHERE id = ?",
      ).run(kind, JSON.stringify(tags), group, createdAt, now(), row.id);
      return parse(db.prepare("SELECT * FROM documents WHERE id = ?").get(row.id) as unknown as Row);
    },

    move(id, newAbs) {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id)) as Row | undefined;
      if (!row) return undefined;
      // Identity, start time, tags and group all survive: only the location changes.
      // Moving into <docs>/<slug>/ re-files the document under that project.
      const proj = resolveProject({
        absFile: newAbs,
        docsRoot: DOCS_ROOT,
        existing: row.project,
        fallback: projectRoot(newAbs),
      });
      upsertProject(proj);
      db.prepare("UPDATE documents SET file_path = ?, project = ?, last_seen_at = ? WHERE id = ?").run(
        toStored(newAbs, root),
        proj,
        now(),
        row.id,
      );
      return parse(db.prepare("SELECT * FROM documents WHERE id = ?").get(row.id) as unknown as Row);
    },

    get(id) {
      const row = db.prepare("SELECT * FROM documents WHERE id = ?").get(Number(id)) as Row | undefined;
      return row ? parse(row) : undefined;
    },

    getByPath(absFile) {
      const row = db.prepare("SELECT * FROM documents WHERE file_path = ?").get(toStored(absFile, root)) as
        | Row
        | undefined;
      return row ? parse(row) : undefined;
    },

    all() {
      return (db.prepare("SELECT * FROM documents ORDER BY created_at DESC, id DESC").all() as unknown as Row[])
        .map(parse)
        .map((d) => {
          // one stat answers both "is it there" and "when did it really change"
          let stat: fs.Stats | null = null;
          try {
            stat = fs.statSync(d.abs_path);
          } catch {
            stat = null;
          }
          return {
            ...d,
            exists: stat !== null,
            updated_at: stat ? new Date(stat.mtimeMs).toISOString() : null,
            format: formatOf(d.file_path),
          };
        });
    },

    allGroups() {
      return db.prepare("SELECT * FROM groups ORDER BY slug").all() as unknown as Group[];
    },

    upsertGroup,

    allProjects() {
      return (db.prepare("SELECT * FROM projects ORDER BY slug").all() as unknown as ProjectRow[]).map(parseProject);
    },

    upsertProject,

    removeProject(slug) {
      const { n } = db.prepare("SELECT COUNT(*) AS n FROM documents WHERE project = ?").get(slug) as unknown as {
        n: number;
      };
      if (n > 0) return { removed: false, documents: n };
      const info = db.prepare("DELETE FROM projects WHERE slug = ?").run(slug);
      return { removed: info.changes > 0, documents: 0 };
    },

    activeProject() {
      const row = db.prepare("SELECT value FROM state WHERE key = 'active_project'").get() as
        | { value: string }
        | undefined;
      const slug = row?.value ?? ALL_PROJECTS;
      if (slug === ALL_PROJECTS) return slug;
      // A project removed behind the active pointer reads as All projects, never as a
      // stale name the selector cannot explain.
      const exists = db.prepare("SELECT 1 FROM projects WHERE slug = ?").get(slug);
      return exists ? slug : ALL_PROJECTS;
    },

    setActiveProject(slug) {
      db.prepare(
        "INSERT INTO state (key, value) VALUES ('active_project', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      ).run(slug);
      return slug;
    },

    remove(id) {
      const row = db.prepare("SELECT id FROM documents WHERE id = ?").get(Number(id)) as { id: number } | undefined;
      if (!row) return false;
      db.prepare("DELETE FROM documents WHERE id = ?").run(row.id);
      return true;
    },

    touch(id) {
      db.prepare("UPDATE documents SET last_seen_at = ? WHERE id = ?").run(now(), id);
    },

    close() {
      db.close();
    },
  };
}

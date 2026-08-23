// The index — the ONLY module that sees SQL (spec A7). Everything else calls the
// typed functions returned by openIndex().
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatOf,
  isPdf,
  kindFromName,
  projectRoot,
  readDoc,
  repoRootOf,
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

/** Tool root: where aiview.mjs and aiview.sqlite live. The launcher sets AIVIEW_ROOT;
 *  the fallback walks up from this module to the directory holding package.json,
 *  which covers both dist-cli/cli.mjs and direct src/ execution (tests). */
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
export const SQLITE_PATH = path.join(TOOL_ROOT, "aiview.sqlite");
/** The repo that vendors the tool (stored paths are relative to this), else the tool dir. */
export const REPO_ROOT = repoRootOf(TOOL_ROOT);

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
  format: DocFormat;
}

export interface RegisterOptions {
  kind?: string;
  tags?: string[];
  started?: string;
  group?: string;
  groupTitle?: string;
}

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
  get(id: number): Document | undefined;
  getByPath(absFile: string): Document | undefined;
  all(): DocumentWithState[];
  allGroups(): Group[];
  /** Create the group if new; a non-empty title also renames it. */
  upsertGroup(slug: string, title?: string): Group;
  remove(id: number): boolean;
  touch(id: number): void;
  close(): void;
}

export function openIndex(dbPath: string = SQLITE_PATH, root: string = REPO_ROOT): Index {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = DELETE;
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
  db.exec("DROP TABLE IF EXISTS revisions");

  const parse = (row: Row): Document => ({
    ...row,
    tags: JSON.parse(row.tags) as string[],
    abs_path: toAbs(row.file_path, root),
  });

  const upsertGroup = (slug: string, title?: string): Group => {
    db.prepare(
      `INSERT INTO groups (slug, title) VALUES (?, ?)
       ON CONFLICT(slug) DO UPDATE SET title = CASE WHEN excluded.title IS NOT NULL THEN excluded.title ELSE groups.title END`,
    ).run(slug, title ?? null);
    return db.prepare("SELECT * FROM groups WHERE slug = ?").get(slug) as unknown as Group;
  };

  return {
    register(absFile, { kind = "", tags: extraTags = [], started = "", group = "", groupTitle = "" } = {}) {
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
      db.prepare(
        `INSERT INTO documents (file_path, project, title, kind, tags, group_slug, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(file_path) DO UPDATE SET last_seen_at = excluded.last_seen_at, title = excluded.title,
           kind = excluded.kind, tags = excluded.tags, group_slug = excluded.group_slug, created_at = excluded.created_at`,
      ).run(file, projectRoot(absFile), titleOf(content, absFile), finalKind, JSON.stringify(tags), groupSlug, startedAt, t);
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
        .map((d) => ({ ...d, exists: fs.existsSync(d.abs_path), format: formatOf(d.file_path) }));
    },

    allGroups() {
      return db.prepare("SELECT * FROM groups ORDER BY slug").all() as unknown as Group[];
    },

    upsertGroup,

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

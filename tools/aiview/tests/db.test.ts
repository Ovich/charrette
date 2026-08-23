import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openIndex, type Index } from "../src/core/db.ts";

let tmp: string;
let root: string;
let index: Index;

const write = (rel: string, content: string): string => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-db-"));
  root = path.join(tmp, "repo");
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  index = openIndex(path.join(tmp, "test.sqlite"), root);
});

afterEach(() => {
  index.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("register: kind from filename, stored path repo-relative, title from h1", () => {
  const abs = write("docs/x.brainstorm.md", "# Board X\n");
  const d = index.register(abs, { tags: ["proj"] });
  assert.equal(d.kind, "brainstorm");
  assert.equal(d.file_path, "docs/x.brainstorm.md");
  assert.equal(d.abs_path, abs);
  assert.equal(d.title, "Board X");
  assert.deepEqual(d.tags, ["proj"]);
});

test("register: kind is mandatory", () => {
  const abs = write("plain.md", "# T\n");
  assert.throws(() => index.register(abs), /kind is mandatory/);
});

test("register: missing file throws", () => {
  assert.throws(() => index.register(path.join(root, "nope.spec.md")), /no such file/);
});

test("register twice: upsert keeps created_at, merges tags, drops tag equal to kind", () => {
  const abs = write("x.spec.md", "# S\n");
  const first = index.register(abs, { tags: ["a"] });
  const second = index.register(abs, { tags: ["b", "spec"] });
  assert.equal(second.id, first.id);
  assert.equal(second.created_at, first.created_at);
  assert.deepEqual([...second.tags].sort(), ["a", "b"]);
});

test("register: --started overrides created_at", () => {
  const abs = write("x.spec.md", "# S\n");
  const d = index.register(abs, { started: "2026-08-01T10:00:00+02:00" });
  assert.equal(d.created_at, "2026-08-01T08:00:00.000Z");
});

test("register: pdf titles by filename, explicit kind", () => {
  const abs = write("out/cv-live.pdf", "%PDF-1.4 fake");
  const d = index.register(abs, { kind: "pdf" });
  assert.equal(d.kind, "pdf");
  assert.equal(d.title, "cv-live.pdf");
});

test("all: newest created_at first, exists + format computed", () => {
  const a = write("a.spec.md", "# A\n");
  const b = write("b.mockup.html", "<title>B</title>");
  index.register(a, { started: "2026-01-01T00:00:00Z" });
  index.register(b, { started: "2026-02-01T00:00:00Z" });
  const all = index.all();
  assert.deepEqual(all.map((d) => d.title), ["B", "A"]);
  assert.deepEqual(all.map((d) => d.format), ["html", "markdown"]);
  assert.ok(all.every((d) => d.exists));
  fs.rmSync(a);
  assert.equal(index.all().find((d) => d.title === "A")?.exists, false);
});

test("get / getByPath / remove / touch", () => {
  const abs = write("x.report.md", "# R\n");
  const d = index.register(abs);
  assert.equal(index.get(d.id)?.title, "R");
  assert.equal(index.getByPath(abs)?.id, d.id);
  index.touch(d.id);
  assert.ok(index.get(d.id)!.last_seen_at >= d.last_seen_at);
  assert.equal(index.remove(d.id), true);
  assert.equal(index.remove(d.id), false);
  assert.equal(index.get(d.id), undefined);
});

test("groups: register with --group creates the group, title optional then renamable", () => {
  const abs = write("g.spec.md", "# G\n");
  const d = index.register(abs, { group: "aiview-webapp" });
  assert.equal(d.group_slug, "aiview-webapp");
  assert.deepEqual(index.allGroups().map((g) => ({ ...g })), [{ slug: "aiview-webapp", title: null }]);
  index.register(abs, { group: "aiview-webapp", groupTitle: "aiview web app" });
  assert.deepEqual(index.allGroups().map((g) => ({ ...g })), [{ slug: "aiview-webapp", title: "aiview web app" }]);
  // re-register without group keeps membership
  const again = index.register(abs);
  assert.equal(again.group_slug, "aiview-webapp");
});

test("groups: ungrouped docs stay null", () => {
  const d = index.register(write("u.spec.md", "# U\n"));
  assert.equal(d.group_slug, null);
  assert.deepEqual(index.allGroups(), []);
});

test("migration: v1 schema (no kind/tags, revisions table) upgrades in place", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const dbPath = path.join(tmp, "v1.sqlite");
  const raw = new DatabaseSync(dbPath);
  raw.exec(`
    CREATE TABLE documents (
      id INTEGER PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      project TEXT NOT NULL,
      title TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );
    CREATE TABLE revisions (id INTEGER PRIMARY KEY);
    INSERT INTO documents VALUES (1, 'old.md', 'repo', 'Old', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
  `);
  raw.close();
  const upgraded = openIndex(dbPath, root);
  const d = upgraded.get(1);
  assert.equal(d?.title, "Old");
  assert.equal(d?.kind, "");
  assert.deepEqual(d?.tags, []);
  assert.equal(d?.group_slug, null);
  assert.deepEqual(upgraded.allGroups(), []);
  const check = new DatabaseSync(dbPath);
  const tables = (check.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
    (t) => t.name,
  );
  assert.ok(!tables.includes("revisions"));
  check.close();
  upgraded.close();
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { annotate, appendEntry, readManifest, sidecarOf, writeDerived } from "./data-folder.mjs";

const here = import.meta.dirname;
const freshPage = () => join(mkdtempSync(join(tmpdir(), "folder-")), "2026-01-01-probe.workbench.html");
const listing = (dir) => {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true }).map((p) => p.replaceAll("\\", "/")).sort();
};
const feedOf = (runs, shared = { prompts: { p: 1 } }, keepRuns) => ({
  shared,
  tabs: { t: runs },
  ...(keepRuns !== undefined && { keepRuns }),
});
const aRun = (name, value = name) => ({ name, run: { value }, files: { "side.json": { of: value } } });

test("an unchanged second feed writes only the manifest", () => {
  const page = freshPage();
  const feed = feedOf([aRun("r2"), aRun("r1")]);
  const first = writeDerived(page, feed);
  assert.ok(first.written > 1);
  const second = writeDerived(page, feed);
  assert.equal(second.written, 1);
  assert.equal(second.kept, first.written - 1);
  assert.equal(second.pruned, 0);
});

test("a content-hashed run file already present is skipped, not rewritten", () => {
  const page = freshPage();
  writeDerived(page, feedOf([aRun("r1")]));
  const runFile = join(sidecarOf(page), readManifest(page).tabs.t.runs[0].file);
  const old = new Date(2000, 0, 1);
  utimesSync(runFile, old, old);
  writeDerived(page, feedOf([aRun("r1")]));
  assert.equal(statSync(runFile).mtimeMs, old.getTime());
});

test("a side file is rewritten only when its bytes differ", () => {
  const page = freshPage();
  writeDerived(page, feedOf([aRun("r1")]));
  const side = join(sidecarOf(page), "data/t/r1/side.json");
  const old = new Date(2000, 0, 1);
  utimesSync(side, old, old);
  writeDerived(page, feedOf([aRun("r1")]));
  assert.equal(statSync(side).mtimeMs, old.getTime());
  writeDerived(page, feedOf([{ ...aRun("r1"), files: { "side.json": { of: "changed" } } }]));
  assert.deepEqual(JSON.parse(readFileSync(side, "utf8")), { of: "changed" });
});

test("keepRuns keeps the newest N runs, given first, and prunes the older run folders", () => {
  const page = freshPage();
  writeDerived(page, feedOf([aRun("r3"), aRun("r2"), aRun("r1")]));
  writeDerived(page, feedOf([aRun("r4"), aRun("r3"), aRun("r2"), aRun("r1")], undefined, 2));
  assert.deepEqual(readManifest(page).tabs.t.runs.map((r) => r.name), ["r4", "r3"]);
  const data = join(sidecarOf(page), "data/t");
  assert.deepEqual(readdirSync(data).sort(), ["r3", "r4"]);
});

test("a file named only by the previous manifest survives one commit and goes on the next", () => {
  const page = freshPage();
  writeDerived(page, feedOf([aRun("r1")], { prompts: { v: "A" } }));
  const oldShared = join(sidecarOf(page), readManifest(page).shared.prompts.file);
  writeDerived(page, feedOf([aRun("r1")], { prompts: { v: "B" } }));
  assert.ok(existsSync(oldShared));
  writeDerived(page, feedOf([aRun("r1")], { prompts: { v: "B" } }));
  assert.ok(!existsSync(oldShared));
});

test("a name outside the grammar throws and leaves the folder unchanged", () => {
  const page = freshPage();
  writeDerived(page, feedOf([aRun("r1")]));
  const before = listing(sidecarOf(page));
  const manifest = readFileSync(join(sidecarOf(page), "manifest.json"), "utf8");
  for (const bad of ["CON.json", "a.", "bad tab", "../x"]) {
    assert.throws(() => writeDerived(page, feedOf([aRun(bad)])), /bad name/);
    assert.throws(() => writeDerived(page, { tabs: { [bad]: [aRun("r1")] } }), /bad name/);
    assert.throws(() => writeDerived(page, feedOf([aRun("r1")], { [bad]: 1 })), /bad name/);
    assert.throws(() => writeDerived(page, feedOf([{ ...aRun("r1"), files: { [bad]: 1 } }])), /bad name/);
  }
  assert.deepEqual(listing(sidecarOf(page)), before);
  assert.equal(readFileSync(join(sidecarOf(page), "manifest.json"), "utf8"), manifest);
});

test("a stale lock (untouched over 60 s) is taken over", () => {
  const page = freshPage();
  const lock = join(sidecarOf(page), ".lock");
  mkdirSync(sidecarOf(page), { recursive: true });
  writeFileSync(lock, JSON.stringify({ pid: 999999, at: "2000-01-01T00:00:00Z" }));
  const old = new Date(Date.now() - 61_000);
  utimesSync(lock, old, old);
  writeDerived(page, feedOf([aRun("r1")]));
  assert.ok(readManifest(page));
  assert.ok(!existsSync(lock));
});

test("a live lock makes the writer wait until it is released", async () => {
  const page = freshPage();
  const lock = join(sidecarOf(page), ".lock");
  mkdirSync(sidecarOf(page), { recursive: true });
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
  const script = `import { writeDerived } from ${JSON.stringify(pathToFileURL(join(here, "data-folder.mjs")).href)};
writeDerived(${JSON.stringify(page)}, { tabs: { t: [{ name: "r1", run: {} }] } });`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", script], { stdio: "ignore" });
  const exited = new Promise((resolve) => child.on("exit", resolve));
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(readManifest(page), null);
  const { unlinkSync } = await import("node:fs");
  unlinkSync(lock);
  assert.equal(await exited, 0);
  assert.ok(readManifest(page));
});

test("writeDerived on a log sidecar and appendEntry on a derived one throw", () => {
  const log = freshPage();
  appendEntry(log, { a: 1 });
  assert.throws(() => writeDerived(log, feedOf([aRun("r1")])), /never rewritten/);
  const derived = freshPage();
  writeDerived(derived, feedOf([aRun("r1")]));
  assert.throws(() => appendEntry(derived, { a: 1 }), /never appended/);
});

test("log entries are numbered from 1, annotate merges, annotate past the count throws", () => {
  const page = freshPage();
  assert.equal(appendEntry(page, { a: 1 }), 1);
  assert.equal(appendEntry(page, { a: 2 }), 2);
  assert.equal(readManifest(page).count, 2);
  annotate(page, 1, { verdict: "wrong" });
  annotate(page, 1, { proposal: "x" });
  const notes = JSON.parse(readFileSync(join(sidecarOf(page), "data/notes/000001.json"), "utf8"));
  assert.deepEqual(notes, { verdict: "wrong", proposal: "x" });
  assert.deepEqual(readManifest(page).notes, [1]);
  assert.deepEqual(JSON.parse(readFileSync(join(sidecarOf(page), "data/entries/000002.json"), "utf8")), { a: 2 });
  assert.throws(() => annotate(page, 3, {}), /no entry 3/);
  assert.throws(() => annotate(page, 0, {}), /no entry 0/);
});

test("no .lock is left behind, after success or failure", () => {
  const page = freshPage();
  writeDerived(page, feedOf([aRun("r1")]));
  assert.ok(!existsSync(join(sidecarOf(page), ".lock")));
  assert.throws(() => appendEntry(page, {}));
  assert.ok(!existsSync(join(sidecarOf(page), ".lock")));
  const log = freshPage();
  appendEntry(log, {});
  annotate(log, 1, {});
  assert.ok(!existsSync(join(sidecarOf(log), ".lock")));
});

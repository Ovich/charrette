import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli", "index.ts");

let toolRoot: string;

const run = (...argv: string[]) =>
  spawnSync(process.execPath, [CLI, ...argv], {
    encoding: "utf8",
    env: { ...process.env, AIVIEW_ROOT: toolRoot },
  });

const write = (rel: string, content: string): string => {
  const abs = path.join(toolRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
};

beforeEach(() => {
  toolRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-cli-"));
});

afterEach(() => {
  // Windows may briefly hold handles of a just-killed child; a leaked temp dir
  // must not fail the suite.
  for (let i = 0; ; i++) {
    try {
      fs.rmSync(toolRoot, { recursive: true, force: true });
      return;
    } catch {
      if (i >= 5) {
        console.warn(`cleanup: temp dir left behind: ${toolRoot}`);
        return;
      }
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},200)"]);
    }
  }
});

test("status --json reports sqlite path and count", () => {
  const r = run("status", "--json");
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.sqlite, path.join(toolRoot, "aiview.sqlite"));
  assert.equal(out.documents, 0);
});

test("add registers, list shows it, remove drops it", () => {
  const f = write("docs/x.brainstorm.md", "# Board X\n");
  const added = run("add", f, "--tag", "proj");
  assert.equal(added.status, 0, added.stderr);
  assert.match(added.stdout, /#1 {2}brainstorm \[proj\]/);
  assert.match(added.stdout, /Board X/);

  const listed = run("list");
  assert.match(listed.stdout, /Board X/);

  const filtered = run("list", "--kind", "spec");
  assert.equal(filtered.stdout.trim(), "");

  const removed = run("remove", "#1");
  assert.match(removed.stdout, /removed #1/);
  assert.equal(JSON.parse(run("status", "--json").stdout).documents, 0);
});

test("add --group registers membership and shows it", () => {
  const board = write("docs/x.brainstorm.md", "# Board\n");
  const spec = write("docs/x.spec.md", "# Spec\n");
  const r1 = run("add", board, "--group", "topic", "--group-title", "The Topic");
  assert.equal(r1.status, 0, r1.stderr);
  assert.match(r1.stdout, /group:topic/);
  const r2 = run("add", spec, "--group", "topic");
  assert.match(r2.stdout, /group:topic/);
});

test("add without kind fails with the mandatory-kind message", () => {
  const f = write("plain.md", "# T\n");
  const r = run("add", f);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /kind is mandatory/);
});

test("remove of unknown ref reports, exits 0", () => {
  const r = run("remove", "#99");
  assert.equal(r.status, 0);
  assert.match(r.stderr, /not in index/);
});

test("update: kind, tags, group round-trip without remove/re-add", () => {
  const f = write("docs/x.preview.md", "# X\n");
  run("add", f);
  const updated = run("update", "#1", "--kind", "pdf", "--tag", "extra", "--group", "g1", "--group-title", "Group One", "--json");
  assert.equal(updated.status, 0, updated.stderr);
  const d = JSON.parse(updated.stdout);
  assert.equal(d.kind, "pdf");
  assert.ok(d.tags.includes("extra"));
  assert.equal(d.group_slug, "g1");
  const ungrouped = JSON.parse(run("update", "#1", "--untag", "extra", "--ungroup", "--json").stdout);
  assert.equal(ungrouped.group_slug, null);
  assert.ok(!ungrouped.tags.includes("extra"));
});

test("status --json: down, then stale pidfile detected", () => {
  const down = JSON.parse(run("status", "--json").stdout);
  assert.equal(down.server.running, false);
  assert.equal(down.server.stale, false);
  // stale: a pidfile pointing at a dead pid
  fs.writeFileSync(path.join(toolRoot, "aiview.pid"), "999999");
  fs.writeFileSync(path.join(toolRoot, "aiview.port"), "4599");
  const stale = JSON.parse(run("status", "--json").stdout);
  assert.equal(stale.server.running, false);
  assert.equal(stale.server.stale, true);
});

test("open: registers, starts a detached server, second open reuses it", () => {
  const f = write("docs/o.spec.md", "# O\n");
  const first = run("open", f, "--port", "0", "--json");
  assert.equal(first.status, 0, first.stderr);
  const r1 = JSON.parse(first.stdout);
  assert.match(r1.url, /^http:\/\/localhost:\d+\/#doc=1$/);
  assert.equal(r1.server.running, true);
  try {
    const second = run("open", f, "--json");
    const r2 = JSON.parse(second.stdout);
    assert.equal(r2.url, r1.url); // idempotent: same server, same doc, same URL
  } finally {
    const pid = Number(fs.readFileSync(path.join(toolRoot, "aiview.pid"), "utf8"));
    try {
      process.kill(pid);
    } catch {}
    // wait for the process to actually exit so afterEach can delete the temp dir
    const t0 = Date.now();
    for (;;) {
      try {
        process.kill(pid, 0);
      } catch {
        break; // gone
      }
      if (Date.now() - t0 > 5000) break;
      spawnSync(process.execPath, ["-e", "setTimeout(()=>{},100)"]);
    }
  }
});

test("unknown verb prints usage and fails", () => {
  const r = run("frobnicate");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage: aiview/);
});

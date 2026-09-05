import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "cli", "index.ts");

let toolRoot: string;

// AIVIEW_ROOT = where the code/dist would be; CHARRETTE_HOME = where the data goes.
// The suite points both at one temp dir so a run leaves nothing in the real home.
const run = (...argv: string[]) =>
  spawnSync(process.execPath, [CLI, ...argv], {
    encoding: "utf8",
    env: { ...process.env, AIVIEW_ROOT: toolRoot, CHARRETTE_HOME: toolRoot },
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

test("project add creates the record and its docs directory; list shows it", () => {
  const covered = path.join("C:", path.sep, "CIIP");
  const added = run("project", "add", "CIIP", "--title", "CIIP", "--path", covered, "--json");
  assert.equal(added.status, 0, added.stderr);
  const p = JSON.parse(added.stdout);
  assert.equal(p.slug, "CIIP");
  assert.deepEqual(p.paths, [covered]);
  assert.ok(fs.existsSync(path.join(toolRoot, "docs", "CIIP")), "project add makes <docs>/<slug>/");

  const listed = run("project", "list", "--json");
  assert.deepEqual(JSON.parse(listed.stdout).map((x: { slug: string }) => x.slug), ["CIIP"]);
});

test("a document filed under <docs>/<slug>/ takes that project, no flag needed", () => {
  const f = write("docs/CIIP/a.spec.md", "# A\n");
  const d = JSON.parse(run("add", f, "--json").stdout);
  assert.equal(d.project, "CIIP");
});

test("--project overrides where the file sits", () => {
  const f = write("docs/CIIP/b.spec.md", "# B\n");
  assert.equal(JSON.parse(run("add", f, "--project", "Roster", "--json").stdout).project, "Roster");
});

test("use: sets the active project, refuses an unknown one", () => {
  run("project", "add", "CIIP");
  const ok = run("use", "CIIP", "--json");
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).project, "CIIP");
  assert.equal(JSON.parse(run("status", "--json").stdout).project, "CIIP");

  const bad = run("use", "Nope");
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /no such project: Nope/);
  assert.match(bad.stderr, /known: CIIP/);
  // the refusal changed nothing
  assert.equal(JSON.parse(run("status", "--json").stdout).project, "CIIP");
});

test("list scopes to the active project; --all and --project override", () => {
  run("add", write("docs/CIIP/a.spec.md", "# A\n"));
  run("add", write("docs/JOBS/b.spec.md", "# B\n"));
  run("use", "CIIP");

  assert.equal(JSON.parse(run("list", "--json").stdout).length, 1);
  assert.equal(JSON.parse(run("list", "--all", "--json").stdout).length, 2);
  assert.equal(JSON.parse(run("list", "--project", "JOBS", "--json").stdout).length, 1);
});

test("status --json reports where to write, and which project the cwd is in", () => {
  run("project", "add", "CIIP", "--path", toolRoot);
  run("use", "CIIP");
  const s = JSON.parse(run("status", "--json").stdout);
  assert.equal(s.project, "CIIP");
  assert.equal(s.projectDocs, path.join(toolRoot, "docs", "CIIP"));
  // '*' means All projects: write to the docs root itself
  run("use", "*");
  const all = JSON.parse(run("status", "--json").stdout);
  assert.equal(all.project, "*");
  assert.equal(all.projectDocs, path.join(toolRoot, "docs"));
});

test("project rm is refused while documents reference it", () => {
  run("add", write("docs/CIIP/a.spec.md", "# A\n"));
  const refused = run("project", "rm", "CIIP");
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /still has 1 document\./);

  run("remove", "#1");
  const gone = run("project", "rm", "CIIP");
  assert.equal(gone.status, 0, gone.stderr);
  assert.deepEqual(JSON.parse(run("project", "list", "--json").stdout), []);
});

test("move --project refiles a document into another project, file and row together", () => {
  run("project", "add", "CIIP");
  run("project", "add", "Charrette");
  const f = write("docs/CIIP/a.spec.md", "# A\n");
  run("add", f, "--tag", "keep", "--group", "g", "--group-title", "Group G");

  const moved = JSON.parse(run("move", "#1", "--project", "Charrette", "--json").stdout).moved[0];
  assert.equal(moved.project, "Charrette");
  assert.equal(moved.file_path, "docs/Charrette/a.spec.md");
  assert.ok(fs.existsSync(path.join(toolRoot, "docs", "Charrette", "a.spec.md")), "the file moved");
  assert.ok(!fs.existsSync(f), "the original is gone");
  // reclassifying must not cost the metadata that made the document findable
  assert.equal(moved.id, 1);
  assert.ok(moved.tags.includes("keep"));
  assert.equal(moved.group_slug, "g");
});

test("move --project refuses an unknown project rather than inventing one", () => {
  run("project", "add", "CIIP");
  const f = write("docs/CIIP/a.spec.md", "# A\n");
  run("add", f);
  const r = run("move", "#1", "--project", "Ghost");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no such project: Ghost/);
  assert.ok(fs.existsSync(f), "a refused move leaves the file alone");
  assert.equal(JSON.parse(run("list", "--all", "--json").stdout)[0].project, "CIIP");
});

test("bare move pulls a stray back into its own project's directory", () => {
  run("project", "add", "CIIP");
  const stray = write("elsewhere/a.spec.md", "# A\n");
  run("add", stray, "--project", "CIIP");
  const moved = JSON.parse(run("move", "#1", "--json").stdout).moved[0];
  assert.equal(moved.file_path, "docs/CIIP/a.spec.md");
});

test("update --project points at move instead of silently doing nothing", () => {
  run("project", "add", "CIIP");
  run("add", write("docs/CIIP/a.spec.md", "# A\n"));
  const r = run("update", "#1", "--project", "Charrette");
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /use: aiview move #1 --project <slug>/);
});

test("path: the tool joins the location, so no caller ever builds one", () => {
  run("project", "add", "CIIP");
  run("use", "CIIP");

  const p = run("path", "2026-08-25-topic.spec.md", "--json");
  assert.equal(p.status, 0, p.stderr);
  const out = JSON.parse(p.stdout);
  // joined with THIS platform's separator, under THIS machine's home
  assert.equal(out.path, path.join(toolRoot, "docs", "CIIP", "2026-08-25-topic.spec.md"));
  assert.equal(out.dir, path.join(toolRoot, "docs", "CIIP"));
  assert.equal(out.project, "CIIP");
  assert.ok(fs.existsSync(out.dir), "the directory is ready to be written into");

  // a caller that passes a path by mistake still gets a correctly located file
  assert.equal(
    JSON.parse(run("path", "some/wrong/place/2026-08-25-topic.spec.md", "--json").stdout).path,
    out.path,
  );

  // --project targets another project without switching the active one
  run("project", "add", "JOBS");
  assert.equal(
    JSON.parse(run("path", "x.spec.md", "--project", "JOBS", "--json").stdout).dir,
    path.join(toolRoot, "docs", "JOBS"),
  );
  assert.equal(JSON.parse(run("status", "--json").stdout).project, "CIIP");
});

test("path refuses when there is nothing to resolve against", () => {
  const noActive = run("path", "x.spec.md");
  assert.notEqual(noActive.status, 0);
  assert.match(noActive.stderr, /no active project/);

  run("project", "add", "CIIP");
  const ghost = run("path", "x.spec.md", "--project", "Ghost");
  assert.notEqual(ghost.status, 0);
  assert.match(ghost.stderr, /no such project: Ghost/);
});

test("components: what a mockup offers and pulls; check: whether a host resolves", () => {
  const tools = write(
    "docs/JOBS/tools.mockup.html",
    `<html><body><div data-component="Pill" onclick="x()">p</div><span data-component="Dot">.</span><div data-bind="other.html#Thing"></div></body></html>`,
  );
  const r = run("components", tools, "--json");
  assert.equal(r.status, 0, r.stderr);
  const c = JSON.parse(r.stdout);
  assert.deepEqual(c.offers.map((o: { name: string }) => o.name), ["Pill", "Dot"]);
  assert.deepEqual(c.offers[0].warnings, ["root carries inline handler onclick"]);
  assert.deepEqual(c.pulls, [{ ref: "other.html#Thing", file: "other.html", name: "Thing" }]);
  const text = run("components", tools).stdout;
  assert.match(text, /offers\s+Pill\s+<div>\s+!! root carries inline handler onclick/);
  assert.match(text, /pulls\s+Thing\s+from other\.html/);

  const good = write("docs/JOBS/host.mockup.html", `<html><body><div data-bind="tools.mockup.html#Dot"></div></body></html>`);
  const ok = run("check", good, "--json");
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(JSON.parse(ok.stdout), { file: "host.mockup.html", bound: 1, sources: ["tools.mockup.html"], errors: [], warnings: [] });
  assert.match(run("check", good).stdout, /1 bound from 1 source: tools\.mockup\.html\s+ok/);

  const bad = write("docs/JOBS/bad.mockup.html", `<html><body><div data-bind="tools.mockup.html#Nope"></div><div data-bind="missing.html#A"></div></body></html>`);
  const fail = run("check", bad);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /error\s+tools\.mockup\.html#Nope: Component Nope not in tools\.mockup\.html/);
  assert.match(fail.stdout, /error\s+missing\.html#A: Not found: missing\.html/);

  assert.equal(run("check", path.join(toolRoot, "nope.html")).status, 1);
  assert.equal(run("components", write("docs/x.md", "# md")).status, 1);
});

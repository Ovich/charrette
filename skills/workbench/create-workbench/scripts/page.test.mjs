import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = import.meta.dirname;
const runPage = (page, ...args) =>
  spawnSync(process.execPath, [join(here, "page.mjs"), page, ...args], { encoding: "utf8" });
const freshPath = () => join(mkdtempSync(join(tmpdir(), "bench-")), "2026-01-01-probe.workbench.html");

test("page.mjs writes a self-contained page, no data block, the bench-code block before </body>", () => {
  const page = freshPath();
  assert.equal(runPage(page, "--label", "Probe <bench>").status, 0);
  const html = readFileSync(page, "utf8");
  assert.match(html, /<span class="bench-label">Probe &lt;bench&gt;<\/span>/);
  assert.doesNotMatch(html, /<script id="data"/);
  assert.match(html, /<style data-basecoat>/);
  assert.match(html, /<script data-basecoat>/);
  assert.match(html, /<script data-json-tree>/);
  assert.match(html, /<script data-bench>/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=/i);
  assert.match(html, /<!-- bench-code -->[\s\S]*<!-- \/bench-code -->\s*<\/body>/);
});

test("page.mjs refuses to overwrite without --replace", () => {
  const page = freshPath();
  runPage(page, "--label", "A");
  const before = readFileSync(page, "utf8");
  assert.notEqual(runPage(page, "--label", "B").status, 0);
  assert.equal(readFileSync(page, "utf8"), before);
});

test("--replace remakes the page and keeps the bench-code block verbatim", () => {
  const page = freshPath();
  runPage(page, "--label", "A");
  const mine = "<!-- bench-code -->\n<script>/* mine */</script>\n<!-- /bench-code -->";
  writeFileSync(page, readFileSync(page, "utf8").replace(/<!-- bench-code -->[\s\S]*?<!-- \/bench-code -->/, mine));
  assert.equal(runPage(page, "--label", "B", "--replace").status, 0);
  const html = readFileSync(page, "utf8");
  assert.ok(html.includes(mine));
  assert.match(html, /<title>B<\/title>/);
});

test("--replace refuses a page without a bench-code block", () => {
  const page = freshPath();
  writeFileSync(page, "<html><body>old</body></html>");
  assert.notEqual(runPage(page, "--label", "B", "--replace").status, 0);
  assert.equal(readFileSync(page, "utf8"), "<html><body>old</body></html>");
});

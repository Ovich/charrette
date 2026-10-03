import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { annotate, appendEntry, readData, writeData } from "./data-block.mjs";

const here = import.meta.dirname;
const fresh = () => {
  const page = join(mkdtempSync(join(tmpdir(), "bench-")), "2026-01-01-probe.workbench.html");
  execFileSync(process.execPath, [join(here, "page.mjs"), page, "--label", "Probe <bench>"]);
  return page;
};

test("page.mjs writes a self-contained page opening on the label, and refuses to overwrite", () => {
  const page = fresh();
  const html = readFileSync(page, "utf8");
  assert.match(html, /<span class="bench-label">Probe &lt;bench&gt;<\/span>/);
  assert.match(html, /<style data-basecoat>/);
  assert.doesNotMatch(html, /<script src=|<link [^>]*href="http/);
  assert.equal(readData(page), null);
  assert.throws(() => execFileSync(process.execPath, [join(here, "page.mjs"), page, "--label", "x"], { stdio: "pipe" }));
});

test("a derived feed rewrites the block, and data cannot close the script", () => {
  const page = fresh();
  writeData(page, { answer: "</script><b>raw</b>" });
  writeData(page, { answer: "second" });
  assert.deepEqual(readData(page), { answer: "second" });
  writeData(page, { answer: "</script><b>raw</b>" });
  assert.equal(readFileSync(page, "utf8").match(/<\/script>/g).length, 3);
  assert.equal(readData(page).answer, "</script><b>raw</b>");
});

test("a log feed appends entries as given, notes beside them, and is never rewritten", () => {
  const page = fresh();
  const request = { messages: [{ role: "user", content: "as sent" }] };
  assert.equal(appendEntry(page, request), 0);
  assert.equal(appendEntry(page, { second: true }), 1);
  annotate(page, 0, { verdict: "wrong" });
  const log = readData(page);
  assert.deepEqual(log.entries[0].entry, request);
  assert.deepEqual(log.entries[0].notes, { verdict: "wrong" });
  assert.throws(() => writeData(page, {}), /never rewritten/);
  assert.throws(() => annotate(page, 7, {}), /no entry 7/);
});

test("a page without a data block fails loudly", () => {
  const page = join(mkdtempSync(join(tmpdir(), "bench-")), "x.workbench.html");
  writeFileSync(page, "<html></html>");
  assert.throws(() => readData(page), /no <script id="data"/);
});

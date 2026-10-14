import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { annotate, appendEntry, readData, writeData } from "./data-block.mjs";

// data-block.mjs stays for pages made before the sidecar (D13, US4): its tests build an
// old-shape page themselves, page.mjs no longer writes a data block.
const fresh = () => {
  const page = join(mkdtempSync(join(tmpdir(), "bench-")), "2026-01-01-probe.workbench.html");
  writeFileSync(page, '<!doctype html><html><body><script id="data" type="application/json">null</script></body></html>');
  return page;
};

test("an old-shape page reads its empty block as null", () => {
  assert.equal(readData(fresh()), null);
});

test("a derived feed rewrites the block, and data cannot close the script", () => {
  const page = fresh();
  writeData(page, { answer: "</script><b>raw</b>" });
  writeData(page, { answer: "second" });
  assert.deepEqual(readData(page), { answer: "second" });
  writeData(page, { answer: "</script><b>raw</b>" });
  const block = readFileSync(page, "utf8").match(/<script id="data" type="application\/json">([\s\S]*?)<\/script>/)[1];
  assert.doesNotMatch(block, /<\/script/i);
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

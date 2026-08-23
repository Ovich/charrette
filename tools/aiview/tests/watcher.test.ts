import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DocWatcher, type ChangedEvent } from "../src/core/watcher.ts";

const waitFor = <T>(check: () => T | undefined, timeoutMs = 3000): Promise<T> =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const v = check();
      if (v !== undefined) return resolve(v);
      if (Date.now() - t0 > timeoutMs) return reject(new Error("timed out"));
      setTimeout(tick, 25);
    };
    tick();
  });

test("emits one debounced changed event for a watched doc", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-watch-"));
  const file = path.join(tmp, "doc.spec.md");
  fs.writeFileSync(file, "# v1\n");
  const doc = { id: 7, abs_path: file };
  const events: ChangedEvent[] = [];
  const watcher = new DocWatcher((dir, name) =>
    path.join(dir, name) === file ? doc : undefined,
  );
  watcher.on("changed", (e: ChangedEvent) => events.push(e));
  try {
    watcher.ensureWatch(doc);
    // burst of writes -> debounced to (at least) one event, all for id 7
    fs.writeFileSync(file, "# v2\n");
    fs.writeFileSync(file, "# v3\n");
    const first = await waitFor(() => events[0]);
    assert.equal(first.id, 7);
    assert.ok(events.every((e) => e.id === 7));
  } finally {
    watcher.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("unrelated files in the same dir emit nothing", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aiview-watch2-"));
  const file = path.join(tmp, "doc.spec.md");
  fs.writeFileSync(file, "# v1\n");
  const doc = { id: 1, abs_path: file };
  const events: ChangedEvent[] = [];
  const watcher = new DocWatcher((dir, name) =>
    path.join(dir, name) === file ? doc : undefined,
  );
  watcher.on("changed", (e: ChangedEvent) => events.push(e));
  try {
    watcher.ensureWatch(doc);
    fs.writeFileSync(path.join(tmp, "other.txt"), "x");
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(events.length, 0);
  } finally {
    watcher.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

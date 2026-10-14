// The bench loader (`assets/bench/bench.js`) in a stubbed window, driven through `window.bench`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(import.meta.dirname, "../assets/bench/bench.js"), "utf8");

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
    this.textContent = "";
    this.className = "";
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  hasAttribute(k) { return k in this.attrs; }
  replaceChildren(...nodes) { this.children = nodes; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener() {}
}

/** A fresh loader over `files` (path -> value, or a number for a status), counting fetches. */
function load(files, { bridge = true, state } = {}) {
  const fetches = [];
  const listeners = {};
  const window = {
    aiview: bridge ? { bridge: true, state: state ?? {} } : undefined,
    addEventListener: (type, cb) => { (listeners[type] ??= []).push(cb); },
  };
  const document = { createElement: (tag) => new FakeElement(tag) };
  const fetch = async (path) => {
    fetches.push(path);
    const value = typeof files === "function" ? files(path) : files[path];
    if (value === undefined || typeof value === "number") {
      return { ok: false, status: value ?? 404, text: async () => "" };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify(value) };
  };
  new Function("window", "document", "fetch", source)(window, document, fetch);
  const dispatch = (type) => Promise.all((listeners[type] ?? []).map((cb) => cb()));
  return { bench: window.bench, fetches, window, dispatch };
}

const manifestWith = (runFile) => ({
  schema: 1, kind: "derived", shared: {},
  tabs: { t: { runs: [{ name: "r1", file: runFile, bytes: 10, files: ["side.json"] }] } },
});

test("no bridge: the view shows the named error and sets data-error", async () => {
  const { bench } = load({}, { bridge: false });
  const el = new FakeElement("div");
  await bench.view(el, "Output", async () => new FakeElement("p"));
  assert.match(el.children[0].textContent, /this aiview predates sidecar benches, update the plugin/);
  assert.ok(el.hasAttribute("data-error"));
  assert.ok(!el.hasAttribute("data-ready"));
});

test("manifest 404: the view says no data yet, run the feed", async () => {
  const { bench } = load({});
  const el = new FakeElement("div");
  await bench.view(el, "Output", async () => (await bench.manifest(), new FakeElement("p")));
  assert.match(el.children[0].textContent, /no data yet: run the feed/);
  assert.equal(el.attrs["data-error"], "404");
});

test("a run 404 re-reads the manifest and retries once", async () => {
  let manifestReads = 0;
  const { bench } = load((path) => {
    if (path === "manifest.json") return manifestWith(++manifestReads === 1 ? "data/t/r1/run.old.json" : "data/t/r1/run.new.json");
    if (path === "data/t/r1/run.new.json") return { v: "new" };
    return 404;
  });
  assert.deepEqual(await bench.run("t", "r1"), { v: "new" });
  assert.equal(manifestReads, 2);
});

test("a run still 404 after the retry names its path and status", async () => {
  const { bench, fetches } = load({ "manifest.json": manifestWith("data/t/r1/run.gone.json") });
  const el = new FakeElement("div");
  await bench.view(el, "Output", async () => (await bench.run("t", "r1"), new FakeElement("p")));
  assert.match(el.children[0].textContent, /data\/t\/r1\/run\.gone\.json/);
  assert.match(el.children[0].textContent, /404/);
  assert.equal(fetches.filter((p) => p === "data/t/r1/run.gone.json").length, 2);
});

test("a run is cached by file name: two calls, one fetch", async () => {
  const { bench, fetches } = load({ "manifest.json": manifestWith("data/t/r1/run.a.json"), "data/t/r1/run.a.json": { v: 1 } });
  await bench.run("t", "r1");
  await bench.run("t", "r1");
  assert.equal(fetches.filter((p) => p === "data/t/r1/run.a.json").length, 1);
});

test("a side file is dropped when its run's file changes", async () => {
  let runFile = "data/t/r1/run.a.json";
  let sideValue = { side: 1 };
  const { bench, fetches, dispatch } = load((path) => {
    if (path === "manifest.json") return manifestWith(runFile);
    if (path === "data/t/r1/side.json") return sideValue;
    return { run: path };
  });
  assert.deepEqual(await bench.file("t", "r1", "side.json"), { side: 1 });
  await bench.file("t", "r1", "side.json");
  assert.equal(fetches.filter((p) => p === "data/t/r1/side.json").length, 1);
  runFile = "data/t/r1/run.b.json";
  sideValue = { side: 2 };
  await dispatch("aiview:data-changed");
  assert.deepEqual(await bench.file("t", "r1", "side.json"), { side: 2 });
  assert.equal(fetches.filter((p) => p === "data/t/r1/side.json").length, 2);
});

test("data-ready is set once the view is drawn", async () => {
  const { bench } = load({});
  const el = new FakeElement("div");
  const node = new FakeElement("p");
  await bench.view(el, "Output", async () => node);
  assert.equal(el.children[0], node);
  assert.ok(el.hasAttribute("data-ready"));
  assert.ok(!el.hasAttribute("data-error"));
});

test("text over 256 KB is folded with its size", () => {
  const { bench } = load({});
  assert.equal(bench.text("short").tag, "pre");
  const folded = bench.text("x".repeat(300 * 1024));
  assert.equal(folded.tag, "details");
  assert.match(folded.children[0].textContent, /300 KB/);
});

test("bench.state gets and sets through window.aiview.state", () => {
  const state = { place: "r2" };
  const { bench } = load({}, { state });
  assert.equal(bench.state.get("place"), "r2");
  assert.equal(bench.state.get("missing"), null);
  bench.state.set("place", "r3");
  assert.equal(state.place, "r3");
});

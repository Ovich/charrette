import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.DOMPurify = undefined;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle;

const { default: mermaid } = await import("mermaid");
mermaid.initialize({ startOnLoad: false, suppressErrorRendering: true });

const file = process.argv[2];
const src = fs.readFileSync(file, "utf8");
const blocks = [...src.matchAll(/```mermaid\n([\s\S]*?)```/g)];
console.log(`${blocks.length} mermaid blocks in ${file}\n`);

let bad = 0;
for (const [i, m] of blocks.entries()) {
  const code = m[1];
  const line = src.slice(0, m.index).split("\n").length;
  try {
    await mermaid.parse(code);
    console.log(`  #${i + 1} (line ${line}): OK`);
  } catch (e) {
    bad++;
    console.log(`  #${i + 1} (line ${line}): FAIL\n      ${String(e.message).split("\n").slice(0, 6).join("\n      ")}`);
  }
}
process.exit(bad ? 1 : 0);

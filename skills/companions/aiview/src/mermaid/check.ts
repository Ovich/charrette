// Mermaid parsing in Node, for the `mermaid-check` verb. Mermaid's parsers need a
// window and a document to exist at import time; nothing is rendered here, so a few
// inert objects are enough, and DOMPurify is replaced by a stub at bundle time (see
// build.mjs). This module is bundled on its own (dist-cli/mermaid-check.mjs, about
// 3.5 MB) and loaded by the CLI only when the verb runs.
/* eslint-disable @typescript-eslint/no-explicit-any */
const noop = (): void => {};
const el = (): any => ({
  setAttribute: noop, getAttribute: () => null, appendChild: noop, removeChild: noop, insertBefore: noop,
  style: {}, classList: { add: noop, remove: noop }, querySelector: () => null, querySelectorAll: () => [],
  addEventListener: noop, removeEventListener: noop, getBoundingClientRect: () => ({ width: 0, height: 0 }),
  innerHTML: "", textContent: "", ownerDocument: null,
});
const g = globalThis as any;
if (typeof g.window === "undefined") {
  g.window = g;
  g.addEventListener = noop; g.removeEventListener = noop;
  g.matchMedia = () => ({ matches: false, addEventListener: noop });
  g.document = {
    createElement: el, createElementNS: el, createTextNode: () => ({}), createDocumentFragment: el,
    body: el(), head: el(), documentElement: el(),
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    addEventListener: noop, removeEventListener: noop,
    implementation: { createHTMLDocument: () => ({ body: el() }) },
  };
  if (typeof g.navigator === "undefined") Object.defineProperty(g, "navigator", { value: { userAgent: "node" }, configurable: true });
  g.DOMParser = class { parseFromString() { return { body: el(), documentElement: el() }; } };
  g.Element = class {}; g.HTMLElement = class {}; g.Node = class {}; g.SVGElement = class {}; g.Text = class {};
  g.location = { href: "http://localhost/", protocol: "http:" };
  g.requestAnimationFrame = (f: () => void) => setTimeout(f, 0);
}

import mermaid from "mermaid";
mermaid.initialize({ startOnLoad: false });

export interface Block {
  /** 1-based line of the opening fence in the file (1 for a bare .mmd). */
  line: number;
  text: string;
}

export interface BlockResult {
  line: number;
  ok: boolean;
  type?: string;
  error?: string;
}

/** The mermaid blocks of a document: fenced ```mermaid in Markdown, the whole file otherwise. */
export function blocksOf(content: string, markdown: boolean): Block[] {
  if (!markdown) return [{ line: 1, text: content }];
  const blocks: Block[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*```\s*mermaid\b/.test(lines[i])) continue;
    const start = i;
    const body: string[] = [];
    for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) body.push(lines[i]);
    blocks.push({ line: start + 1, text: body.join("\n") });
  }
  return blocks;
}

export async function checkBlock(text: string): Promise<{ ok: boolean; type?: string; error?: string }> {
  try {
    const r = await mermaid.parse(text);
    return { ok: true, type: r?.diagramType };
  } catch (e) {
    const msg = String((e as Error).message ?? e).split("\n").filter((l) => l.trim()).slice(0, 2).join(" | ");
    return { ok: false, error: msg };
  }
}

export async function checkBlocks(blocks: Block[]): Promise<BlockResult[]> {
  const out: BlockResult[] = [];
  for (const b of blocks) out.push({ line: b.line, ...(await checkBlock(b.text)) });
  return out;
}

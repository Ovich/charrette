// Discipline warnings for mermaid blocks (write-diagrams skill): a caption above
// every fence, and labels on the arrows leaving a node that branches. Text only,
// no Mermaid import, so it ships in the CLI bundle and runs whether or not the
// parser bundle is built.

/** The caption is the nearest non-blank line above the fence. A heading, a fence,
 *  a table row or a list marker is not one. */
export function captionWarning(lines: string[], fenceLine: number): string | undefined {
  for (let i = fenceLine - 2; i >= 0; i--) {
    const l = lines[i].trim();
    if (!l) continue;
    if (/^#{1,6}\s/.test(l) || /^```/.test(l) || /^\|/.test(l) || /^---+$/.test(l)) break;
    return undefined;
  }
  return "no caption above the fence: one line naming the diagram's type and the question it answers";
}

const SKIP = /^\s*(subgraph\b|end\b|classDef\b|class\b|style\b|linkStyle\b|click\b|direction\b|flowchart\b|graph\b|%%)/;
const SHAPES = /\[\[.*?\]\]|\[\(.*?\)\]|\(\(.*?\)\)|\{\{.*?\}\}|\[.*?\]|\(.*?\)|\{.*?\}|(?<=\w)>[^\]]*\]/g;
// An edge with an inline label (-- text -->, -. text .->, == text ==>), or an arrow
// optionally followed by a |label|.
const EDGE = /(-{2,}\s*[^-|>\s][^>]*?-{2,}>|-\.+\s*[^.|>\s][^>]*?\.+->|={2,}\s*[^=|>\s][^>]*?={2,}>|(?:<?-{2,}>|<?-\.+->|<?={2,}>|-{3,}|-\.+-|={3,}|--[ox]|[ox]--)(?:\s*\|[^|]*\|)?)/g;

/** Nodes with two or more outgoing arrows where one of those arrows carries no label. */
export function forkWarning(text: string): string | undefined {
  const head = text.trim().split("\n")[0] ?? "";
  if (!/^\s*(flowchart|graph)\b/.test(head)) return undefined;
  const out = new Map<string, { total: number; unlabeled: number }>();
  for (const raw of text.split("\n")) {
    if (SKIP.test(raw) || !raw.trim()) continue;
    const line = raw.replace(SHAPES, "").replace(/:::\w+/g, "");
    const parts = line.split(EDGE);
    if (parts.length < 3) continue;
    for (let i = 1; i < parts.length; i += 2) {
      const edge = parts[i];
      const labeled = /\|[^|]*\|/.test(edge) || /^(-{2,}|-\.+|={2,})\s*[^-.=|>\s]/.test(edge);
      const sources = parts[i - 1].split("&").map((s) => s.trim()).filter((s) => /^[\w.-]+$/.test(s));
      for (const s of sources) {
        const c = out.get(s) ?? { total: 0, unlabeled: 0 };
        c.total++;
        if (!labeled) c.unlabeled++;
        out.set(s, c);
      }
    }
  }
  const bad = [...out].filter(([, c]) => c.total >= 2 && c.unlabeled > 0);
  if (!bad.length) return undefined;
  return bad
    .map(([n, c]) => (c.unlabeled === c.total ? `${n} branches (${c.total} arrows) and none carries a label` : `${n} branches (${c.total} arrows) and ${c.unlabeled} of them ${c.unlabeled === 1 ? "carries" : "carry"} no label`))
    .join("; ");
}

/** Every discipline warning for one block. */
export function disciplineWarnings(lines: string[], fenceLine: number, text: string, markdown: boolean): string[] {
  const w: string[] = [];
  if (markdown) {
    const c = captionWarning(lines, fenceLine);
    if (c) w.push(c);
  }
  const f = forkWarning(text);
  if (f) w.push(f);
  return w;
}

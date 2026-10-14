export type Segment = { type: "text"; text: string } | { type: "mermaid"; source: string };

// An opening fence: three backticks and the `mermaid` info string, alone on its line.
const OPEN = /^```[ \t]*mermaid[ \t]*$/i;
const CLOSE = /^```[ \t]*$/;

/** A body split on fenced ```mermaid blocks, in order; an unclosed fence stays text. */
export function segments(body: string): Segment[] {
  const lines = body.split("\n");
  const out: Segment[] = [];
  let text: string[] = [];
  const flushText = () => {
    const joined = text.join("\n");
    if (joined.trim()) out.push({ type: "text", text: joined.replace(/^\n+|\n+$/g, "") });
    text = [];
  };
  for (let i = 0; i < lines.length; i++) {
    if (!OPEN.test(lines[i].trim())) {
      text.push(lines[i]);
      continue;
    }
    const end = lines.findIndex((l, j) => j > i && CLOSE.test(l.trim()));
    if (end < 0) {
      text.push(...lines.slice(i));
      break;
    }
    flushText();
    out.push({ type: "mermaid", source: lines.slice(i + 1, end).join("\n") });
    i = end;
  }
  flushText();
  return out;
}

/** A `#<n>` reference: not glued to a word before it, digits only after. */
export const SEQ_REF = /(?<![\w#])#(\d+)(?![\w])/g;

/** The `#<n>` references in a text, as seqs, in order. */
export function seqRefs(text: string): number[] {
  return [...text.matchAll(SEQ_REF)].map((m) => Number(m[1]));
}

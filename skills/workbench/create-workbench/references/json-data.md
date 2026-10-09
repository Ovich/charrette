# JSON on a bench

Read when the bench shows JSON the project produced: a model request or reply, a stored
document, an event, a tool's input.

**JSON is shown as a tree that folds and unfolds node by node, never as a `<pre>` dump or as
a list of the page's own making.** The person reads the data as the project wrote it, opens
only the branch they care about, and sees at a glance how big each part is (a context sent to
a model is often mostly one key).

- Each object and array is a `<details>`: its key, its count (`{6}`, `[3]`) and its size in
  characters on the summary line. The top level starts open, the rest folded.
- Each primitive is its raw JSON (`JSON.stringify`), in full, wrapped: strings and numbers
  coloured by type so they read apart from keys.
- The colours are Basecoat's tokens, with the type colours redefined under `.dark`: the
  tree reads in light and in dark alike.
- A message whose content is a JSON string (a chat message, a tool's arguments) is parsed
  first and shown as the tree; text that is not JSON stays text.

## The reader

Placed in the bench's code once, used wherever JSON is shown: `jsonTree(value, { open: 1 })`.

```js
/** A JSON value as a tree: objects and arrays fold, `open` levels start unfolded. */
const jsonTree = (value, { open = 1, label = null } = {}) => {
  const node = (tag, className, children) => {
    const made = document.createElement(tag);
    if (className) made.className = className;
    for (const child of children) if (child !== null) made.append(child);
    return made;
  };
  const text = (className, words) => node("span", className, [String(words)]);
  const tree = (value, key, depth) => {
    const name = key === null ? null : text("jt-key", `${key}: `);
    if (value === null || typeof value !== "object") {
      return node("div", "jt-leaf", [name, text(`jt-${value === null ? "null" : typeof value}`, JSON.stringify(value))]);
    }
    const entries = Array.isArray(value) ? value.map((each, at) => [at, each]) : Object.entries(value);
    const fold = node("details", "jt-node", [
      node("summary", null, [
        name,
        text("jt-count", Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`),
        text("jt-size", `${JSON.stringify(value).length.toLocaleString()} chars`),
      ]),
      node("div", "jt-kids", entries.map(([k, v]) => tree(v, k, depth + 1))),
    ]);
    if (depth < open) fold.open = true;
    return fold;
  };
  return node("div", "json-tree", [tree(value, label, 0)]);
};
```

```css
.json-tree { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.5; }
.json-tree .jt-node > summary { display: flex; gap: 6px; cursor: pointer; padding: 1px 0; }
.json-tree .jt-size { margin-left: auto; color: var(--muted-foreground); }
.json-tree .jt-kids { padding-left: 14px; margin-left: 3px; border-left: 1px solid var(--border); }
.json-tree .jt-leaf { padding: 1px 0; white-space: pre-wrap; word-break: break-word; }
.json-tree .jt-key, .json-tree .jt-count, .json-tree .jt-null { color: var(--muted-foreground); }
.json-tree .jt-string { color: #15803d; }
.json-tree .jt-number, .json-tree .jt-boolean { color: #b45309; }
.dark .json-tree .jt-string { color: #86efac; }
.dark .json-tree .jt-number, .dark .json-tree .jt-boolean { color: #fbbf24; }
```

## Where it goes

- **A model call** (a trace, a prompt view): the system prompt as text, folded under its file
  name; the message the node was sent as the tree; the tools it was offered and whether it
  answered in a response format, on one line under it.
- **A reply or a stored document**: the tree, the top level open.
- **Beside a rendering** (the document drawn as the product draws it): the tree under a
  "raw" fold, so the rendering leads and the data stays one click away.

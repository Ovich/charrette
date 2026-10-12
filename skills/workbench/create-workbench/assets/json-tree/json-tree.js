// The JSON reader every bench page carries, inlined by page.mjs: `jsonTree(value, { open, label })`
// returns the value as a tree whose objects and arrays fold, with its toolbar on top of it:
// Fold all, Unfold all, Unfold 2 levels, Copy. The toolbar sticks while the tree scrolls.
const jsonTree = (value, { open = 1, label = null } = {}) => {
  const node = (tag, className, children = []) => {
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
    fold.dataset.depth = depth;
    fold.open = depth < open;
    return fold;
  };
  const body = node("div", "jt-body", [tree(value, label, 0)]);
  const unfoldTo = (levels) => body.querySelectorAll("details").forEach((d) => (d.open = Number(d.dataset.depth) < levels));
  const button = (words, act) => {
    const made = node("button", "btn", [words]);
    made.type = "button";
    made.dataset.variant = "outline";
    made.dataset.size = "sm";
    made.addEventListener("click", () => act(made));
    return made;
  };
  const copy = async (made) => {
    const json = JSON.stringify(value, null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // aiview frames the page, and a frame may be refused the clipboard API.
      const area = node("textarea");
      area.value = json;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    made.textContent = "Copied";
    setTimeout(() => (made.textContent = "Copy"), 1200);
  };
  const bar = node("div", "jt-bar", [
    button("Fold all", () => unfoldTo(0)),
    button("Unfold all", () => unfoldTo(Infinity)),
    button("Unfold 2 levels", () => unfoldTo(2)),
    button("Copy", copy),
  ]);
  return node("div", "json-tree", [bar, body]);
};

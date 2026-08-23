import { useMemo, useState } from "react";
import type { DocumentWithState } from "../lib/api.ts";

export interface Filters {
  query: string;
  kinds: Set<string>;
  tags: Set<string>;
}

/** Pure so the component tests can hit it directly. */
export function applyFilters(docs: DocumentWithState[], f: Filters): DocumentWithState[] {
  const q = f.query.toLowerCase();
  return docs.filter(
    (d) =>
      (f.kinds.size === 0 || f.kinds.has(d.kind)) &&
      [...f.tags].every((t) => d.tags.includes(t)) &&
      (!q || (d.title ?? "").toLowerCase().includes(q) || d.file_path.toLowerCase().includes(q)),
  );
}

export function useFilters(docs: DocumentWithState[]) {
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<Set<string>>(new Set());
  const [tags, setTags] = useState<Set<string>>(new Set());

  const allKinds = useMemo(() => [...new Set(docs.map((d) => d.kind))].sort(), [docs]);
  const allTags = useMemo(() => [...new Set(docs.flatMap((d) => d.tags))].sort(), [docs]);
  const shown = useMemo(() => applyFilters(docs, { query, kinds, tags }), [docs, query, kinds, tags]);

  const toggle = (set: Set<string>, v: string) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    return next;
  };

  return {
    query,
    setQuery,
    kinds,
    tags,
    allKinds,
    allTags,
    shown,
    toggleKind: (k: string) => setKinds((s) => toggle(s, k)),
    toggleTag: (t: string) => setTags((s) => toggle(s, t)),
  };
}

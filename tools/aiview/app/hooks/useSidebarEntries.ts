import type { DocumentWithState } from "../lib/api.ts";

export type SidebarEntry =
  | { type: "doc"; doc: DocumentWithState }
  | { type: "group"; slug: string; title: string; docs: DocumentWithState[] };

/** Sidebar order (pure, tested):
 *  - grouped docs collapse into one container entry per group
 *  - members inside a group read oldest-first (the board that started it on top)
 *  - every entry sorts by its latest member activity (last_seen_at), newest first —
 *    an active group floats up */
export function sidebarEntries(
  docs: DocumentWithState[],
  groups: Record<string, string>,
): SidebarEntry[] {
  const byGroup = new Map<string, DocumentWithState[]>();
  const flat: DocumentWithState[] = [];
  for (const d of docs) {
    if (d.group_slug) {
      const list = byGroup.get(d.group_slug) ?? [];
      list.push(d);
      byGroup.set(d.group_slug, list);
    } else {
      flat.push(d);
    }
  }
  const entries: SidebarEntry[] = flat.map((doc) => ({ type: "doc", doc }));
  for (const [slug, members] of byGroup) {
    members.sort((a, b) => a.created_at.localeCompare(b.created_at));
    entries.push({ type: "group", slug, title: groups[slug] ?? slug, docs: members });
  }
  const activity = (e: SidebarEntry): string =>
    e.type === "doc" ? e.doc.last_seen_at : e.docs.reduce((m, d) => (d.last_seen_at > m ? d.last_seen_at : m), "");
  return entries.sort((a, b) => activity(b).localeCompare(activity(a)));
}

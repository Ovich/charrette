// The lines `end` and `merge-lock` print for files written without a claim (D72): more than
// COLLAPSE_OVER paths in one folder print as one line; the store's flags are untouched.
export const COLLAPSE_OVER = 20;

/** `reconciled <path>` per path, a folder holding more than COLLAPSE_OVER of them as one line. */
export function unclaimedLines(paths: string[]): string[] {
  const folderOf = (p: string): string => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ".");
  const byFolder = new Map<string, string[]>();
  for (const p of paths) byFolder.set(folderOf(p), [...(byFolder.get(folderOf(p)) ?? []), p]);
  const lines: string[] = [];
  const told = new Set<string>();
  for (const p of paths) {
    const folder = folderOf(p);
    const inFolder = byFolder.get(folder)!;
    if (inFolder.length <= COLLAPSE_OVER) lines.push(`reconciled ${p}: written without a claim`);
    else if (!told.has(folder)) {
      told.add(folder);
      lines.push(`${inFolder.length} files under ${folder}/ written unclaimed`);
    }
  }
  return lines;
}

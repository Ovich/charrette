// What a member's rebase met (D3, board D8): the files git could not combine by itself when the
// branch was rebased after the merge lock was granted. Read-only, in the member's worktree: the
// reflog gives the head before the rebase and the commit it started onto, and one
// `merge-tree --write-tree` replays them. Never throws; what git cannot answer is an unknown.
import { git, gitAnswer } from "./git.ts";

/** Known (`files`, repository-relative, maybe none) or unknown, and why (board D13). */
export type Conflicts = { files: string[] } | { unknown: "old-git" | "no-reflog" };

/** `merge-tree --write-tree` came with git 2.38. */
const MERGE_TREE_SINCE: [number, number] = [2, 38];

/** A reflog entry that starts a rebase: `rebase (start)`, `rebase -i (start)`, `pull --rebase (start)`. */
const REBASE_START = /^(?:pull --)?rebase(?: -[a-z]+)? \(start\):/;

function gitHasMergeTree(worktree: string): boolean {
  const m = (git(worktree, "version") ?? "").match(/(\d+)\.(\d+)/);
  if (!m) return false;
  const [major, minor] = [Number(m[1]), Number(m[2])];
  return major > MERGE_TREE_SINCE[0] || (major === MERGE_TREE_SINCE[0] && minor >= MERGE_TREE_SINCE[1]);
}

type ReflogEntry = { commit: string; atSeconds: number; subject: string };

/** HEAD's reflog in the worktree, newest first; null when it cannot be read. */
function headReflog(worktree: string): ReflogEntry[] | null {
  const r = gitAnswer(worktree, "reflog", "show", "--date=unix", "--format=%H%x09%gd%x09%gs", "HEAD");
  if (r.status !== 0) return null;
  const entries: ReflogEntry[] = [];
  for (const line of r.stdout.split(/\r?\n/)) {
    if (!line) continue;
    const [commit, selector, ...subject] = line.split("\t");
    const at = selector?.match(/\{(\d+)\}/);
    if (!commit || !at) return null;
    entries.push({ commit, atSeconds: Number(at[1]), subject: subject.join("\t") });
  }
  return entries;
}

/** The conflicts of the last rebase in `worktree` since `grantedAt` (ISO, the lock's grant), replayed
 *  against the commit that rebase started onto (D33); `onto`, the lock's branch, stands in only when
 *  that entry names no commit. No rebase since the grant: no conflict (D3). */
export function conflictsOf(worktree: string, onto: string, grantedAt: string): Conflicts {
  try {
    if (!gitHasMergeTree(worktree)) return { unknown: "old-git" };
    const grantedSeconds = Math.floor(Date.parse(grantedAt) / 1000);
    const reflog = headReflog(worktree);
    if (!reflog || Number.isNaN(grantedSeconds)) return { unknown: "no-reflog" };
    // newest first: the first start found since the grant is the last rebase
    const start = reflog.findIndex((e) => e.atSeconds >= grantedSeconds && REBASE_START.test(e.subject));
    if (start < 0) return { files: [] };
    // the entry before the start (older, next in the list) is where HEAD stood: the branch before the rebase
    const before = reflog[start + 1];
    const target = reflog[start].commit || onto;
    if (!before || !target) return { unknown: "no-reflog" };
    const r = gitAnswer(worktree, "merge-tree", "--write-tree", "--name-only", "--no-messages", "-z", before.commit, target);
    if (r.status === 0) return { files: [] };
    if (r.status !== 1) return { unknown: "no-reflog" };
    // -z: the tree's oid, then each conflicted path, NUL-separated
    const [, ...paths] = r.stdout.split("\0").filter(Boolean);
    return { files: [...new Set(paths)] };
  } catch {
    return { unknown: "no-reflog" };
  }
}

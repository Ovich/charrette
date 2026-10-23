// The CLI's one way to ask git: a command in a folder, its answer. Shared by the verbs and by
// conflicts.ts; the board never runs git.
import { spawnSync } from "node:child_process";

/** git's exit and output; `status` null when git could not be run at all. */
export type GitAnswer = { status: number | null; stdout: string };

export const gitAnswer = (cwd: string, ...argv: string[]): GitAnswer => {
  // a worktree's whole reflog is read (D36): room past the 1 MB default
  const r = spawnSync("git", argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "" };
};

/** The trimmed output of a git command that exits 0; null otherwise. */
export const git = (cwd: string, ...argv: string[]): string | null => {
  const r = gitAnswer(cwd, ...argv);
  return r.status === 0 ? r.stdout.trim() : null;
};

/** The worktree of the repository that has `branch` checked out, from `git worktree list --porcelain`;
 *  null when none. git refuses a push to a branch checked out elsewhere, so merge-lock says so first. */
export const worktreeHolding = (cwd: string, branch: string): string | null => {
  const list = git(cwd, "worktree", "list", "--porcelain");
  if (!list) return null;
  const ref = branch.startsWith("refs/") ? branch : `refs/heads/${branch}`;
  let at: string | null = null;
  for (const line of list.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) at = line.slice("worktree ".length);
    else if (line === `branch ${ref}`) return at;
  }
  return null;
};

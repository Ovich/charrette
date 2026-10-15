// The CLI's one way to ask git: a command in a folder, its answer. Shared by the verbs and by
// conflicts.ts; the board never runs git.
import { spawnSync } from "node:child_process";

/** git's exit and output; `status` null when git could not be run at all. */
export type GitAnswer = { status: number | null; stdout: string };

export const gitAnswer = (cwd: string, ...argv: string[]): GitAnswer => {
  const r = spawnSync("git", argv, { cwd, encoding: "utf8" });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? "" };
};

/** The trimmed output of a git command that exits 0; null otherwise. */
export const git = (cwd: string, ...argv: string[]): string | null => {
  const r = gitAnswer(cwd, ...argv);
  return r.status === 0 ? r.stdout.trim() : null;
};

// The project's board is aiview's /board page (aiview board-page migration): `swarm open` adds
// the run's repository to the project's board through `aiview board --repo`, and prints the
// page's link. aiview is called as a command, never imported (swarm plan D16, D17).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** aiview's launcher: SWARM_AIVIEW, else `aiview.mjs` in the aiview skill beside this one. */
export function aiviewLauncher(toolRoot: string): string | null {
  const file = process.env.SWARM_AIVIEW ?? path.join(toolRoot, "..", "aiview", "aiview.mjs");
  return fs.existsSync(file) ? file : null;
}

type AiviewResult = { ok: true; out: unknown } | { ok: false; error: string };

const callAiview = (launcher: string, cwd: string, argv: string[]): AiviewResult => {
  const r = spawnSync(process.execPath, [launcher, ...argv, "--json"], { cwd, encoding: "utf8" });
  if (r.status !== 0) return { ok: false, error: `aiview ${argv[0]} failed: ${(r.stderr || r.stdout).trim()}` };
  try {
    return { ok: true, out: JSON.parse(r.stdout.trim().split("\n").pop() ?? "") };
  } catch {
    return { ok: false, error: `aiview ${argv[0]}: unreadable output ${r.stdout.trim()}` };
  }
};

export type BoardPage =
  | { registered: true; url: string; repos: string[] }
  | { registered: false; reason: string }; // "aiview not found", "no aiview project for <cwd>", an aiview error

/** Adds `repo` to the board of the project claiming `cwd` (never the active one), and returns the
 *  board page's link. Idempotent: a repository already on the board is not added twice. */
export function registerBoard(input: { toolRoot: string; cwd: string; repo: string }): BoardPage {
  const launcher = aiviewLauncher(input.toolRoot);
  if (!launcher) return { registered: false, reason: "aiview not found" };
  const aiview = (argv: string[]) => callAiview(launcher, input.cwd, argv);
  const status = aiview(["status"]);
  if (!status.ok) return { registered: false, reason: status.error };
  const project = (status.out as { cwdProject?: string | null }).cwdProject;
  if (!project) return { registered: false, reason: `no aiview project for ${input.cwd}` };
  const board = aiview(["board", "--repo", input.repo, "--project", project]);
  if (!board.ok) return { registered: false, reason: board.error };
  const out = board.out as { url: string; repos: string[] };
  return { registered: true, url: out.url, repos: out.repos };
}

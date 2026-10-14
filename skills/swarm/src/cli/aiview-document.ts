// The project's board as an aiview document (plan D17, D30, D39): `swarm.swarm.json` { url } in
// aiview's project folder, one per project, no group; its URL names every repository of the
// project that opened a run. aiview is called as a command, never imported (swarm plan D16, D17).
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

/** The fixed name of the project's board document. */
export const BOARD_DOCUMENT_FILE = "swarm.swarm.json";

/** The board page's URL for these repositories: `?repo=<key>` once per repository, in order. */
export const boardUrlFor = (pageUrl: string, repos: string[]): string => {
  const url = new URL(pageUrl);
  url.search = "";
  for (const repo of repos) url.searchParams.append("repo", repo);
  return url.toString();
};

const reposInUrl = (url: string): string[] => {
  try {
    return new URL(url).searchParams.getAll("repo");
  } catch {
    return [];
  }
};

export type BoardDocument =
  | { registered: true; url: string; file: string; retired: string[] } // retired: the files of the per-run documents removed
  | { registered: false; reason: string }; // "aiview not found", "no aiview project for <cwd>", an aiview error

/** Writes or extends the project's swarm document, registers it with no group, retires every
 *  other swarm document of the project. Idempotent: a second call with the same repository changes nothing. */
export function registerBoardDocument(input: { toolRoot: string; cwd: string; repo: string; pageUrl: string }): BoardDocument {
  const launcher = aiviewLauncher(input.toolRoot);
  if (!launcher) return { registered: false, reason: "aiview not found" };
  const aiview = (argv: string[]) => callAiview(launcher, input.cwd, argv);
  // the cwd's project, never the active one (the last `use`)
  const status = aiview(["status"]);
  if (!status.ok) return { registered: false, reason: status.error };
  const project = (status.out as { cwdProject?: string | null }).cwdProject;
  if (!project) return { registered: false, reason: `no aiview project for ${input.cwd}` };
  const where = aiview(["path", BOARD_DOCUMENT_FILE, "--project", project]);
  if (!where.ok) return { registered: false, reason: where.error };
  const file = (where.out as { path: string }).path;
  const existing = readBoardUrl(file);
  const repos = existing === null ? [] : reposInUrl(existing);
  if (existing === null || !repos.includes(input.repo)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ url: boardUrlFor(input.pageUrl, [...repos, input.repo]) }, null, 2) + "\n");
  }
  const opened = aiview(existing === null ? ["open", file, "--kind", "swarm"] : ["open", file]);
  if (!opened.ok) return { registered: false, reason: opened.error };
  const retired = retireOtherSwarmDocuments(aiview, project, file);
  if (!retired.ok) return { registered: false, reason: retired.error };
  return { registered: true, url: (opened.out as { url: string }).url, file, retired: retired.files };
}

/** The board URL the document holds, or null when there is no readable document. */
function readBoardUrl(file: string): string | null {
  try {
    const url = (JSON.parse(fs.readFileSync(file, "utf8")) as { url?: unknown }).url;
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}

/** Removes from the project's index every swarm document but the board (the per-run ones of earlier runs). */
function retireOtherSwarmDocuments(
  aiview: (argv: string[]) => AiviewResult,
  project: string,
  board: string,
): { ok: true; files: string[] } | { ok: false; error: string } {
  const listed = aiview(["list", "--kind", "swarm", "--project", project]);
  if (!listed.ok) return listed;
  const others = (listed.out as { id: number; file_path: string }[]).filter((d) => path.resolve(d.file_path) !== path.resolve(board));
  if (!others.length) return { ok: true, files: [] };
  const removed = aiview(["remove", ...others.map((d) => `#${d.id}`)]);
  if (!removed.ok) return removed;
  return { ok: true, files: others.map((d) => d.file_path) };
}

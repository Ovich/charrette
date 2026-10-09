// The run as an aiview document (plan D2, D3): `<date>-<plan>-run-<id>.swarm.json` { run, url }
// in aiview's project folder, registered in the plan's group. aiview is called as a command,
// never imported (swarm plan D16, D17).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** aiview's launcher: SWARM_AIVIEW, else `aiview.mjs` in the aiview skill beside this one. */
export function aiviewLauncher(toolRoot: string): string | null {
  const file = process.env.SWARM_AIVIEW ?? path.join(toolRoot, "..", "aiview", "aiview.mjs");
  return fs.existsSync(file) ? file : null;
}

type AiviewResult = { ok: true; out: unknown } | { ok: false; error: string };

const callAiview = (launcher: string, argv: string[]): AiviewResult => {
  const r = spawnSync(process.execPath, [launcher, ...argv, "--json"], { encoding: "utf8" });
  if (r.status !== 0) return { ok: false, error: `aiview ${argv[0]} failed: ${(r.stderr || r.stdout).trim()}` };
  try {
    return { ok: true, out: JSON.parse(r.stdout.trim().split("\n").pop() ?? "") };
  } catch {
    return { ok: false, error: `aiview ${argv[0]}: unreadable output ${r.stdout.trim()}` };
  }
};

export type RunDocument = { registered: true; url: string; file: string } | { registered: false; reason: string };

/** Writes the run's document and registers it with aiview: the document's aiview URL, or why not. */
export function registerRunDocument(input: { toolRoot: string; plan: string; run: number; pageUrl: string; date: string }): RunDocument {
  const launcher = aiviewLauncher(input.toolRoot);
  if (!launcher) return { registered: false, reason: "aiview not found" };
  const where = callAiview(launcher, ["path", `${input.date}-${input.plan}-run-${input.run}.swarm.json`]);
  if (!where.ok) return { registered: false, reason: where.error };
  const file = (where.out as { path: string }).path;
  fs.writeFileSync(file, JSON.stringify({ run: input.run, url: input.pageUrl }, null, 2) + "\n");
  const opened = callAiview(launcher, ["open", file, "--group", `${input.plan}-plan`]);
  if (!opened.ok) return { registered: false, reason: opened.error };
  return { registered: true, url: (opened.out as { url: string }).url, file };
}

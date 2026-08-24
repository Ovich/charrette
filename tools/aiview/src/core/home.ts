// Where the user's data lives — deliberately NOT where the code lives.
//
// Two roots, one rule: the checkout holds what `npm run build` can recreate
// (app/, dist/, dist-cli/, node_modules/); the data home holds what it can't
// (the index, the server files, the documents). Delete the checkout, clone it
// again, rebuild — nothing of the user's is lost, because none of it was there.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Data home: $CHARRETTE_HOME, else ~/charrette_appdata. */
export const DATA_ROOT = process.env.CHARRETTE_HOME
  ? path.resolve(process.env.CHARRETTE_HOME)
  : path.join(os.homedir(), "charrette_appdata");

/** Documents live here, one directory per project. Never inside a project repo. */
export const DOCS_ROOT = path.join(DATA_ROOT, "docs");

/** The document directory for a project slug (the slug is what aiview shows as the project). */
export const docsDirFor = (projectSlug: string): string => path.join(DOCS_ROOT, projectSlug);

export function ensureHome(): void {
  fs.mkdirSync(DOCS_ROOT, { recursive: true });
}

/** One-time adoption of an index left next to the tool by a pre-appdata install. */
export function adoptLegacyIndex(toolRoot: string, sqlitePath: string): void {
  if (fs.existsSync(sqlitePath)) return;
  const legacy = path.join(toolRoot, "aiview.sqlite");
  if (!fs.existsSync(legacy)) return;
  fs.copyFileSync(legacy, sqlitePath);
  console.error(`aiview: adopted the index from ${legacy} (the original is left in place, unused)`);
}

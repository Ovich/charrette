// Pure path/name/content helpers — no sqlite, no fs.watch, no HTTP.
import fs from "node:fs";
import path from "node:path";

/** Nearest ancestor holding a .git (the repo that vendors the tool), else `start`. */
export function repoRootOf(start: string): string {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

export const isHtml = (file: string): boolean => /\.html?$/i.test(file);
export const isPdf = (file: string): boolean => /\.pdf$/i.test(file);

export type DocFormat = "markdown" | "html" | "pdf";
export const formatOf = (file: string): DocFormat =>
  isHtml(file) ? "html" : isPdf(file) ? "pdf" : "markdown";

/** `<name>.<kind>.md` / `<name>.<kind>.html` -> "kind"; anything else -> "" */
export function kindFromName(file: string): string {
  const parts = path.basename(file).split(".");
  return parts.length >= 3 ? parts[parts.length - 2].toLowerCase() : "";
}

export function titleOf(text: string, file: string): string {
  const m = isHtml(file)
    ? (text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? text.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1])
    : text.match(/^#\s+(.+)$/m)?.[1];
  return (m ?? path.basename(file)).trim();
}

export const projectRoot = (file: string): string =>
  path.basename(repoRootOf(path.dirname(file)));

export const readDoc = (p: string): string =>
  fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

/** Stored form of a path: posix-relative to `root` when inside it, absolute otherwise. */
export function toStored(abs: string, root: string): string {
  const rel = path.relative(root, abs);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel)
    ? rel.split(path.sep).join("/")
    : abs;
}

/** Absolute path for a stored one, on this machine. */
export const toAbs = (stored: string, root: string): string =>
  path.isAbsolute(stored) ? stored : path.resolve(root, ...stored.split("/"));

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Deterministic hue per kind — same hash as the legacy UI so colors carry over. */
export function kindHue(kind: string): number {
  let h = 0;
  for (const c of kind) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 360;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-08-23 11:28 — the monospace start stamp. */
export function fmtStart(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "2 min ago" / "Aug 21" — the updated stamp. */
export function fmtUpdated(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export const projectName = (p: string): string =>
  p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p;

/** Middle-truncate a path keeping the filename visible. */
export function truncatePath(p: string, max = 72): string {
  if (p.length <= max) return p;
  const sep = p.includes("\\") ? "\\" : "/";
  const parts = p.split(sep);
  const file = parts.pop() ?? "";
  let head = parts.join(sep);
  const room = max - file.length - 2;
  if (room <= 0) return `…${sep}${file}`;
  head = head.slice(0, room);
  return `${head}…${sep}${file}`;
}

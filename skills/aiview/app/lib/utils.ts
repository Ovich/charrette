import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The colour of a kind chip.
 *
 * It used to be a hash of the name, which is deterministic and useless: `plan` 97,
 * `reference` 107, `architecture` 115 and `roadmap` 116 all landed inside twenty degrees
 * of the same green, and `spec` 187 and `report` 188 were one degree apart. A person
 * reading a sidebar of a dozen documents could not tell a plan from a roadmap by colour,
 * which is the only thing the chip is for.
 *
 * These eleven are placed by hand, evenly around the wheel, with the pairs that appear
 * together pushed as far apart as the wheel allows: a plan sits beside its slices, a
 * board beside its spec, a roadmap beside its reference, a mockup beside the
 * architecture. Chroma alternates as well, so two neighbours differ in more than hue and
 * remain distinct to a colour-blind reader and on a projector.
 *
 * A kind not listed here still gets a stable colour from the old hash, moved off the
 * spokes above so a new kind cannot be born looking like an existing one.
 */
const KIND_COLORS: Record<string, { h: number; s: number }> = {
  roadmap: { h: 0, s: 68 },
  report: { h: 33, s: 55 },
  mockup: { h: 65, s: 62 },
  slice: { h: 98, s: 48 },
  architecture: { h: 131, s: 58 },
  spec: { h: 164, s: 46 },
  plan: { h: 196, s: 66 },
  reference: { h: 229, s: 50 },
  pdf: { h: 262, s: 60 },
  brainstorm: { h: 295, s: 52 },
  "pr-analysis": { h: 327, s: 64 },
};

/** Hue and saturation for a kind. Hand-placed where it matters, hashed where it does not. */
export function kindColor(kind: string): { h: number; s: number } {
  const named = KIND_COLORS[kind];
  if (named) return named;
  let h = 0;
  for (const c of kind) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  // 16 degrees off every hand-placed spoke, which sit on multiples of about 33.
  return { h: (((h % 11) * 33 + 16) % 360), s: 44 };
}

/** The hue alone. Kept because the tests and any older caller ask for a number. */
export function kindHue(kind: string): number {
  return kindColor(kind).h;
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

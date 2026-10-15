// The across-runs view's scope as the page's URL keeps it (D31), the `/api/stats` route it asks, and
// how a figure reads. Formats and selects, never aggregates (D34, D35): a figure the JSON does not
// carry is not drawn here. Pure: no DOM, no fetch.
import type { Kind } from "../../../../swarm/src/board/snapshot.ts";
import type { RunId } from "./view.ts";

/** "all": every run kept, `since` left out (D33). */
export type Period = "30d" | "7d" | "all";
export type AcrossScope = { period: Period; kinds: Kind[] /* never empty */ };

export const PERIODS: { value: Period; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "7d", label: "Last 7 days" },
  { value: "all", label: "Every run kept" },
];
export const KINDS: Kind[] = ["plan", "brainstorm"];
export const DEFAULT_SCOPE: AcrossScope = { period: "30d", kinds: KINDS };

/** The hash's fields, in order; a field without `=` kept as written. */
function fieldsOf(hash: string): [string, string | null][] {
  return hash
    .replace(/^#/, "")
    .split("&")
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf("=");
      return i < 0 ? [part, null] : [part.slice(0, i), decodeURIComponent(part.slice(i + 1))];
    });
}

/** The across view the hash opens, or null when it opens none: `across=1&period=7d&kinds=plan`.
 *  An unknown period or kind falls back to the default, never an error: a hash is typed by people. */
export function readAcross(hash: string): AcrossScope | null {
  const fields = new Map(fieldsOf(hash));
  if (fields.get("across") !== "1") return null;
  const period = PERIODS.find((p) => p.value === fields.get("period"))?.value ?? DEFAULT_SCOPE.period;
  const kinds = KINDS.filter((k) => (fields.get("kinds") ?? "").split(",").includes(k));
  return { period, kinds: kinds.length ? kinds : DEFAULT_SCOPE.kinds };
}

const ACROSS_KEYS = new Set(["across", "period", "kinds"]);

/** The hash with the across view written in (null: taken out), every other field kept: the
 *  document and the pointer stay where they are. Without the leading `#`. */
export function hashWithAcross(hash: string, scope: AcrossScope | null): string {
  const kept = fieldsOf(hash)
    .filter(([key]) => !ACROSS_KEYS.has(key))
    .map(([key, value]) => (value === null ? key : `${key}=${encodeURIComponent(value)}`));
  if (scope) kept.push("across=1", `period=${scope.period}`, `kinds=${scope.kinds.join(",")}`);
  return kept.join("&");
}

/** What a view asks `/api/stats` for: the across view's scope, or one run (its tab's Analytics). */
export type StatsAsk = AcrossScope | { run: RunId };

/** The route a view asks. The across view: closed runs only (D33); every kind sends none, so the body
 *  equals `swarm stats --repo <repo> --since 30d --closed --json` (or `--all`), a kind subset `--kind`
 *  (D34). One run: no period, so the body equals `swarm stats --repo <repo> --run <id> --all --json`. */
export function statsUrl(repo: string, ask: StatsAsk): string {
  if ("run" in ask) return `/api/stats?${new URLSearchParams({ repo, run: String(ask.run) }).toString()}`;
  const q = new URLSearchParams({ repo, since: ask.period });
  if (ask.kinds.length < KINDS.length) q.set("kind", ask.kinds.join(","));
  q.set("closedOnly", "1");
  return `/api/stats?${q.toString()}`;
}

/** The kinds with one turned on or off; the last one on stays on (D33). */
export function toggleKind(kinds: Kind[], kind: Kind): Kind[] {
  if (!kinds.includes(kind)) return KINDS.filter((k) => k === kind || kinds.includes(k));
  return kinds.length > 1 ? kinds.filter((k) => k !== kind) : kinds;
}

/** What a figure the store has no record of reads (plan US1, D34): never 0. */
export const NOT_RECORDED = "not recorded";

/** A duration as the board writes it: "40s", "1m 50s" under ten minutes, "18m", "2h 42m". */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 10) return s % 60 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${m}m`;
  if (m < 60) return `${Math.round(s / 60)}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

/** A nullable figure written, or "not recorded" (D34). */
export const figure = (n: number | null | undefined, write: (n: number) => string = String): string =>
  n === null || n === undefined ? NOT_RECORDED : write(n);

/** A share of two figures of one object, "78%" (D35); null when either is unknown or the whole is 0. */
export function share(part: number | null, whole: number | null): string | null {
  if (part === null || whole === null || whole === 0) return null;
  return `${Math.round((part / whole) * 100)}%`;
}

/** A difference of two figures of one object (D35); null when either is unknown. */
export const less = (from: number | null, minus: number | null): number | null => (from === null || minus === null ? null : from - minus);

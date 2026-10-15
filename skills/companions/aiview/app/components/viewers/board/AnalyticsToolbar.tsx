import { useEffect, useState } from "react";
import { KINDS, PERIODS, plural, toggleKind, type AcrossScope, type Period } from "../../../lib/board/analytics.ts";

const GIT_TIP = "merged found no git 2.38 or later for these merges: their conflicts are unknown, not zero. Update git where the members run.";

/** The across view's head: the period, the kinds (the last one on stays on, D33), what the scope holds,
 *  the git chip when some merges' conflicts are unknown (board D16), and "Copy as JSON": the response
 *  body as the server sent it, equal to `swarm stats` with the same flags (US3, D34). */
export function AnalyticsToolbar({
  scope,
  note,
  unknownMerges,
  body,
  onScope,
}: {
  scope: AcrossScope;
  note: string;
  unknownMerges: number | null;
  body: string | null;
  onScope: (scope: AcrossScope) => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = (): void => {
    if (body === null) return;
    void navigator.clipboard?.writeText(body).then(() => setCopied(true));
  };
  return (
    <div className="atoolbar" data-component="AnalyticsToolbar" data-state={copied ? "copied" : "idle"}>
      <strong className="atitle">Across runs</strong>
      <select aria-label="Period" value={scope.period} onChange={(e) => onScope({ ...scope, period: e.target.value as Period })}>
        {PERIODS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {KINDS.map((k) => (
        <button key={k} className={`kchip ${k}`} aria-pressed={scope.kinds.includes(k)} onClick={() => onScope({ ...scope, kinds: toggleKind(scope.kinds, k) })}>
          {k}
        </button>
      ))}
      <span className="scope-note">{note}</span>
      <span className="right">
        {unknownMerges !== null && unknownMerges > 0 && (
          <span className="warnchip" data-part="git-chip" title={GIT_TIP}>
            ⚠ git 2.38+ needed · {plural(unknownMerges, "merge")} with conflicts unknown
          </span>
        )}
        <button className="ghost" onClick={copy} disabled={body === null}>
          {copied ? "Copied" : "Copy as JSON"}
        </button>
      </span>
    </div>
  );
}

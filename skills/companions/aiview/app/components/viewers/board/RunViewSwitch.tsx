import { useEffect, useState } from "react";
import type { Phase } from "../../../../../swarm-board/src/client/reader.ts";
import type { RunView } from "../../../lib/board/analytics.ts";

/** A run tab's head (plan D31, mockup #677 `run`, `brun`, `conv`): Conversation / Analytics, the run's
 *  line, and on Analytics "Copy as JSON", the run's answer as the server sent it, equal to
 *  `swarm stats --run <id> --all --json` (D34). `json` null hides the button. `phase`: the run's current
 *  phase (`swarm phase`), shown after the line; none before the first. */
/** The phases drawn one by one at the strip's end; the earlier fold into one segment. */
const PHASES_SHOWN = 6;

export function RunViewSwitch({
  view,
  line,
  json,
  onView,
  phase = null,
  phases = [],
}: {
  view: RunView;
  line: string;
  json: string | null;
  onView: (view: RunView) => void;
  phase?: Phase | null;
  /** Every phase the run opened, in order: drawn as a strip, the last one current. Empty: the current phase alone. */
  phases?: { name: string; text: string }[];
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = (): void => {
    if (json === null) return;
    void navigator.clipboard?.writeText(json).then(() => setCopied(true));
  };
  return (
    <div className="runhead" data-component="RunViewSwitch" data-state={view === "analytics" && copied ? "analytics+copied" : view}>
      {phases.length > 1 ? (
        <span className="phases" data-component="PhaseStrip">
          {phases.length > PHASES_SHOWN && (
            <span
              className="pseg done earlier"
              title={phases
                .slice(0, phases.length - PHASES_SHOWN)
                .map((p, i) => `${i + 1}. ${p.name}${p.text ? `: ${p.text}` : ""}`)
                .join("\n")}
            >
              <span className="name">{phases.length - PHASES_SHOWN} earlier</span>
            </span>
          )}
          {phases.slice(-PHASES_SHOWN).map((p, k, shownPhases) => {
            const now = k === shownPhases.length - 1;
            return (
              <span key={`${k}-${p.name}`} className={now ? "pseg now" : "pseg done"} data-phase={p.name} title={p.text ? `${p.name}: ${p.text}` : p.name}>
                <span className="name">{p.name}</span>
                {now && p.text && <span className="said">{p.text}</span>}
                {!now && <span className="ok" aria-label="done">✓</span>}
              </span>
            );
          })}
        </span>
      ) : phase && (
        <span className="runphase" data-component="RunPhase" data-phase={phase.name} title={`The run's current phase: ${phase.name}`}>
          <span className="name">{phase.name}</span>
          {phase.text && <span className="said" title={phase.text}>{phase.text}</span>}
        </span>
      )}
      <span className="runtools" role="group" aria-label="This run">
        {view === "analytics" && <span className="runline" title={line}>{line}</span>}
        {view === "analytics" && json !== null && (
          <button className="ghost" onClick={copy}>
            {copied ? "Copied" : "Copy as JSON"}
          </button>
        )}
        {/* one pill, as the board's own Analytics: pressed shows the run's analytics, pressed again its conversation */}
        <button
          className="abtn"
          data-component="RunAnalyticsButton"
          aria-pressed={view === "analytics"}
          title="This run's analytics"
          onClick={() => onView(view === "analytics" ? "conversation" : "analytics")}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M2 14V9M6 14V4M10 14V7M14 14V2" />
          </svg>
          Analytics
        </button>
        {view === "analytics" && (
          <button className="abtn close" data-component="CloseAnalytics" aria-label="Close analytics" title="Back to the conversation" onClick={() => onView("conversation")}>
            ×
          </button>
        )}
      </span>
    </div>
  );
}

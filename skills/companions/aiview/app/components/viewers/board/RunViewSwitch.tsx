import { useEffect, useState } from "react";
import type { Phase } from "../../../../../swarm/src/board/snapshot.ts";
import type { RunView } from "../../../lib/board/analytics.ts";

/** A run tab's head (plan D31, mockup #677 `run`, `brun`, `conv`): Conversation / Analytics, the run's
 *  line, and on Analytics "Copy as JSON", the run's answer as the server sent it, equal to
 *  `swarm stats --run <id> --all --json` (D34). `json` null hides the button. `phase`: the run's current
 *  phase (`swarm phase`), shown after the line; none before the first. */
export function RunViewSwitch({
  view,
  line,
  json,
  onView,
  phase = null,
}: {
  view: RunView;
  line: string;
  json: string | null;
  onView: (view: RunView) => void;
  phase?: Phase | null;
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
      <div className="seg" role="group" aria-label="This run">
        <button aria-pressed={view === "conversation"} onClick={() => onView("conversation")}>
          Conversation
        </button>
        <button aria-pressed={view === "analytics"} onClick={() => onView("analytics")}>
          Analytics
        </button>
      </div>
      <span className="runline">{line}</span>
      {phase && (
        <span className="runphase" data-component="RunPhase" data-phase={phase.name} title={`The run's current phase: ${phase.name}`}>
          <span className="name">{phase.name}</span>
          {phase.text && <span className="said" title={phase.text}>{phase.text}</span>}
        </span>
      )}
      {view === "analytics" && json !== null && (
        <button className="ghost" onClick={copy}>
          {copied ? "Copied" : "Copy as JSON"}
        </button>
      )}
    </div>
  );
}

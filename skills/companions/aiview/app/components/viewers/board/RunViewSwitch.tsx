import { useEffect, useState } from "react";
import type { RunView } from "../../../lib/board/analytics.ts";

/** A run tab's head (plan D31, mockup #677 `run`, `brun`, `conv`): Conversation / Analytics, the run's
 *  line, and on Analytics "Copy as JSON", the run's answer as the server sent it, equal to
 *  `swarm stats --run <id> --all --json` (D34). `json` null hides the button. */
export function RunViewSwitch({ view, line, json, onView }: { view: RunView; line: string; json: string | null; onView: (view: RunView) => void }) {
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
      {view === "analytics" && json !== null && (
        <button className="ghost" onClick={copy}>
          {copied ? "Copied" : "Copy as JSON"}
        </button>
      )}
    </div>
  );
}

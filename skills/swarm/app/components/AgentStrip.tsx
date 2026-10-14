// A picked open run's members, one row of cards under the tabs, orchestrator first (D7, D20):
// each card its member (code, then nick), its status, the slice, what it does. A card clicked
// follows the member and narrows the conversation; clicked again, released.
import type { CSSProperties } from "react";
import type { SnapshotRunner } from "../../src/board/board.ts";
import { hhmm, ORCHESTRATOR } from "../lib/view.ts";
import { RunnerName } from "./chips.tsx";

/** What the card's right side says: ended, quiet, or since when, with today's RunnerCard states. */
function statusOf(p: SnapshotRunner): { text: string; className: string } {
  if (p.state === "ended" || p.state === "done") return { text: p.ended ? `ended ${hhmm(p.ended)}` : "ended", className: "ended" };
  if (p.stale) return { text: `quiet ${Math.max(1, Math.round((Date.now() - Date.parse(p.lastCall)) / 60000))} min`, className: "quiet" };
  const doing = p.listening && p.slice !== ORCHESTRATOR ? "listening" : p.state;
  return { text: `${doing} · since ${hhmm(p.joined)}`, className: p.state };
}

function AgentCard({ p, hue, followed, onFollow }: { p: SnapshotRunner; hue: number; followed: boolean; onFollow: () => void }) {
  const orch = p.slice === ORCHESTRATOR;
  const status = statusOf(p);
  return (
    <button
      className={["card", orch && "orch", p.state].filter(Boolean).join(" ")}
      style={{ "--h": hue, "--s": 60 } as CSSProperties}
      aria-pressed={followed}
      onClick={onFollow}
      data-component="AgentCard"
    >
      <span className="top">
        <RunnerName name={p.runner} />
        <span className={`state ${status.className}`}>
          <i />
          {status.text}
        </span>
      </span>
      <span className="slice">{orch ? "orchestrator" : p.title ? `${p.slice} · ${p.title}` : p.slice}</span>
      <span className="doing">{p.doing}</span>
    </button>
  );
}

export function AgentStrip({
  agents,
  hue,
  follow,
  onFollow,
}: {
  agents: SnapshotRunner[];
  /** The run's hue (D19): every member's stripe takes it. */
  hue: number;
  follow: string | null;
  onFollow: (runner: string | null) => void;
}) {
  if (agents.length === 0) return null;
  return (
    <section className={follow ? "agent-strip following" : "agent-strip"} data-component="AgentStrip" aria-label="Agents">
      {agents.map((p) => (
        <AgentCard key={p.runner} p={p} hue={hue} followed={follow === p.runner} onFollow={() => onFollow(follow === p.runner ? null : p.runner)} />
      ))}
    </section>
  );
}

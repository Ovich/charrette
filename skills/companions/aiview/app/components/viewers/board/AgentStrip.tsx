// A picked run's members, a closed run's as they ended, five cards a row under the tabs, the orchestrator the first card (D7, D20):
// each card its member (code, then nick), its status, the slice, what it does, its token counter. A card clicked
// follows the member and narrows the conversation; clicked again, released.
import { useEffect, useState, type CSSProperties } from "react";
import type { SnapshotRunner } from "../../../../../swarm/src/board/snapshot.ts";
import { hhmm, ORCHESTRATOR } from "../../../lib/board/view.ts";
import { RunnerName } from "./chips.tsx";

/** What the card's right side says: ended, quiet, or since when, with today's RunnerCard states. */
function statusOf(p: SnapshotRunner): { text: string; className: string } {
  if (p.state === "ended" || p.state === "done") return { text: p.ended ? `ended ${hhmm(p.ended)}` : "ended", className: "ended" };
  if (p.stale) return { text: `quiet ${Math.max(1, Math.round((Date.now() - Date.parse(p.lastCall)) / 60000))} min`, className: "quiet" };
  const doing = p.listening && p.slice !== ORCHESTRATOR ? "listening" : p.state;
  return { text: `${doing} · since ${hhmm(p.joined)}`, className: p.state };
}

/** The member's token counter (swarm's stall poller): the count and the seconds since it last moved,
 *  marked flat at the run's stall threshold; the reason when the board cannot read it. */
function Counter({ p, now, stallMs }: { p: SnapshotRunner; now: number; stallMs: number }) {
  const l = p.liveness;
  if (!l || p.state === "ended" || p.state === "done") return null;
  if (l.state !== "ok")
    return (
      <span className="counter blind" data-component="TokenCounter" data-state={l.state}>
        {l.state === "none" ? "no transcript" : "transcript unreadable"}
      </span>
    );
  const since = l.movedAt ? Math.max(0, Math.floor((now - Date.parse(l.movedAt)) / 1000)) : null;
  const flat = since !== null && since * 1000 >= stallMs;
  return (
    <span className={flat ? "counter flat" : "counter"} data-component="TokenCounter" data-state={flat ? "flat" : "moving"}>
      {(l.tokens ?? 0).toLocaleString("en-US")} tok{since !== null && ` · moved ${since}s ago`}
    </span>
  );
}

/** Now, every second: the counters' seconds since they moved go on between two snapshots. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function AgentCard({ p, hue, followed, onFollow, now, stallMs }: { p: SnapshotRunner; hue: number; followed: boolean; onFollow: () => void; now: number; stallMs: number }) {
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
      <Counter p={p} now={now} stallMs={stallMs} />
    </button>
  );
}

export function AgentStrip({
  agents,
  hue,
  follow,
  onFollow,
  stallMs = 5000,
}: {
  agents: SnapshotRunner[];
  /** The run's hue (D19): every member's stripe takes it. */
  hue: number;
  follow: string | null;
  onFollow: (runner: string | null) => void;
  /** The run's stall threshold: a counter flat this long is marked. */
  stallMs?: number;
}) {
  const now = useNow();
  if (agents.length === 0) return null;
  return (
    <section className={follow ? "agent-strip following" : "agent-strip"} data-component="AgentStrip" aria-label="Agents">
      {agents.map((p) => (
        <AgentCard key={p.runner} p={p} hue={hue} followed={follow === p.runner} onFollow={() => onFollow(follow === p.runner ? null : p.runner)} now={now} stallMs={stallMs} />
      ))}
    </section>
  );
}

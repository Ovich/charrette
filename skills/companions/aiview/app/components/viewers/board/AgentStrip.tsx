// A picked run's members, a closed run's as they ended, five cards a row under the tabs, the orchestrator the first card (D7, D20):
// each card its member (code, then nick), its status, the slice, what it does. A card clicked
// follows the member and narrows the conversation; clicked again, released.
import { useEffect, useState, type CSSProperties } from "react";
import type { Liveness, SnapshotRunner } from "../../../../../swarm/src/client/reader.ts";
import { hhmm, ORCHESTRATOR } from "../../../lib/board/view.ts";
import { RunnerName } from "./chips.tsx";

/** A member's activity as the server computes it (swarm-relay#D9, #D20), with its two ages' instants when the server sends them (swarm-relay#D38). */
type MemberActivity = Liveness & { progressAt?: number | null; aliveAt?: number | null };
const ACTIVITY_STATES: ReadonlySet<string> = new Set(["working", "busy", "waiting", "quiet", "stalled", "gone"]);

/** The member's activity, or null when the reader sends none it knows (a server before swarm-relay#D20): the card draws as before. */
function activityOf(p: SnapshotRunner): MemberActivity | null {
  const l = p.liveness;
  return l && ACTIVITY_STATES.has(l.state) ? l : null;
}

const minutesSince = (since: number, now: number): string => `${Math.max(1, Math.round((now - since) / 60000))} min`;

/** An age as a person reads it at a glance: seconds under a minute, minutes under an hour, then hours. */
function ageSince(at: number, now: number): string {
  const secs = Math.max(0, Math.round((now - at) / 1000));
  if (secs < 60) return `${secs} s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  return `${Math.round(secs / 3600)} h`;
}

/** What the card's right side says: ended, the member's activity state (busy and quiet with how long), or as before it. */
function statusOf(p: SnapshotRunner, activity: MemberActivity | null, now: number): { text: string; className: string } {
  if (p.state === "ended" || p.state === "done") return { text: p.ended ? `ended ${hhmm(p.ended)}` : "ended", className: "ended" };
  if (activity) {
    const timed = (activity.state === "busy" || activity.state === "quiet" || activity.state === "stalled") && activity.since !== null;
    return { text: timed ? `${activity.state} · ${minutesSince(activity.since!, now)}` : activity.state, className: activity.state };
  }
  if (p.stale) return { text: `quiet ${Math.max(1, Math.round((now - Date.parse(p.lastCall)) / 60000))} min`, className: "quiet" };
  const doing = p.listening && p.slice !== ORCHESTRATOR ? "listening" : p.state;
  return { text: `${doing} · ${hhmm(p.joined)}`, className: p.state };
}

/** The tool the member has open (busy) or called last, and why it is quiet when the server says. */
function ActivityLine({ activity }: { activity: MemberActivity }) {
  const tool = activity.doing ? (activity.state === "busy" ? activity.doing : `last: ${activity.doing}`) : null;
  const text = [tool, activity.state === "quiet" || activity.state === "stalled" || activity.state === "gone" ? activity.reason : null].filter(Boolean).join(" · ");
  if (!text) return null;
  return (
    <span className="activity" data-component="MemberActivity" data-state={activity.state}>
      {text}
    </span>
  );
}

/** Since the member's last progress and since its last sign of life (swarm-relay#D38); nothing when the server sends neither. */
function MemberAges({ activity, now }: { activity: MemberActivity; now: number }) {
  const ages = [
    typeof activity.progressAt === "number" ? `progress ${ageSince(activity.progressAt, now)}` : null,
    typeof activity.aliveAt === "number" ? `alive ${ageSince(activity.aliveAt, now)}` : null,
  ].filter(Boolean);
  if (ages.length === 0) return null;
  return (
    <span className="ages" data-component="MemberAges">
      {ages.join(" · ")}
    </span>
  );
}

/** Now, every minute is enough: busy and quiet count in minutes between two snapshots. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function AgentCard({ p, hue, followed, onFollow, now }: { p: SnapshotRunner; hue: number; followed: boolean; onFollow: () => void; now: number }) {
  const orch = p.slice === ORCHESTRATOR;
  const activity = p.state === "ended" || p.state === "done" ? null : activityOf(p);
  const status = statusOf(p, activity, now);
  return (
    <button
      className={["card", orch && "orch", p.state, activity?.state === "gone" && "gone"].filter(Boolean).join(" ")}
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
      {activity && <MemberAges activity={activity} now={now} />}
      {activity && <ActivityLine activity={activity} />}
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
  const now = useNow();
  if (agents.length === 0) return null;
  return (
    <section className={follow ? "agent-strip following" : "agent-strip"} data-component="AgentStrip" aria-label="Agents">
      {agents.map((p) => (
        <AgentCard key={p.runner} p={p} hue={hue} followed={follow === p.runner} onFollow={() => onFollow(follow === p.runner ? null : p.runner)} now={now} />
      ))}
    </section>
  );
}

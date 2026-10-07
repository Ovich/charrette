import type { CSSProperties } from "react";
import type { SnapshotRunner } from "../../src/board/board.ts";
import { basename, hhmm, ORCHESTRATOR, runnerColor } from "../lib/view.ts";
import { RunnerTag } from "./chips.tsx";

function RunnerCard({
  p,
  planTitle,
  followed,
  fresh,
  onFollow,
}: {
  p: SnapshotRunner;
  planTitle: string;
  followed: boolean;
  fresh: boolean;
  onFollow: () => void;
}) {
  const orch = p.slice === ORCHESTRATOR;
  const { h, s } = runnerColor(p.runner);
  const label = p.stale && !["ended", "done"].includes(p.state) ? "stale" : p.state;
  const meta = orch ? [`opened ${hhmm(p.joined)}`] : [`joined ${hhmm(p.joined)}`, `${p.calls} ${p.calls === 1 ? "call" : "calls"}`];
  return (
    <button
      className={["card", orch && "orch", p.state, fresh && "new"].filter(Boolean).join(" ")}
      style={{ "--h": h, "--s": s } as CSSProperties}
      aria-pressed={followed}
      onClick={onFollow}
      data-component="RunnerCard"
    >
      <span className="top">
        <RunnerTag name={p.runner} />
        <span className={label === "stale" ? `state ${p.state} stale` : `state ${p.state}`}>
          <i />
          {label}
        </span>
      </span>
      <span className="plan">{planTitle}</span>
      <span className="slice">{orch ? "Feeds the swarm" : p.title}</span>
      <span className="doing">{p.doing}</span>
      {p.files.length > 0 && (
        <span className="files">
          {p.files.map((f) => (
            <span key={f.path} className={f.interface ? "file iface" : "file"} title={`${f.path}: ${f.interface ? "changes its interface" : "inside only"}`}>
              {basename(f.path)}
            </span>
          ))}
        </span>
      )}
      <span className="meta">
        {meta.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </span>
    </button>
  );
}

export function Roster({
  roster,
  planTitle,
  focus,
  fresh,
  onFollow,
}: {
  roster: SnapshotRunner[];
  planTitle: (plan: string) => string;
  focus: string | null;
  fresh: Set<string>;
  onFollow: (runner: string | null) => void;
}) {
  const working = roster.filter((p) => p.slice !== ORCHESTRATOR && p.state !== "ended" && p.state !== "done").length;
  return (
    <section data-component="Roster" aria-label="Who is there">
      <p className="label">
        Who is there{" "}
        <span className="n">
          {working} working · {roster.length}
        </span>
        <span className="hint">
          {focus ? (
            <>
              following <RunnerTag name={focus} /> · <button onClick={() => onFollow(null)}>show everyone</button>
            </>
          ) : (
            "select a runner to follow it"
          )}
        </span>
      </p>
      <div className={focus ? "roster focusing" : "roster"}>
        {roster.map((p) => (
          <RunnerCard
            key={p.runner}
            p={p}
            planTitle={planTitle(p.plan)}
            followed={focus === p.runner}
            fresh={fresh.has(p.runner)}
            onFollow={() => onFollow(focus === p.runner ? null : p.runner)}
          />
        ))}
      </div>
    </section>
  );
}

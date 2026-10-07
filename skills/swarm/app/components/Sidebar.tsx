import { useEffect, useState } from "react";
import type { RunSummary } from "../../src/board/board.ts";
import type { Connection, RepoView } from "../hooks/useBoard.ts";
import { ago } from "../lib/view.ts";
import { PlanCode } from "./chips.tsx";

export function LiveIndicator({ connection }: { connection: Connection }) {
  const live = connection === "live";
  return (
    <span className={live ? "live" : "live off"} data-component="LiveIndicator" title={live ? "live: changes appear as they are written" : "reconnecting…"}>
      <i />
      <span>{live ? "live" : "reconnecting…"}</span>
    </span>
  );
}

function Chevron() {
  return (
    <svg className="chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

/** A run: the whole row selects it; its title opens the plan's document when it has a link (D44). */
function RunItem({ run, current, onSelect }: { run: RunSummary; current: boolean; onSelect: () => void }) {
  const pct = run.of ? Math.round((run.done / run.of) * 100) : 0;
  const state = run.open ? `${run.runners} running` : "closed";
  return (
    <div className={run.open ? "run" : "run closed"} aria-current={current} data-component="RunItem">
      {/* a link may not sit inside a button: the button lies under the row, the link above it */}
      <button className="run-sel" aria-current={current} aria-label={`${run.code} ${state} ${run.title} ${run.done} of ${run.of} merged`} onClick={onSelect} />
      <span className="l1">
        <PlanCode plan={run.plan} />
        {state}
      </span>
      <span className="l2">
        {run.link ? (
          <a className="doc" href={run.link} target="_blank" rel="noopener noreferrer">
            {run.title}
          </a>
        ) : (
          run.title
        )}
      </span>
      <span className="l3">
        <span className="bar">
          <i style={{ width: `${pct}%` }} />
        </span>
        {run.done} of {run.of} merged
      </span>
    </div>
  );
}

/** A repository (D45): expanded while it has an open run, its open runs first and its closed
 *  ones under a collapsed "N closed" row; collapsed when all its runs are closed. The person's
 *  own toggles (`expanded`, `closedShown`) win until the page reloads. */
function RepoGroup({
  repo,
  current,
  expanded,
  closedShown,
  runSel,
  onRepo,
  onToggle,
  onToggleClosed,
  onRun,
}: {
  repo: RepoView;
  current: boolean;
  expanded: boolean;
  closedShown: boolean;
  runSel: string | null;
  onRepo: () => void;
  onToggle: () => void;
  onToggleClosed: () => void;
  onRun: (plan: string) => void;
}) {
  const open = repo.runs.filter((r) => r.open);
  const closed = repo.runs.filter((r) => !r.open);
  const unread = repo.unread > 0 && !current;
  const item = (run: RunSummary) => <RunItem key={run.run} run={run} current={current && runSel === run.plan} onSelect={() => onRun(run.plan)} />;
  return (
    <div className="repo" data-open={expanded} data-component="RepoGroup">
      <div className="repo-h" aria-current={current && !runSel}>
        <button className="tog" aria-expanded={expanded} aria-label={expanded ? "Hide runs" : "Show runs"} onClick={onToggle}>
          <Chevron />
        </button>
        <button className="sel" onClick={onRepo} title={repo.repo}>
          <b>{repo.name}</b>
          <span className={unread ? "pill unread" : "pill"}>{unread ? `${repo.unread} new` : open.length ? `${open.length} ${open.length === 1 ? "run" : "runs"}` : "idle"}</span>
        </button>
      </div>
      {expanded && (
        <div className="runs">
          {open.map(item)}
          {closed.length > 0 && open.length === 0 && closed.map(item)}
          {closed.length > 0 && open.length > 0 && (
            <>
              <button className="closed-h" aria-expanded={closedShown} onClick={onToggleClosed}>
                <Chevron />
                {closed.length} closed
              </button>
              {closedShown && closed.map(item)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** "N runs open · hooks seen 12 s ago · :4322"; with no repository shown, the store's name. */
function SidebarFooter({ openRuns, hooksSeen, port }: { openRuns: number; hooksSeen: string | null | undefined; port: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hooksSeen) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, [hooksSeen]);
  const middle = hooksSeen === undefined ? "swarm.sqlite" : hooksSeen === null ? "hooks never seen" : `hooks seen ${ago(hooksSeen, now)}`;
  return (
    <div className="sfoot" data-component="SidebarFooter">
      {openRuns} {openRuns === 1 ? "run" : "runs"} open · {middle} · :{port}
    </div>
  );
}

export function Sidebar({
  repos,
  repo,
  runSel,
  connection,
  port,
  hooksSeen,
  onRepo,
  onRun,
}: {
  repos: RepoView[];
  repo: string | null;
  runSel: string | null;
  connection: Connection;
  port: string;
  /** The shown repository's snapshot's last hook time; undefined while no repository is shown. */
  hooksSeen: string | null | undefined;
  onRepo: (repo: string) => void;
  onRun: (repo: string, plan: string) => void;
}) {
  const openRuns = repos.reduce((n, r) => n + r.runs.filter((x) => x.open).length, 0);
  // the person's own expand and collapse, by repository; until reload (D45)
  const [expandedBy, setExpandedBy] = useState<Record<string, boolean>>({});
  const [closedBy, setClosedBy] = useState<Record<string, boolean>>({});
  const isExpanded = (r: RepoView): boolean => expandedBy[r.repo] ?? r.runs.some((x) => x.open);
  return (
    <aside className="sidebar" data-component="Sidebar" aria-label="Repositories and runs">
      <div className="brand">
        <span className="tile" aria-hidden="true">
          sw
        </span>
        <b>swarm</b>
        <LiveIndicator connection={connection} />
      </div>
      <p className="flabel">
        Repositories <span className="n">{repos.length}</span>
      </p>
      <nav className="repos" data-component="RepoList">
        {repos.map((r) => (
          <RepoGroup
            key={r.repo}
            repo={r}
            current={r.repo === repo}
            expanded={isExpanded(r)}
            closedShown={closedBy[r.repo] ?? false}
            runSel={runSel}
            onRepo={() => onRepo(r.repo)}
            onToggle={() => setExpandedBy((m) => ({ ...m, [r.repo]: !isExpanded(r) }))}
            onToggleClosed={() => setClosedBy((m) => ({ ...m, [r.repo]: !(m[r.repo] ?? false) }))}
            onRun={(plan) => onRun(r.repo, plan)}
          />
        ))}
      </nav>
      <SidebarFooter openRuns={openRuns} hooksSeen={hooksSeen} port={port} />
    </aside>
  );
}

import type { RunSummary } from "../../src/board/board.ts";
import type { Connection, RepoView } from "../hooks/useBoard.ts";
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

function RunItem({ run, current, onSelect }: { run: RunSummary; current: boolean; onSelect: () => void }) {
  const pct = run.of ? Math.round((run.done / run.of) * 100) : 0;
  return (
    <button className={run.open ? "run" : "run closed"} aria-current={current} onClick={onSelect} data-component="RunItem">
      <span className="l1">
        <PlanCode plan={run.plan} />
        {run.open ? `${run.runners} running` : "closed"}
      </span>
      <span className="l2">{run.title}</span>
      <span className="l3">
        <span className="bar">
          <i style={{ width: `${pct}%` }} />
        </span>
        {run.done} of {run.of} merged
      </span>
    </button>
  );
}

function RepoGroup({
  repo,
  open,
  runSel,
  onRepo,
  onRun,
}: {
  repo: RepoView;
  open: boolean;
  runSel: string | null;
  onRepo: () => void;
  onRun: (plan: string) => void;
}) {
  const active = repo.runs.filter((r) => r.open).length;
  const unread = repo.unread > 0 && !open;
  return (
    <div className="repo" data-open={open} data-component="RepoGroup">
      <button className="repo-h" aria-current={open && !runSel} aria-expanded={open} onClick={onRepo} title={repo.repo}>
        <Chevron />
        <b>{repo.name}</b>
        <span className={unread ? "pill unread" : "pill"}>{unread ? `${repo.unread} new` : active ? `${active} ${active === 1 ? "run" : "runs"}` : "idle"}</span>
      </button>
      <div className="runs">
        {repo.runs.map((run) => (
          <RunItem key={run.run} run={run} current={open && runSel === run.plan} onSelect={() => onRun(run.plan)} />
        ))}
      </div>
    </div>
  );
}

export function Sidebar({
  repos,
  repo,
  runSel,
  connection,
  port,
  onRepo,
  onRun,
}: {
  repos: RepoView[];
  repo: string | null;
  runSel: string | null;
  connection: Connection;
  port: string;
  onRepo: (repo: string) => void;
  onRun: (repo: string, plan: string) => void;
}) {
  const openRuns = repos.reduce((n, r) => n + r.runs.filter((x) => x.open).length, 0);
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
          <RepoGroup key={r.repo} repo={r} open={r.repo === repo} runSel={runSel} onRepo={() => onRepo(r.repo)} onRun={(plan) => onRun(r.repo, plan)} />
        ))}
      </nav>
      <div className="sfoot" data-component="SidebarFooter">
        {openRuns} {openRuns === 1 ? "run" : "runs"} open · swarm.sqlite · :{port}
      </div>
    </aside>
  );
}

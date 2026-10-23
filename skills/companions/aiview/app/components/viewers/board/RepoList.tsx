// The repositories on the board, when the URL names more than one (D39): pick one to read.
import type { RepoSummary } from "../../../../../swarm-board/src/client/reader.ts";

export function RepoList({ repos, selected, onSelect }: { repos: RepoSummary[]; selected: string; onSelect: (repo: string) => void }) {
  return (
    <nav className="rail repos" data-component="RepoList" aria-label="Repositories">
      <p className="label">Repositories</p>
      {repos.map((r) => {
        const open = r.runs.filter((x) => x.open).length;
        return (
          <button key={r.repo} className="rail-row" aria-current={r.repo === selected ? "true" : undefined} onClick={() => onSelect(r.repo)} title={r.repo}>
            <span className="t">{r.name}</span>
            <span className="n" aria-label={`${open} open`}>
              {open}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

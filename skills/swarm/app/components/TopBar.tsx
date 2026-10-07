import type { BoardSnapshot } from "../../src/board/board.ts";
import { RunnerTag } from "./chips.tsx";

function MergeLock({ lock }: { lock: BoardSnapshot["lock"] }) {
  return (
    <span className={lock ? "lock held" : "lock"} data-component="MergeLock" title={lock ? `held since ${lock.since}` : "no merge under way"}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
      </svg>
      {lock ? (
        <>
          <span className="t">merge lock</span> <RunnerTag name={lock.holder} />
        </>
      ) : (
        <span className="t">merge lock free</span>
      )}
    </span>
  );
}

/** The repository and what is shown of it; the lock when there is a board to show. */
export function TopBar({ name, title, lock }: { name: string | null; title: string | null; lock: BoardSnapshot["lock"] | undefined }) {
  return (
    <header className="topbar" data-component="TopBar">
      <span className="crumb">
        {name === null ? (
          <b>swarm</b>
        ) : (
          <>
            <span>{name}</span>
            <span className="sep">/</span>
            <b>{title ?? "The thread"}</b>
          </>
        )}
      </span>
      <div className="tb-r">{lock !== undefined && <MergeLock lock={lock} />}</div>
    </header>
  );
}

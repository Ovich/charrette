import type { BoardSnapshot } from "../../src/board/board.ts";
import { RunnerTag } from "./chips.tsx";

/** What the lock is, on hover and keyboard focus (D22), read by TipLayer. */
const LOCK_TIP = "Merge lock: one member merges at a time, across every run. When a member takes it, the board compares the files its branch changed with its claims: a changed file nobody holds is claimed for it, one another member holds is flagged on the conversation. The member then rebases, runs its check and fast-forwards the branch; its merged line names the files it changed, and the members holding them rebase. Then the lock is free for the next in line.";

export function MergeLock({ lock }: { lock: BoardSnapshot["lock"] }) {
  return (
    <span className={lock ? "lock held" : "lock"} data-component="MergeLock" tabIndex={0} data-tip={LOCK_TIP}>
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

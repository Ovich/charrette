import type { Totals } from "../../../../../swarm/src/board/snapshot.ts";
import { figure, less } from "../../../lib/board/analytics.ts";

/** Does the claim protocol hold? The scope's shared files through the four steps (D33), each drop the
 *  difference of two steps of `totals.shared` (D35), its reason beside it. */
export function SharingFunnel({ shared, conflictsInShared }: { shared: Totals["shared"]; conflictsInShared: number | null }) {
  const steps: { label: string; tip: string; n: number | null; drop?: string }[] = [
    { label: "Shared", tip: "a second member claimed it", n: shared.files },
    { label: "Every holder told", tip: "the post mentioned each holder", n: shared.everyHolderTold, drop: "tagged one holder only" },
    { label: "Agreement given", tip: "the holder ran swarm agree", n: shared.agreed, drop: "never answered" },
    { label: "Agreement before the merge", tip: "it could still change the work", n: shared.agreedBeforeMerge, drop: "agreed after the merge" },
  ];
  const whole = shared.files;
  const width = (n: number | null): number => (n === null || !whole ? 0 : (n / whole) * 100);
  return (
    <div className="apanel" data-component="SharingFunnel">
      <div className="label">
        Shared files <span className="hint">does the claim protocol hold?</span>
      </div>
      {steps.map((s, i) => {
        const before = i ? steps[i - 1].n : null;
        // a step the data shows larger than the one before (an agreement without every holder told) drops nothing
        const difference = i ? less(before, s.n) : null;
        const dropped = difference !== null && difference > 0 ? difference : null;
        return (
          <div key={s.label}>
            <div className="step" title={s.tip}>
              <span>{s.label}</span>
              <span className="bar">
                <i style={{ width: `${width(s.n)}%` }} />
                {dropped ? <b style={{ left: `${width(s.n)}%`, width: `${width(dropped)}%` }} /> : null}
              </span>
              <span className="num">{figure(s.n)}</span>
            </div>
            {dropped ? (
              <div className="drop">
                −{dropped} {s.drop}
              </div>
            ) : null}
          </div>
        );
      })}
      <div className="foot">
        A shared file is one a second member claimed while another held it; each step counts the files that made it that far. At merge,{" "}
        <span className={conflictsInShared ? "bad" : undefined}>
          {figure(conflictsInShared)} of the {figure(shared.files)}
        </span>{" "}
        met a conflict.
      </div>
    </div>
  );
}

import type { Totals } from "../../../../../swarm-board/src/client/reader.ts";
import { ESTIMATED_TIP, figure, less, plural } from "../../../lib/board/analytics.ts";

/** Does the claim protocol hold? The scope's shared files through the four steps (D33), each drop the
 *  difference of two steps of `totals.shared` (D35), its reason beside it. Over runs some estimated (D44), drawn
 *  as inferred with "N runs estimated". */
export function SharingFunnel({ shared, conflictsInShared }: { shared: Totals["shared"]; conflictsInShared: number | null }) {
  const steps: { label: string; tip: string; n: number | null; drop?: string }[] = [
    { label: "Shared", tip: "a second member claimed it", n: shared.files },
    { label: "Every holder told", tip: "the post mentioned each holder", n: shared.everyHolderTold, drop: "not every holder told" },
    { label: "Agreement given", tip: "the holder ran swarm agree", n: shared.agreed, drop: "never answered" },
    { label: "Agreement before the merge", tip: "it could still change the work", n: shared.agreedBeforeMerge, drop: "agreed after the merge" },
  ];
  const whole = shared.files;
  const width = (n: number | null): number => (n === null || !whole ? 0 : (n / whole) * 100);
  const estimated = shared.estimatedRuns > 0;
  return (
    <div
      className={estimated ? "apanel inferred" : "apanel"}
      data-component="SharingFunnel"
      data-state={estimated ? "estimated" : "recorded"}
      data-tip={estimated ? ESTIMATED_TIP : undefined}
    >
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
        {estimated
          ? "Estimated: a shared file is one two members claimed while both were members of the run. Each step counts the files that made it that far."
          : "A shared file is one a second member claimed while another held it; each step counts the files that made it that far."}
        {/* the conflict line only when both its figures are recorded (D43) */}
        {conflictsInShared !== null && shared.files !== null ? (
          <>
            {" "}
            At merge, <span className={conflictsInShared ? "bad" : undefined}>
              {figure(conflictsInShared)} of the {figure(shared.files)}
            </span>{" "}
            met a conflict.
          </>
        ) : null}
        {estimated ? <span className="nr"> {plural(shared.estimatedRuns, "run")} estimated.</span> : null}
      </div>
    </div>
  );
}

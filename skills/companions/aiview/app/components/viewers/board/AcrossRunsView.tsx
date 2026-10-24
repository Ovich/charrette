// The across-runs view (board D10, prototype #677 `across` and `empty`): the closed runs of the scope as
// `GET /api/stats` answers them. Every tile, the funnel and the lock panel read `Stats.totals`, each
// sparkline `totals.series` (D28); the view formats and selects, never aggregates (D34, D35). The plan tiles show
// when plan is among the kinds chosen, the brainstorm tiles when brainstorm is (D46); the funnel, the lock panel, the
// hot files and the runs table's plan columns only with plan.
import type { Stats } from "../../../../../swarm-board/src/client/reader.ts";
import type { RunId } from "../../../lib/board/view.ts";
import { useStats } from "../../../hooks/useStats.ts";
import { SOURCED_RULE, figure, formatDuration, percent, plural, share, type AcrossScope } from "../../../lib/board/analytics.ts";
import { AnalyticsToolbar } from "./AnalyticsToolbar.tsx";
import { HotFiles } from "./HotFiles.tsx";
import { KpiTile } from "./KpiTile.tsx";
import { MergeLockPanel } from "./MergeLockPanel.tsx";
import { RunsTable } from "./RunsTable.tsx";
import { SharingFunnel } from "./SharingFunnel.tsx";

/** A figure written into a line, or no line when the figure is unknown. */
const line = (n: number | null, write: (n: number) => string): string | null => (n === null ? null : write(n));
const duration = (n: number | null): string | null => line(n, formatDuration);

function PlanTiles({ stats }: { stats: Stats }) {
  const t = stats.totals;
  // slice times and shared files are estimated for a run before the records (D44), the merged count exact from the
  // members' rows, flags known for every run (D43): only the figures nothing kept say "not recorded"
  const notRecorded = t.notRecorded;
  return (
    <div className="kpis">
      <KpiTile
        label="Slices merged"
        value={line(t.slices.merged, String)}
        unit={line(t.slices.of, (n) => `of ${n}`)}
        delta={line(t.byKind.plan, (n) => plural(n, "plan run"))}
        spark={t.series.slicesMerged}
      />
      <KpiTile
        label="Slice time"
        value={duration(t.slices.p50Ms)}
        unit="median"
        delta={line(t.slices.p90Ms, (n) => `p90 ${formatDuration(n)}`)}
        spark={t.series.sliceTimeP50}
        estimatedRuns={t.slices.timesEstimatedRuns}
      />
      <KpiTile
        label="Lock wait"
        value={duration(t.lockWait.p50Ms)}
        unit="p50"
        delta={line(t.lockWait.p90Ms, (n) => `p90 ${formatDuration(n)}`)}
        tone="warn"
        newRecord
        spark={t.series.lockWaitP50}
        notRecorded={notRecorded}
      />
      <KpiTile
        label="Shared files settled"
        value={share(t.shared.agreed, t.shared.files) ?? line(t.shared.agreed, String)}
        unit={t.shared.agreed !== null && t.shared.files !== null ? `${t.shared.agreed} of ${t.shared.files}` : null}
        delta={line(t.shared.withoutAgreement, (n) => `${n} with no agreement`)}
        tone="warn"
        spark={t.series.sharedAgreed}
        estimatedRuns={t.shared.estimatedRuns}
      />
      <KpiTile
        label="Flags"
        value={line(t.flags, String)}
        unit="edits outside a claim"
        delta={line(t.runsWithoutFlag, (n) => `${plural(n, "run")} clean`)}
        tone="bad"
        spark={t.series.flags}
      />
      <KpiTile
        label="Rebase conflicts"
        value={line(t.conflicts.known, String)}
        unit={t.conflicts.unknownMerges ? `+ ${t.conflicts.unknownMerges} unknown` : null}
        delta={line(t.conflicts.inShared, (n) => `${n} in shared files`)}
        tone="bad"
        newRecord
        spark={t.series.conflicts}
        notRecorded={notRecorded}
      />
      <KpiTile label="Silent members" value={line(t.silentMembers, String)} unit={`past ${formatDuration(stats.silentAfterMs)}`} spark={t.series.silentMembers} notRecorded={notRecorded} newRecord />
    </div>
  );
}

/** The scope's brainstorm runs, from `totals.brainstorm` alone (D46): no sparkline, the series being the plan runs'. */
function BrainstormTiles({ stats }: { stats: Stats }) {
  const b = stats.totals.brainstorm;
  return (
    <div className="kpis five" data-component="BrainstormTiles">
      <KpiTile
        label="Questions settled"
        value={line(b.questionsSettled, String)}
        unit={line(b.questions, (n) => `of ${n}`)}
        delta={line(stats.totals.byKind.brainstorm, (n) => plural(n, "brainstorm run"))}
      />
      <KpiTile label="Exchanges to agree" value={line(b.exchangesMedian, String)} unit="median" />
      <KpiTile label="Objected, then agreed again" value={line(b.objectedThenAgreed, String)} unit="questions" />
      <KpiTile
        label="Claims with a source"
        value={line(b.sourcedShare, percent)}
        unit={b.claimsWithSource.n !== null && b.claimsWithSource.of !== null ? `${b.claimsWithSource.n} of ${b.claimsWithSource.of}` : null}
        tone="warn"
        inferred={SOURCED_RULE}
      />
      {/* the brainstorm runs not recorded, never the scope's plan runs */}
      <KpiTile label="Silent seats" value={line(b.silentSeats, String)} unit={`past ${formatDuration(stats.silentAfterMs)}`} notRecorded={b.notRecorded} newRecord />
    </div>
  );
}

export function AcrossRunsView({
  repo,
  repoName,
  scope,
  onScope,
  onOpenRun,
}: {
  repo: string;
  repoName: string;
  scope: AcrossScope;
  onScope: (scope: AcrossScope) => void;
  onOpenRun: (run: RunId) => void;
}) {
  const { stats, body, error } = useStats(repo, scope);
  if (error) return <p className="notice">{error}</p>;
  const empty = stats !== null && stats.runs.length === 0;
  // claims, the merge lock and shared files are a plan's: with plan not chosen, their panels and columns go
  const withPlan = scope.kinds.includes("plan");
  const note = stats === null ? "" : empty ? "no closed run" : `${line(stats.totals.runs, (n) => plural(n, "run")) ?? figure(null)} · ${line(stats.totals.members, (n) => plural(n, "member")) ?? figure(null)} · ${repoName}`;
  return (
    <section className="analytics" data-component="AcrossRunsView" data-state={stats === null ? "loading" : empty ? "empty" : "across"}>
      <AnalyticsToolbar scope={scope} note={note} unknownMerges={stats?.totals.conflicts.unknownMerges ?? null} body={body} onScope={onScope} />
      {stats === null ? null : empty ? (
        <div className="aempty">
          <p className="lead">No run has closed on this board yet.</p>
          <p>
            Analytics read closed runs. Open one with <code>swarm open</code>; its figures appear here when it closes.
          </p>
        </div>
      ) : (
        <>
          {withPlan ? <PlanTiles stats={stats} /> : null}
          {scope.kinds.includes("brainstorm") ? <BrainstormTiles stats={stats} /> : null}
          <div className="sparknote">
            Sparklines read oldest run to newest. <span className="newrec">new record</span> marks a figure the board does not keep today; it starts with the run after this ships.
          </div>
          {withPlan ? (
            <div className="grid2">
              <SharingFunnel shared={stats.totals.shared} conflictsInShared={stats.totals.conflicts.inShared} />
              <MergeLockPanel lockWait={stats.totals.lockWait} runs={stats.runs} />
            </div>
          ) : null}
          {/* keyed by its columns, so a sort never points at a column the other set lacks */}
          <RunsTable key={withPlan ? "with-plan" : "brainstorm-only"} runs={stats.runs} series={stats.totals.series} planColumns={withPlan} onOpen={onOpenRun} />
          {withPlan ? <HotFiles files={stats.files} runs={stats.runs} runCount={stats.totals.runs} /> : null}
        </>
      )}
    </section>
  );
}

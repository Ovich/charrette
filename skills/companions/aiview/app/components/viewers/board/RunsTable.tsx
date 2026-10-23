import { useState, type ReactNode } from "react";
import type { RunStats, Totals } from "../../../../../swarm-board/src/client/reader.ts";
import { ESTIMATED_TIP, NOT_RECORDED, figure, formatDuration, runLength } from "../../../lib/board/analytics.ts";
import { runHue, type RunId } from "../../../lib/board/view.ts";

/** One run's row: what each column shows, and the value it sorts by (null last). */
type Cell = { show: ReactNode; sortBy: number | string | null; className?: string; tip?: string };
type Column = { heading: string; numeric: boolean; planOnly?: true; cell: (run: RunStats, i: number) => Cell };

const notPlan = (): Cell => ({ show: "—", sortBy: null, className: "faint" });
const count = (n: number | null | undefined, tone: string): Cell => ({ show: figure(n), sortBy: n ?? null, className: n ? tone : n === 0 ? "faint" : "nr" });

/** The scope's runs, one row each, oldest first until a heading is clicked; a row opens its run's tab
 *  (D33). Lock wait p50 and Stale per run from `totals.series` (one point per run, as `runs`). A brainstorm row reads
 *  — in every plan column; `planColumns` false (plan not chosen) leaves those columns out. */
export function RunsTable({
  runs,
  series,
  planColumns = true,
  onOpen,
}: {
  runs: RunStats[];
  series: Totals["series"];
  planColumns?: boolean;
  onOpen: (run: RunId) => void;
}) {
  const [sort, setSort] = useState<{ column: number; descending: boolean } | null>(null);
  const allColumns: Column[] = [
    {
      heading: "Run",
      numeric: false,
      cell: (r) => ({
        sortBy: r.title,
        show: (
          <>
            <span className="code" style={{ color: `hsl(${runHue(r.code)} 55% 45%)` }}>
              {r.code}
            </span>{" "}
            <span className="title">{r.title}</span> <span className="sub">{r.kind}</span>
          </>
        ),
      }),
    },
    { heading: "Members", numeric: true, cell: (r) => ({ show: r.members.length, sortBy: r.members.length }) },
    { heading: "Length", numeric: true, cell: (r) => ({ show: figure(r.lengthMs, runLength), sortBy: r.lengthMs, className: r.lengthMs === null ? "nr" : undefined }) },
    {
      heading: "Lock wait p50",
      numeric: true,
      planOnly: true,
      cell: (r, i) => (r.plan ? { show: figure(series.lockWaitP50[i], formatDuration), sortBy: series.lockWaitP50[i], className: series.lockWaitP50[i] === null ? "nr" : undefined } : notPlan()),
    },
    {
      heading: "Shared files settled",
      numeric: false,
      planOnly: true,
      cell: (r) => {
        if (!r.plan) return notPlan();
        const { perFile, agreed, files, estimated } = r.plan.shared;
        return {
          sortBy: agreed,
          ...(estimated ? { className: "inferred", tip: ESTIMATED_TIP } : {}),
          show: (
            <>
              {perFile.length > 0 && (
                <span className="settled">
                  {perFile.map((f) => (
                    <i key={f.path} className={f.agreement === null ? "no" : undefined} title={f.path} />
                  ))}
                </span>
              )}{" "}
              {/* both unknown: "not recorded" once, never "not recorded of not recorded" */}
              <span className="sub">{agreed === null && files === null ? NOT_RECORDED : `${figure(agreed)} of ${figure(files)}`}</span>
            </>
          ),
        };
      },
    },
    { heading: "Flags", numeric: true, planOnly: true, cell: (r) => (r.plan ? count(r.plan.flags, "bad") : notPlan()) },
    {
      heading: "Conflicts",
      numeric: true,
      planOnly: true,
      cell: (r) => {
        if (!r.plan) return notPlan();
        const { known, unknownMerges } = r.plan.conflicts;
        const cell = count(known, "bad");
        return unknownMerges ? { ...cell, show: `${cell.show} + ${unknownMerges} unknown`, className: "warn" } : cell;
      },
    },
    { heading: "Stale", numeric: true, cell: (r, i) => count(series.silentMembers[i], "") },
  ];
  const columns = planColumns ? allColumns : allColumns.filter((c) => !c.planOnly);

  const rows = runs.map((r, i) => ({ run: r, cells: columns.map((c) => c.cell(r, i)) }));
  if (sort) {
    const dir = sort.descending ? -1 : 1;
    rows.sort((a, b) => {
      const x = a.cells[sort.column].sortBy;
      const y = b.cells[sort.column].sortBy;
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return (x > y ? 1 : x < y ? -1 : 0) * dir;
    });
  }
  const sortBy = (column: number): void => setSort((s) => ({ column, descending: s?.column === column ? !s.descending : false }));

  return (
    <div className="apanel" data-component="RunsTable" data-state={sort ? (sort.descending ? "descending" : "ascending") : "unsorted"}>
      <div className="label">
        Runs <span className="hint">click a run to open it · click a heading to sort</span>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              {columns.map((c, i) => (
                <th key={c.heading} className={c.numeric ? "num" : undefined} aria-sort={sort?.column === i ? (sort.descending ? "descending" : "ascending") : undefined}>
                  <button onClick={() => sortBy(i)}>{c.heading}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ run, cells }) => (
              <tr
                key={run.run}
                tabIndex={0}
                onClick={() => onOpen(run.run)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(run.run);
                }}
              >
                {cells.map((c, i) => (
                  <td key={columns[i].heading} className={[columns[i].numeric ? "num" : "", c.className ?? ""].join(" ").trim() || undefined} title={c.tip}>
                    {c.show}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

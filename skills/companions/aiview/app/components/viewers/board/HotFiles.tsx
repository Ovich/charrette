import type { FileAcrossRuns, RunStats } from "../../../../../swarm-board/src/client/reader.ts";
import { figure, plural } from "../../../lib/board/analytics.ts";

/** A square's shade by the holders it had in that run. */
const heat = (holders: number | null): string => (holders === null ? "h1" : holders >= 4 ? "h3" : holders === 3 ? "h2" : "h1");

/** The files members met in: those shared in at least two of the scope's runs, a square per run of the
 *  scope (oldest first, from the file's `perRun`; blank where it was not shared), a red ring on a conflict. */
export function HotFiles({ files, runs, runCount }: { files: FileAcrossRuns[]; runs: RunStats[]; runCount: number | null }) {
  const hot = files.filter((f) => f.runs.length >= 2);
  if (hot.length === 0) return null;
  return (
    <div className="apanel" data-component="HotFiles">
      <div className="label">
        Files members met in <span className="hint">shared in at least 2 runs · square per run, oldest first · red ring: a conflict</span>
      </div>
      <div className="tablewrap">
        <table className="t">
          <thead>
            <tr>
              <th>File</th>
              <th>Runs</th>
              <th className="num">Holders</th>
              <th className="num">Agreements</th>
              <th className="num">Conflicts</th>
              <th>Declared interface</th>
            </tr>
          </thead>
          <tbody>
            {hot.map((f) => (
              <tr key={f.path}>
                <td className="apath">{f.path}</td>
                <td>
                  <span className="heat">
                    {runs.map((r) => {
                      const at = f.perRun.find((p) => p.run === r.run);
                      const cls = at ? [heat(at.holders), at.conflict ? "c" : ""].join(" ").trim() : undefined;
                      return <i key={r.run} className={cls} title={at ? `${r.code} ${r.title}: ${at.holders === null ? figure(null) : plural(at.holders, "holder")}` : `${r.code} ${r.title}`} />;
                    })}
                  </span>{" "}
                  <span className="sub">
                    {f.runs.length} of {runCount === null ? figure(null) : plural(runCount, "run")}
                  </span>
                </td>
                <td className="num">{figure(f.holders)}</td>
                <td className="num">{figure(f.agreements)}</td>
                <td className={f.conflicts ? "num bad" : f.conflicts === null ? "num nr" : "num"}>{figure(f.conflicts)}</td>
                <td className={f.declaredInterface ? "warn" : f.declaredInterface === null ? "nr" : "muted"}>
                  {f.declaredInterface === null ? figure(null) : `${f.declaredInterface} of ${plural(f.runs.length, "run")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

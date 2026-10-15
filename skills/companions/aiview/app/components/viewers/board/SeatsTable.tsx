import type { Mark, MemberStats } from "../../../../../swarm/src/board/snapshot.ts";
import { figure } from "../../../lib/board/analytics.ts";
import { RunnerTag } from "./chips.tsx";

/** The seat that endorses agreements (plan D30): every other seat reads "—" there. */
const SKEPTIC = "skeptic";

/** A count shown faint at 0, in `tone` past it, "not recorded" when unknown. */
const countCell = (n: number | null, tone = ""): { className: string; text: string } => ({
  className: ["num", n === null ? "nr" : n === 0 ? "faint" : tone].join(" ").trim(),
  text: figure(n),
});

/** A brainstorm run's seats in numbers (mockup #677 SeatsTable): posts, agreements made, endorsements
 *  (the skeptic's alone), objections (inferred, plan D23), claims without a source. */
export function SeatsTable({ members }: { members: MemberStats[] }) {
  const marked = (m: MemberStats, what: Mark["what"]): number => m.marks.filter((x) => x.what === what).length;
  return (
    <div className="apanel" data-component="SeatsTable">
      <div className="label">Seats in numbers</div>
      <div className="tablewrap">
        <table className="t seats">
          <thead>
            <tr>
              <th>Seat</th>
              <th className="num">Posts</th>
              <th className="num">Agreements made</th>
              <th className="num">Endorsed</th>
              <th className="num">Objections</th>
              <th className="num">Claims without a source</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const cells = [
                countCell(m.posts),
                countCell(marked(m, "agreement")),
                m.slice === SKEPTIC ? countCell(marked(m, "endorsed")) : { className: "num faint", text: "—" },
                countCell(marked(m, "objected")),
                countCell(m.unsourced, "warn"),
              ];
              return (
                <tr key={m.member}>
                  <td>
                    <RunnerTag name={m.member} /> <span className="nick">{m.nick}</span>
                  </td>
                  {cells.map((c, i) => (
                    <td key={i} className={c.className}>
                      {c.text}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

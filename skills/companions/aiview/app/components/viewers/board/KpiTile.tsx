import { NOT_RECORDED } from "../../../lib/board/analytics.ts";

export type Tone = "warn" | "bad";

/** A line through the points, oldest run to newest; a null point is a gap, never 0 (D32). */
function Sparkline({ points, tone }: { points: (number | null)[]; tone?: Tone }) {
  const known = points.filter((p): p is number => p !== null);
  if (!known.length) return null;
  const max = Math.max(...known);
  const min = Math.min(...known);
  const w = 100;
  const h = 22;
  const x = (i: number): number => (points.length > 1 ? i * (w / (points.length - 1)) : w / 2);
  const y = (v: number): number => h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
  // a stretch of known points is one polyline; a null breaks it
  const stretches: [number, number][][] = [[]];
  points.forEach((p, i) => {
    if (p === null) stretches.push([]);
    else stretches[stretches.length - 1].push([x(i), y(p)]);
  });
  const colour = tone === "bad" ? "var(--danger)" : tone === "warn" ? "var(--amber)" : "var(--accent)";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {stretches
        .filter((s) => s.length > 1)
        .map((s, i) => (
          <polyline key={i} fill="none" stroke={colour} strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={s.map((p) => p.join(",")).join(" ")} />
        ))}
      {stretches.flat().map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.8" fill={colour} />
      ))}
    </svg>
  );
}

/** One figure of the scope with its sparkline over runs (mockup #677). `value` null reads "not recorded";
 *  `notRecorded` runs in the scope add "N runs not recorded" (D33). Pressed filtering is later (handoff). */
export function KpiTile({
  label,
  value,
  unit,
  delta,
  tone,
  newRecord,
  spark,
  notRecorded,
}: {
  label: string;
  value: string | null;
  unit?: string | null;
  delta?: string | null;
  tone?: Tone;
  newRecord?: boolean;
  spark: (number | null)[];
  notRecorded: number | null;
}) {
  const state = value === null ? "not recorded" : notRecorded ? "some not recorded" : "filled";
  return (
    <div className="kpi" data-component="KpiTile" data-state={state}>
      <span className="k">
        {label}
        {newRecord && <span className="newrec">new record</span>}
      </span>
      {value === null ? (
        <span className="v nr">{NOT_RECORDED}</span>
      ) : (
        <span className="v">
          {value}
          {unit && <small>{unit}</small>}
        </span>
      )}
      {value !== null && delta && <span className={tone ? `d ${tone}` : "d"}>{delta}</span>}
      {notRecorded ? <span className="d nr">{notRecorded} runs not recorded</span> : null}
      <Sparkline points={spark} tone={tone} />
    </div>
  );
}

import type { QuestionStats } from "../../../../../swarm-board/src/client/reader.ts";
import { figure, formatDuration, plural } from "../../../lib/board/analytics.ts";

const MINUTE_MS = 60_000;
/** The axis's step, in minutes, for a run of this length: at most six ticks. */
const stepOf = (lengthMin: number): number => [1, 2, 5, 10, 15, 30, 60].find((s) => lengthMin / s <= 6) ?? 120;

/** A brainstorm run's questions (prototype #677 QuestionsChart; plan D4, D24, D29): a row per `D<n>`, a bar
 *  from its first post to its outcome, or to the run's end while it has none, a dot per exchange, the
 *  outcome `◆ agreed #<seq>`. Scaled to the run's length; no budget, no title. */
export function QuestionsChart({ questions, from, to }: { questions: QuestionStats[]; from: string; to: string }) {
  const start = Date.parse(from);
  const end = Math.max(Date.parse(to), start + 1);
  const pct = (iso: string | number): number => Math.min(100, Math.max(0, (((typeof iso === "number" ? iso : Date.parse(iso)) - start) / (end - start)) * 100));
  const step = stepOf((end - start) / MINUTE_MS);
  const ticks: number[] = [];
  for (let m = 0; start + m * MINUTE_MS <= end; m += step) ticks.push(m);
  return (
    <div className="apanel chart" data-component="QuestionsChart" data-state={questions.length ? "questions" : "none"}>
      <div className="label">
        Questions <span className="hint">first post to outcome · a dot per exchange · from each post's --about D&lt;n&gt;</span>
      </div>
      {questions.length === 0 ? (
        <p className="faint">No post named a question with --about D&lt;n&gt;.</p>
      ) : (
        <div className="scroll">
          <div className="tl">
            {questions.map((q) => {
              const until = q.outcome?.at ?? to;
              const tip = `${q.id} · ${formatDuration(Date.parse(until) - Date.parse(q.firstPost))} · ${q.exchanges === null ? figure(null) : plural(q.exchanges, "exchange")}`;
              return (
                <div key={q.id} className="row question" data-state={q.outcome ? "agreed" : "none"}>
                  <div className="name">
                    <span className="qid">{q.id}</span>
                  </div>
                  <div className="lane">
                    <span className={q.outcome ? "seg s-agreed" : "seg s-open"} style={{ left: `${pct(q.firstPost)}%`, width: `${Math.max(0.3, pct(until) - pct(q.firstPost))}%` }} data-tip={tip} />
                    {q.exchanges !== null && q.exchanges > 0 && (
                      <span className="dots" style={{ left: `calc(${pct(until)}% + 6px)` }}>
                        {Array.from({ length: q.exchanges }, (_, i) => (
                          <i key={i} />
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="outcome">{q.outcome && <span className="agreed">◆ agreed #{q.outcome.seq}</span>}</div>
                </div>
              );
            })}
            <div className="axis">
              <span />
              <div className="ticks">
                {ticks.map((m) => (
                  <span key={m} style={{ left: `${pct(start + m * MINUTE_MS)}%` }}>
                    {m}m
                  </span>
                ))}
              </div>
              <span />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

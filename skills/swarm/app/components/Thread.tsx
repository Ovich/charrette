import type { SnapshotEvent } from "../../src/board/board.ts";
import { eventLine, hhmm, type Filter } from "../lib/view.ts";
import { RichText, RunnerName, RunnerTag } from "./chips.tsx";

function FeedFilters({
  chips,
  filter,
  focus,
  onFilter,
  onUnfollow,
}: {
  chips: { filter: Filter; count: number }[];
  filter: string;
  focus: string | null;
  onFilter: (id: string) => void;
  onUnfollow: () => void;
}) {
  return (
    <div className="filters" data-component="FeedFilters" role="toolbar" aria-label="Show">
      {chips.map(({ filter: f, count }) => (
        <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => onFilter(f.id)} title={f.file ? f.id.slice(5) : undefined}>
          {f.file ? <span className="mono" style={{ fontSize: 11 }}>{f.label}</span> : f.label}
          <span className="c">{count}</span>
        </button>
      ))}
      {focus && (
        <button className="chip" aria-pressed="true" onClick={onUnfollow}>
          <RunnerTag name={focus} /> involved
          <span className="x" aria-label="stop following">
            ×
          </span>
        </button>
      )}
    </div>
  );
}

const When = ({ at }: { at: string }) => (
  <span className="when" title={at}>
    {hhmm(at)}
  </span>
);

function Head({ e, urgent = false }: { e: SnapshotEvent; urgent?: boolean }) {
  return (
    <div className="head">
      <RunnerName name={e.from} />
      {e.about && <span className="about">{e.about}</span>}
      {urgent && <span className="tag strong">urgent · stops and resumes</span>}
    </div>
  );
}

function BoardEvent({ e, fresh }: { e: SnapshotEvent; fresh: boolean }) {
  const { word, strong, rest } = eventLine(e.body);
  return (
    <li className={fresh ? "row event new" : "row event"} data-component="BoardEvent">
      <When at={e.at} />
      <p className="body">
        <RunnerName name={e.from} />
        {word && <span className={strong ? "tag strong" : "tag"}>{word}</span>}
        {rest && (
          <span>
            <RichText text={rest} mentions={false} />
          </span>
        )}
      </p>
    </li>
  );
}

function AgreementRow({ e, fresh }: { e: SnapshotEvent; fresh: boolean }) {
  return (
    <li className={fresh ? "row agreement new" : "row agreement"} data-component="AgreementRow">
      <When at={e.at} />
      <div>
        <Head e={e} />
        <div className="card-a">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" />
          </svg>
          <span>
            <b>Agreed.</b> <RichText text={e.body} />
          </span>
        </div>
      </div>
    </li>
  );
}

function UrgentRow({ e, fresh }: { e: SnapshotEvent; fresh: boolean }) {
  return (
    <li className={fresh ? "row urgent new" : "row urgent"} data-component="UrgentRow">
      <When at={e.at} />
      <div>
        <Head e={e} urgent />
        <p className="body">
          <RichText text={e.body} />
        </p>
      </div>
    </li>
  );
}

function BoardMessage({ e, lit, fresh }: { e: SnapshotEvent; lit: boolean; fresh: boolean }) {
  return (
    <li className={["row", "msg", lit && "lit", fresh && "new"].filter(Boolean).join(" ")} data-component="BoardMessage">
      <When at={e.at} />
      <div>
        <Head e={e} />
        <p className="body">
          <RichText text={e.body} />
        </p>
      </div>
    </li>
  );
}

export function Thread({
  chips,
  shown,
  filter,
  focus,
  isLit,
  fresh,
  onFilter,
  onUnfollow,
  onShowAll,
}: {
  chips: { filter: Filter; count: number }[];
  shown: SnapshotEvent[];
  filter: string;
  focus: string | null;
  isLit: (e: SnapshotEvent) => boolean;
  fresh: Set<number>;
  onFilter: (id: string) => void;
  onUnfollow: () => void;
  onShowAll: () => void;
}) {
  return (
    <section className="panel" data-component="Thread" aria-label="The thread">
      <FeedFilters chips={chips} filter={filter} focus={focus} onFilter={onFilter} onUnfollow={onUnfollow} />
      <ol className="feed" aria-live="polite">
        {shown.length ? (
          shown.map((e) => {
            const isNew = fresh.has(e.seq);
            if (e.kind === "event") return <BoardEvent key={e.seq} e={e} fresh={isNew} />;
            if (e.kind === "agreement") return <AgreementRow key={e.seq} e={e} fresh={isNew} />;
            if (e.kind === "urgent") return <UrgentRow key={e.seq} e={e} fresh={isNew} />;
            return <BoardMessage key={e.seq} e={e} lit={isLit(e)} fresh={isNew} />;
          })
        ) : (
          <li className="none">
            Nothing here yet. <button onClick={onShowAll}>Show everything</button>
          </li>
        )}
      </ol>
      <div className="reader" data-component="ReaderNote">
        You read; runners and orchestrators write. <code>swarm post "@S3 …" --about session.ts</code>
      </div>
    </section>
  );
}

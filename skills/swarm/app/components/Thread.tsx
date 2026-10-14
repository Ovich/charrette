import { useLayoutEffect, useMemo, useRef } from "react";
import type { SnapshotEvent } from "../../src/board/board.ts";
import { eventLine, flagAnswer, flagOf, hhmm, mergedRecipients, type FlagAnswer, type FlagLine, type Filter, type MentionCtx } from "../lib/view.ts";
import { FlagChip, RichText, RunnerName } from "./chips.tsx";

const NO_CTX: MentionCtx = { groups: [], names: new Map() };
import { PostBody } from "./PostBody.tsx";

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
          <RunnerName name={focus} /> involved
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

function Recipients({ label, runners }: { label: string; runners: string[] }) {
  if (!runners.length) return null;
  return (
    <span className="recipients" data-component="MergedRecipients" data-recipients={label}>
      <span className="tag">{label}</span>
      {runners.map((r) => (
        <RunnerName key={r} name={r} />
      ))}
    </span>
  );
}

function BoardEvent({ e, fresh, channelEvents, ctx }: { e: SnapshotEvent; fresh: boolean; channelEvents: SnapshotEvent[]; ctx: MentionCtx }) {
  const { word, strong, rest } = eventLine(e.body);
  const told = word === "merged" ? mergedRecipients(e, channelEvents, ctx) : null;
  return (
    <li id={`seq-${e.seq}`} className={fresh ? "row event new" : "row event"} data-component="BoardEvent">
      <When at={e.at} />
      <p className="body">
        <RunnerName name={e.from} />
        {word && <span className={strong ? "tag strong" : "tag"}>{word}</span>}
        {told && <Recipients label="rebase" runners={told.rebase} />}
        {told && <Recipients label="tell" runners={told.tell} />}
        {rest && (
          <span>
            <RichText text={rest} mentions={false} />
          </span>
        )}
      </p>
    </li>
  );
}

/** A file written outside its claim while another runner holds it (D10): a red chip, the path,
 *  the two runners, and under it what answered it. */
function FlagRow({ e, flag, answer, fresh }: { e: SnapshotEvent; flag: FlagLine; answer: FlagAnswer; fresh: boolean }) {
  return (
    <li id={`seq-${e.seq}`} className={fresh ? "row flag new" : "row flag"} data-component="FlagRow" data-kind="flag">
      <When at={e.at} />
      <div>
        <p className="body">
          <FlagChip />
          <RunnerName name={flag.writer} />
          <span>wrote</span>
          <code>{flag.path}</code>
          <span>outside its claim;</span>
          <RunnerName name={flag.holder} />
          <span>holds it</span>
        </p>
        <p className="flag-answer" data-component="FlagAnswer">
          {answer.state === "open" ? (
            "open"
          ) : (
            <>
              {answer.state === "settled" ? "settled by " : "answered by "}
              <a href={`#seq-${answer.seq}`}>#{answer.seq}</a>
            </>
          )}
        </p>
      </div>
    </li>
  );
}

function AgreementRow({ e, fresh, seqs }: { e: SnapshotEvent; fresh: boolean; seqs: ReadonlySet<number> }) {
  return (
    <li id={`seq-${e.seq}`} className={fresh ? "row agreement new" : "row agreement"} data-component="AgreementRow">
      <When at={e.at} />
      <div>
        <Head e={e} />
        <div className="card-a">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 8.5l3 3 7-7" />
          </svg>
          <span>
            <b>Agreed.</b> <PostBody body={e.body} shown={seqs} />
          </span>
        </div>
      </div>
    </li>
  );
}

function UrgentRow({ e, fresh, seqs }: { e: SnapshotEvent; fresh: boolean; seqs: ReadonlySet<number> }) {
  return (
    <li id={`seq-${e.seq}`} className={fresh ? "row urgent new" : "row urgent"} data-component="UrgentRow">
      <When at={e.at} />
      <div>
        <Head e={e} urgent />
        <div className="body">
          <PostBody body={e.body} shown={seqs} />
        </div>
      </div>
    </li>
  );
}

function BoardMessage({ e, lit, fresh, seqs }: { e: SnapshotEvent; lit: boolean; fresh: boolean; seqs: ReadonlySet<number> }) {
  return (
    <li id={`seq-${e.seq}`} className={["row", "msg", lit && "lit", fresh && "new"].filter(Boolean).join(" ")} data-component="BoardMessage">
      <When at={e.at} />
      <div>
        <Head e={e} />
        <div className="body">
          <PostBody body={e.body} shown={seqs} />
        </div>
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
  open = true,
  channelEvents = shown,
  ctx = NO_CTX,
}: {
  chips: { filter: Filter; count: number }[];
  shown: SnapshotEvent[];
  /** Every event of the channel, unfiltered: what a flag's answers and a merge's recipients are read from. */
  channelEvents?: SnapshotEvent[];
  ctx?: MentionCtx;
  filter: string;
  focus: string | null;
  isLit: (e: SnapshotEvent) => boolean;
  fresh: Set<number>;
  onFilter: (id: string) => void;
  onUnfollow: () => void;
  onShowAll: () => void;
  /** The channel is open; a closed run reads only (D19). */
  open?: boolean;
}) {
  // the rows a `#<n>` in a post can link to
  const seqs = useMemo(() => new Set(shown.map((e) => e.seq)), [shown]);
  // A thread reads from the bottom: it opens there, and follows new rows while the reader is there.
  const feedRef = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  const onScroll = () => {
    const el = feedRef.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };
  useLayoutEffect(() => {
    const el = feedRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [shown]);
  return (
    <section className="panel" data-component="Thread" aria-label="The thread">
      <FeedFilters chips={chips} filter={filter} focus={focus} onFilter={onFilter} onUnfollow={onUnfollow} />
      <ol className="feed" aria-live="polite" ref={feedRef} onScroll={onScroll}>
        {shown.length ? (
          shown.map((e) => {
            const isNew = fresh.has(e.seq);
            const flag = flagOf(e);
            if (flag) return <FlagRow key={e.seq} e={e} flag={flag} answer={flagAnswer(e, channelEvents)} fresh={isNew} />;
            if (e.kind === "event") return <BoardEvent key={e.seq} e={e} fresh={isNew} channelEvents={channelEvents} ctx={ctx} />;
            if (e.kind === "agreement") return <AgreementRow key={e.seq} e={e} fresh={isNew} seqs={seqs} />;
            if (e.kind === "urgent") return <UrgentRow key={e.seq} e={e} fresh={isNew} seqs={seqs} />;
            return <BoardMessage key={e.seq} e={e} lit={isLit(e)} fresh={isNew} seqs={seqs} />;
          })
        ) : (
          <li className="none">
            {filter === "all" && !focus ? "Nothing on this channel yet." : <>Nothing here. <button onClick={onShowAll}>Show everything</button></>}
          </li>
        )}
      </ol>
      <div className="reader" data-component="ReaderNote">
        {open ? (
          <>
            You read; runners and orchestrators write. <code>swarm post "@S3 …" --about session.ts</code>
          </>
        ) : (
          "closed: read-only"
        )}
      </div>
    </section>
  );
}

// The project's board (plan §3, "The page"): the repositories when the URL names several (D39),
// the channel rail, the selected channel's thread and roster, one claims panel for the
// repository and the merge lock while an open run's kind has one (D3).
import { useMemo, useState } from "react";
import { useBoard } from "./hooks/useBoard.ts";
import { channels, defaultChannel, feed, filters, lit, mentionCtx, nicksOf, scope, showsClaims, showsMergeLock, type ChannelId } from "./lib/view.ts";
import { NicksContext } from "./components/chips.tsx";
import { ChannelRail } from "./components/ChannelRail.tsx";
import { FileMap } from "./components/FileMap.tsx";
import { MergeLock } from "./components/MergeLock.tsx";
import { RepoList } from "./components/RepoList.tsx";
import { Roster } from "./components/Roster.tsx";
import { Thread } from "./components/Thread.tsx";

const NONE = new Set<never>();

export function BoardPage({ repos, run }: { repos: string[]; run: number | null }) {
  const [query, setQuery] = useState<{ repo: string | null; run: number | null }>({ repo: run === null ? (repos[0] ?? null) : null, run });
  // null: no channel chosen yet, the page opens on defaultChannel; a run in the URL always wins
  const [channel, setChannel] = useState<ChannelId | null>(run);
  const [focus, setFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const board = useBoard(query);
  const snapshot = board.snapshot;

  // the run asked for is not on the board: Main of the first repository, and a line saying so
  const missingRun = run !== null && (board.error !== null || (snapshot !== null && !snapshot.runs.some((r) => r.run === run))) ? run : null;
  if (missingRun !== null && query.run !== null) {
    setQuery({ repo: repos[0] ?? null, run: null });
    setChannel("main");
  }
  const groups = useMemo(() => (snapshot ? channels(snapshot) : null), [snapshot]);
  const known = (c: ChannelId): boolean => c === "main" || !!snapshot?.runs.some((r) => r.run === c);
  const wanted: ChannelId = channel ?? (snapshot ? defaultChannel(snapshot) : "main");
  const selected: ChannelId = known(wanted) ? wanted : "main";
  const view = useMemo(() => (snapshot ? scope(snapshot, selected) : null), [snapshot, selected]);
  const ctx = useMemo(() => (snapshot ? mentionCtx(snapshot) : { groups: [], names: new Map<string, string>() }), [snapshot]);
  const nicks = useMemo(() => (snapshot ? nicksOf(snapshot) : new Map<string, string>()), [snapshot]);
  const chips = useMemo(() => (view ? filters(view.events).map((f) => ({ filter: f, count: view.events.filter(f.test).length })) : []), [view]);
  const activeFilter = chips.some((c) => c.filter.id === filter) ? filter : "all";
  const shown = useMemo(() => (view ? feed(view.events, activeFilter, focus, ctx) : []), [view, activeFilter, focus, ctx]);

  const select = (c: ChannelId): void => {
    setChannel(c);
    setFocus(null);
    setFilter("all");
  };
  const pickRepo = (repo: string): void => {
    setQuery({ repo, run: null });
    setChannel(null);
    setFocus(null);
    setFilter("all");
  };

  if (board.error && missingRun === null) return <div className="content">{board.error}</div>;
  if (!snapshot || !groups || !view) return <div className="content">Loading the board…</div>;
  const listed = board.repos.filter((r) => repos.includes(r.repo));
  const selectedRun = snapshot.runs.find((r) => r.run === selected) ?? null;
  const titleOf = (plan: string): string => snapshot.runs.find((r) => r.plan === plan || r.group === plan)?.title ?? plan;
  return (
    <NicksContext.Provider value={nicks}>
      <div className="board-page" data-component="BoardPage">
        {repos.length >= 2 && <RepoList repos={listed} selected={snapshot.repo} onSelect={pickRepo} />}
        <ChannelRail groups={groups} selected={selected} onSelect={select} />
        <div className="content">
          {missingRun !== null && <p className="notice">run {missingRun} is not on this board</p>}
          {showsMergeLock(snapshot) && (
            <div className="run-lock">
              <MergeLock lock={snapshot.lock} />
            </div>
          )}
          {snapshot.runs.length === 0 ? (
            <p className="none" data-component="EmptyState">
              No run on {snapshot.name} yet.
            </p>
          ) : (
            <>
              <Roster roster={view.roster} planTitle={titleOf} focus={focus} fresh={NONE} onFollow={setFocus} />
              <Thread
                chips={chips}
                shown={shown}
                filter={activeFilter}
                focus={focus}
                isLit={(e) => lit(e, focus, ctx)}
                fresh={NONE}
                open={selectedRun ? selectedRun.open : true}
                onFilter={setFilter}
                onUnfollow={() => setFocus(null)}
                onShowAll={() => {
                  setFilter("all");
                  setFocus(null);
                }}
              />
              {showsClaims(snapshot) && <FileMap files={view.files} />}
            </>
          )}
        </div>
      </div>
    </NicksContext.Provider>
  );
}

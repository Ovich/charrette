// The project's board (plan §3, "The page"): the repositories when the URL names several (D39),
// the tab row (D7: ☰ archive, All, the open runs, the merge lock at its end), the picked run's
// thread and roster, one claims panel for the repository.
import { useCallback, useMemo, useState } from "react";
import type { RunId } from "../src/board/board.ts";
import { useBoard } from "./hooks/useBoard.ts";
import { archive, feed, filters, lit, mentionCtx, nicksOf, runTabs, scope, showsClaims, type Pick } from "./lib/view.ts";
import { NicksContext } from "./components/chips.tsx";
import { ArchivePanel } from "./components/ArchivePanel.tsx";
import { FileMap } from "./components/FileMap.tsx";
import { RepoList } from "./components/RepoList.tsx";
import { Roster } from "./components/Roster.tsx";
import { RunTabs } from "./components/RunTabs.tsx";
import { Thread } from "./components/Thread.tsx";

const NONE = new Set<never>();
const ALL: Pick = { run: null, follow: null };

export function BoardPage({ repos, run }: { repos: string[]; run: number | null }) {
  const [query, setQuery] = useState<{ repo: string | null; run: number | null }>({ repo: run === null ? (repos[0] ?? null) : null, run });
  // a run in the URL opens its tab, a closed one as an archived tab (gap 3)
  const [pick, setPick] = useState<Pick>({ run, follow: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const board = useBoard(query);
  const snapshot = board.snapshot;
  const focus = pick.follow;
  const setFocus = (follow: string | null): void => setPick((p) => ({ ...p, follow }));

  // the run asked for is not on the board: All of the first repository, and a line saying so
  const missingRun = run !== null && (board.error !== null || (snapshot !== null && !snapshot.runs.some((r) => r.run === run))) ? run : null;
  if (missingRun !== null && query.run !== null) {
    setQuery({ repo: repos[0] ?? null, run: null });
    setPick(ALL);
  }
  const tabs = useMemo(() => (snapshot ? runTabs(snapshot) : []), [snapshot]);
  const closedRuns = useMemo(() => (snapshot ? archive(snapshot, "") : []), [snapshot]);
  const searchArchive = useCallback((q: string) => (snapshot ? archive(snapshot, q) : []), [snapshot]);
  const known = (r: RunId | null): boolean => r === null || !!snapshot?.runs.some((s) => s.run === r);
  const picked: RunId | null = known(pick.run) ? pick.run : null;
  const archived = closedRuns.find((r) => r.run === picked) ?? null;
  // until the conversation (SL6) reads the pick, All shows Main's channel
  const view = useMemo(() => (snapshot ? scope(snapshot, picked ?? "main") : null), [snapshot, picked]);
  const ctx = useMemo(() => (snapshot ? mentionCtx(snapshot) : { groups: [], names: new Map<string, string>() }), [snapshot]);
  const nicks = useMemo(() => (snapshot ? nicksOf(snapshot) : new Map<string, string>()), [snapshot]);
  const chips = useMemo(() => (view ? filters(view.events).map((f) => ({ filter: f, count: view.events.filter(f.counts ?? f.test).length })) : []), [view]);
  const activeFilter = chips.some((c) => c.filter.id === filter) ? filter : "all";
  const shown = useMemo(() => (view ? feed(view.events, activeFilter, focus, ctx) : []), [view, activeFilter, focus, ctx]);

  const pickRun = (r: RunId | null): void => {
    setPick({ run: r, follow: null });
    setMenuOpen(false);
    setFilter("all");
  };
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const pickRepo = (repo: string): void => {
    setQuery({ repo, run: null });
    setPick(ALL);
    setMenuOpen(false);
    setFilter("all");
  };

  if (board.error && missingRun === null) return <div className="content">{board.error}</div>;
  if (!snapshot || !view) return <div className="content">Loading the board…</div>;
  const listed = board.repos.filter((r) => repos.includes(r.repo));
  const selectedRun = snapshot.runs.find((r) => r.run === picked) ?? null;
  const titleOf = (plan: string): string => snapshot.runs.find((r) => r.plan === plan || r.group === plan)?.title ?? plan;
  return (
    <NicksContext.Provider value={nicks}>
      <div className="board-page" data-component="BoardPage">
        {repos.length >= 2 && <RepoList repos={listed} selected={snapshot.repo} onSelect={pickRepo} />}
        <div className="content">
          <RunTabs tabs={tabs} archived={archived} pick={picked} lock={snapshot.lock} menuOpen={menuOpen} onMenu={setMenuOpen} onPick={pickRun} />
          {menuOpen && <ArchivePanel runs={searchArchive} total={closedRuns.length} onPick={pickRun} onClose={closeMenu} />}
          {missingRun !== null && <p className="notice">run {missingRun} is not on this board</p>}
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
                channelEvents={view.events}
                ctx={ctx}
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

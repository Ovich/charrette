// The page: one repository's board, live. It only reads; runners and orchestrators write.
// App owns the four selections (repository, run, runner followed, filter); what each region
// shows is a pure function of the snapshot and those (lib/view.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { useBoard } from "./hooks/useBoard.ts";
import { feed, filters, lit, mentionCtx, nicksOf, scope } from "./lib/view.ts";
import { NicksContext } from "./components/chips.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { Roster } from "./components/Roster.tsx";
import { Thread } from "./components/Thread.tsx";
import { EmptyState, FileMap, PlanQueues } from "./components/Aside.tsx";

const EMPTY = new Set<never>();

export function App() {
  const [repoSel, setRepoSel] = useState<string | null>(null);
  const [runSel, setRunSel] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  // the repository shown before the list arrives is none; then the one chosen, else the first with an open run
  const [known, setKnown] = useState<{ repo: string; open: boolean }[] | null>(null);
  const anyOpen = known?.some((r) => r.open) ?? false;
  const repo = (repoSel && known?.some((r) => r.repo === repoSel) ? repoSel : null) ?? (anyOpen ? known!.find((r) => r.open)!.repo : null);

  const { repos, snapshot, connection } = useBoard(repo);

  useEffect(() => {
    if (!repos) return;
    const next = repos.map((r) => ({ repo: r.repo, open: r.runs.some((x) => x.open) }));
    setKnown((k) => (JSON.stringify(k) === JSON.stringify(next) ? k : next));
  }, [repos]);

  // what arrived since the last snapshot of this repository rises in
  const seen = useRef<{ repo: string; seqs: Set<number>; runners: Set<string> } | null>(null);
  const [fresh, setFresh] = useState<{ seqs: Set<number>; runners: Set<string> }>({ seqs: EMPTY, runners: EMPTY });
  useEffect(() => {
    if (!snapshot) return;
    const seqs = new Set(snapshot.events.map((e) => e.seq));
    const runners = new Set(snapshot.roster.map((r) => r.runner));
    const prev = seen.current;
    if (prev && prev.repo === snapshot.repo) {
      setFresh({ seqs: new Set([...seqs].filter((s) => !prev.seqs.has(s))), runners: new Set([...runners].filter((r) => !prev.runners.has(r))) });
    } else setFresh({ seqs: EMPTY, runners: EMPTY });
    seen.current = { repo: snapshot.repo, seqs, runners };
  }, [snapshot]);

  const view = useMemo(() => (snapshot ? scope(snapshot, runSel) : null), [snapshot, runSel]);
  const ctx = useMemo(() => (snapshot ? mentionCtx(snapshot) : { plans: [], names: new Map<string, string>() }), [snapshot]);
  const nicks = useMemo(() => (snapshot ? nicksOf(snapshot) : new Map<string, string>()), [snapshot]);
  const chips = useMemo(() => (view ? filters(view.events).map((f) => ({ filter: f, count: view.events.filter(f.test).length })) : []), [view]);
  const activeFilter = chips.some((c) => c.filter.id === filter) ? filter : "all";
  const shown = useMemo(() => (view ? feed(view.events, activeFilter, focus, ctx) : []), [view, activeFilter, focus, ctx]);

  const latestRun = (plan: string) => [...(snapshot?.runs ?? [])].reverse().find((r) => r.plan === plan);
  const planTitle = (plan: string): string => latestRun(plan)?.title ?? plan;
  const planLink = (plan: string): string | null => latestRun(plan)?.link ?? null;

  const selectRepo = (id: string): void => {
    if (id !== repo) {
      setFocus(null);
      setFilter("all");
    }
    setRepoSel(id);
    setRunSel(null);
  };
  const selectRun = (id: string, plan: string): void => {
    if (id !== repo) {
      setRepoSel(id);
      setFilter("all");
      setRunSel(plan);
    } else setRunSel((r) => (r === plan ? null : plan));
    setFocus(null);
  };

  const port = typeof window !== "undefined" && window.location.port ? window.location.port : "4322";
  const showEmpty = repos !== null && repo === null;
  const board = !showEmpty && snapshot && view;

  return (
    <NicksContext.Provider value={nicks}>
      <div className="shell">
        <Sidebar repos={repos ?? []} repo={repo} runSel={runSel} connection={connection} port={port} hooksSeen={board ? snapshot.hooksSeen : undefined} onRepo={selectRepo} onRun={selectRun} />
        <div className="main">
          <TopBar
            name={board ? snapshot.name : null}
            title={board && runSel ? planTitle(runSel) : null}
            lock={board ? snapshot.lock : undefined}
          />
          {showEmpty && <EmptyState />}
          {board && (
            <div className="content">
              <Roster roster={view.roster} planTitle={planTitle} focus={focus} fresh={fresh.runners} onFollow={setFocus} />
              <div className="cols">
                <Thread
                  chips={chips}
                  shown={shown}
                  filter={activeFilter}
                  focus={focus}
                  isLit={(e) => lit(e, focus, ctx)}
                  fresh={fresh.seqs}
                  onFilter={setFilter}
                  onUnfollow={() => setFocus(null)}
                  onShowAll={() => {
                    setFilter("all");
                    setFocus(null);
                  }}
                />
                <div className="aside">
                  <PlanQueues queues={view.queues} planTitle={planTitle} planLink={planLink} />
                  <FileMap files={view.files} focus={focus} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </NicksContext.Provider>
  );
}

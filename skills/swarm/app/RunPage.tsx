// One run, as aiview frames it (plan D2, D3; the mockup's `aiview` variant): the merge lock up
// top, the roster and the thread scoped to the run. aiview's sidebar stands for the repositories
// rail and the plan document beside it for the queue, so neither is here, nor a top bar.
import { useMemo, useState } from "react";
import { useRun } from "./hooks/useRun.ts";
import { feed, filters, lit, mentionCtx, nicksOf, scope } from "./lib/view.ts";
import { NicksContext } from "./components/chips.tsx";
import { MergeLock } from "./components/TopBar.tsx";
import { Roster } from "./components/Roster.tsx";
import { Thread } from "./components/Thread.tsx";

const EMPTY = new Set<never>();

export function RunPage({ run }: { run: number }) {
  const { snapshot } = useRun(run);
  const [focus, setFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const summary = snapshot?.runs.find((r) => r.run === run) ?? null;
  // a run is its plan on the board: its runners are `<plan>/<slice>`, cross-plan mentions of them included
  const view = useMemo(() => (snapshot && summary ? scope(snapshot, summary.plan) : null), [snapshot, summary]);
  const ctx = useMemo(() => (snapshot ? mentionCtx(snapshot) : { plans: [], names: new Map<string, string>() }), [snapshot]);
  const nicks = useMemo(() => (snapshot ? nicksOf(snapshot) : new Map<string, string>()), [snapshot]);
  const chips = useMemo(() => (view ? filters(view.events).map((f) => ({ filter: f, count: view.events.filter(f.test).length })) : []), [view]);
  const activeFilter = chips.some((c) => c.filter.id === filter) ? filter : "all";
  const shown = useMemo(() => (view ? feed(view.events, activeFilter, focus, ctx) : []), [view, activeFilter, focus, ctx]);

  if (!snapshot || !summary || !view) return <div className="content">{snapshot ? `No run ${run} on this board.` : "Loading the run…"}</div>;
  return (
    <NicksContext.Provider value={nicks}>
      <div className="run-page" data-component="RunPage">
        <div className="run-lock">
          <MergeLock lock={snapshot.lock} />
        </div>
        <div className="content">
          <Roster roster={view.roster} planTitle={() => summary.title} focus={focus} fresh={EMPTY} onFollow={setFocus} />
          <Thread
            chips={chips}
            shown={shown}
            filter={activeFilter}
            focus={focus}
            isLit={(e) => lit(e, focus, ctx)}
            fresh={EMPTY}
            onFilter={setFilter}
            onUnfollow={() => setFocus(null)}
            onShowAll={() => {
              setFilter("all");
              setFocus(null);
            }}
          />
        </div>
      </div>
    </NicksContext.Provider>
  );
}

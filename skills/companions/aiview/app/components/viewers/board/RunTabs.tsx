// The board's top row (D7, prototype #643): Archive first, opening the closed runs, then one tab per open run, an
// archived run picked as a tab with ×, and the merge lock at the row's end, always visible.
// Analytics, beside the lock, opens the across-runs view; while it shows, no run tab is pressed.
import type { BoardSnapshot } from "../../../../../swarm-board/src/client/reader.ts";
import { runHue, seatCount, workerCount, type RunId, type RunTab } from "../../../lib/board/view.ts";
import { AnalyticsButton } from "./AnalyticsButton.tsx";
import { MergeLock } from "./MergeLock.tsx";

/** A tab's count: a plan's slices merged of its slices, a brainstorm's seats (its slice rows are seats, never slices
 *  to merge), as the archive reads them; none for a run with none. */
function TabCount({ tab }: { tab: RunTab }) {
  if (tab.of === 0) return null;
  return <span className="of">{tab.kind === "brainstorm" ? seatCount(tab.of) : tab.kind === "task" ? workerCount(tab.of) : `${tab.done}/${tab.of}`}</span>;
}

/** The tab's status pill: live or quiet in its colour, the count after it. */
function TabState({ tab }: { tab: RunTab }) {
  return (
    <span className={`st s-${tab.state}`} data-component="RunState" aria-label={tab.state}>
      {tab.state}
      {tab.of > 0 && " · "}
      <TabCount tab={tab} />
    </span>
  );
}

function RunTabButton({ tab, picked, onPick }: { tab: RunTab; picked: boolean; onPick: () => void }) {
  return (
    <button className={tab.state === "closed" ? "run closed" : "run"} data-component="RunTab" aria-pressed={picked} onClick={onPick}>
      <span className="code" style={{ color: `hsl(${runHue(tab.code)} 55% 45%)` }}>
        {tab.code}
      </span>
      <span className="t">{tab.title}</span>
      <span className="kind" title={tab.protocol ? `${tab.kind} run, protocol ${tab.protocol}` : undefined}>{tab.protocol ?? tab.kind}</span>
      <TabState tab={tab} />
    </button>
  );
}

export function RunTabs({
  tabs,
  archived,
  pick,
  lock,
  lockHistory,
  menuOpen,
  onMenu,
  onPick,
  analytics,
  onAnalytics,
  closedCount = 0,
}: {
  tabs: RunTab[];
  archived: RunTab | null;
  pick: RunId | null;
  lock: BoardSnapshot["lock"];
  lockHistory: BoardSnapshot["lockHistory"];
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  onPick: (run: RunId | null) => void;
  /** The across-runs view is shown. */
  analytics: boolean;
  onAnalytics: () => void;
  /** How many closed runs the archive holds, on its pill. */
  closedCount?: number;
}) {
  return (
    <nav className="runs" data-component="RunTabs" aria-label="Runs">
      {/* the tabs scroll in their own strip, so the tools beside them never cover one */}
      <span className="tabstrip">
      <button
        className="run menu"
        aria-label="Archive"
        title={`Archive: ${closedCount} closed runs`}
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          onMenu(!menuOpen);
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
        </svg>
      </button>
      {tabs.map((t) => (
        <RunTabButton key={t.run} tab={t} picked={!analytics && pick === t.run} onPick={() => onPick(t.run)} />
      ))}
      {archived && (
        <span className="run archived" data-component="ArchivedTab" aria-pressed={!analytics && pick === archived.run}>
          <span className="code" style={{ color: `hsl(${runHue(archived.code)} 55% 45%)` }}>
            {archived.code}
          </span>
          <span className="t">{archived.title}</span>
          <span className="kind">{archived.protocol ?? archived.kind}</span>
          <span className="st">
            archived{archived.of > 0 && " · "}
            <TabCount tab={archived} />
          </span>
          <button className="x" aria-label="Close the archived run" onClick={() => onPick(tabs[0]?.run ?? null)}>
            ×
          </button>
        </span>
      )}
      </span>
      <span className="lockwrap">
        <AnalyticsButton pressed={analytics} onPress={onAnalytics} />
        <MergeLock lock={lock} history={lockHistory} />
      </span>
    </nav>
  );
}

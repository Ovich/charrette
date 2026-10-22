// The board's top row (D7, mockup #643): ☰ opens the archive, All, one tab per open run, an
// archived run picked as a tab with ×, and the merge lock at the row's end, always visible.
// Analytics, beside the lock, opens the across-runs view; while it shows, no run tab is pressed.
import type { BoardSnapshot } from "../../../../../swarm/src/client/reader.ts";
import { runHue, seatCount, type RunId, type RunTab } from "../../../lib/board/view.ts";
import { AnalyticsButton } from "./AnalyticsButton.tsx";
import { MergeLock } from "./MergeLock.tsx";

/** A tab's count: a plan's slices merged of its slices, a brainstorm's seats (its slice rows are seats, never slices
 *  to merge), as the archive reads them; none for a run with none. */
function TabCount({ tab }: { tab: RunTab }) {
  if (tab.of === 0) return null;
  return <span className="of">{tab.kind === "brainstorm" ? seatCount(tab.of) : `${tab.done}/${tab.of}`}</span>;
}

function RunTabButton({ tab, picked, onPick }: { tab: RunTab; picked: boolean; onPick: () => void }) {
  return (
    <button className={tab.state === "closed" ? "run closed" : "run"} data-component="RunTab" aria-pressed={picked} onClick={onPick}>
      <span className={`dot ${tab.state}`} aria-label={tab.state} />
      <span className="code" style={{ color: `hsl(${runHue(tab.code)} 55% 45%)` }}>
        {tab.code}
      </span>
      <span className="t">{tab.title}</span>
      <TabCount tab={tab} />
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
}) {
  return (
    <nav className="runs" data-component="RunTabs" aria-label="Runs">
      <button
        className="menu"
        aria-label="Archive"
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
      <button className="run" aria-pressed={!analytics && pick === null} onClick={() => onPick(null)}>
        All
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
          <TabCount tab={archived} />
          <span className="of">archived</span>
          <button className="x" aria-label="Close the archived run" onClick={() => onPick(null)}>
            ×
          </button>
        </span>
      )}
      <span className="lockwrap">
        <AnalyticsButton pressed={analytics} onPress={onAnalytics} />
        <MergeLock lock={lock} history={lockHistory} />
      </span>
    </nav>
  );
}

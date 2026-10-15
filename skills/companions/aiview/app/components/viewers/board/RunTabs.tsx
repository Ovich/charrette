// The board's top row (D7, mockup #643): ☰ opens the archive, All, one tab per open run, an
// archived run picked as a tab with ×, and the merge lock at the row's end, always visible.
import type { BoardSnapshot } from "../../../../../swarm/src/board/snapshot.ts";
import { runHue, type RunId, type RunTab } from "../../../lib/board/view.ts";
import { MergeLock } from "./MergeLock.tsx";

function RunTabButton({ tab, picked, onPick }: { tab: RunTab; picked: boolean; onPick: () => void }) {
  return (
    <button className={tab.state === "closed" ? "run closed" : "run"} data-component="RunTab" aria-pressed={picked} onClick={onPick}>
      <span className={`dot ${tab.state}`} aria-label={tab.state} />
      <span className="code" style={{ color: `hsl(${runHue(tab.code)} 55% 45%)` }}>
        {tab.code}
      </span>
      <span className="t">{tab.title}</span>
      {tab.of > 0 && (
        <span className="of">
          {tab.done}/{tab.of}
        </span>
      )}
    </button>
  );
}

export function RunTabs({
  tabs,
  archived,
  pick,
  lock,
  menuOpen,
  onMenu,
  onPick,
}: {
  tabs: RunTab[];
  archived: RunTab | null;
  pick: RunId | null;
  lock: BoardSnapshot["lock"];
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  onPick: (run: RunId | null) => void;
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
      <button className="run" aria-pressed={pick === null} onClick={() => onPick(null)}>
        All
      </button>
      {tabs.map((t) => (
        <RunTabButton key={t.run} tab={t} picked={pick === t.run} onPick={() => onPick(t.run)} />
      ))}
      {archived && (
        <span className="run archived" data-component="ArchivedTab" aria-pressed={pick === archived.run}>
          <span className="code" style={{ color: `hsl(${runHue(archived.code)} 55% 45%)` }}>
            {archived.code}
          </span>
          <span className="t">{archived.title}</span>
          {archived.of > 0 && (
            <span className="of">
              {archived.done}/{archived.of}
            </span>
          )}
          <span className="of">archived</span>
          <button className="x" aria-label="Close the archived run" onClick={() => onPick(null)}>
            ×
          </button>
        </span>
      )}
      <span className="lockwrap">
        <MergeLock lock={lock} />
      </span>
    </nav>
  );
}

// The project's board, drawn by aiview (companions-merge §3): the repositories when the document
// names several, the tab row (☰ archive, All, the open runs, the merge lock at its end), the picked
// run's agent strip, the conversation, the claims row. aiview's theme; board.css reaches only `.board`.
import { useCallback, useMemo, useState } from "react";
import { useBoard } from "../../../hooks/useBoard.ts";
import { agents, archive, claimRows, conversation, narrow, nicksOf, openingRun, runHue, runTabs, type Narrow, type Pick, type RunId } from "../../../lib/board/view.ts";
import { ConversationFilters } from "./ConversationFilters.tsx";
import { NicksContext } from "./chips.tsx";
import { AgentStrip } from "./AgentStrip.tsx";
import { ArchivePanel } from "./ArchivePanel.tsx";
import { ClaimsRow } from "./ClaimsRow.tsx";
import { RepoList } from "./RepoList.tsx";
import { RunTabs } from "./RunTabs.tsx";
import { Conversation } from "./Conversation.tsx";
import { TipLayer } from "./Tip.tsx";
import "./board.css";

/** The repositories a swarm document's file names (D6): `{ repos: [...] }`, or a pre-merge
 *  `{ url }` read for its `?repo=` values; null when the file names none. */
export function boardReposOf(content: string): string[] | null {
  let parsed: { repos?: unknown; url?: unknown } | null;
  try {
    parsed = JSON.parse(content) as { repos?: unknown; url?: unknown } | null;
  } catch {
    return null;
  }
  if (Array.isArray(parsed?.repos)) {
    const repos = parsed.repos.filter((r): r is string => typeof r === "string" && r !== "");
    if (repos.length > 0) return repos;
  }
  if (typeof parsed?.url === "string") {
    try {
      const repos = new URL(parsed.url).searchParams.getAll("repo").filter(Boolean);
      if (repos.length > 0) return repos;
    } catch {
      /* not a URL: names nothing */
    }
  }
  return null;
}

const NONE = new Set<never>();
const ALL: Pick = { run: null, follow: null };
const UNNARROWED: Narrow = { kind: "all", file: null };

export function BoardView({ repos, run }: { repos: string[]; run: number | null }) {
  const [query, setQuery] = useState<{ repo: string | null; run: number | null }>({ repo: run === null ? (repos[0] ?? null) : null, run });
  // a run in the URL opens its tab, a closed one as an archived tab (gap 3)
  const [pick, setPick] = useState<Pick>({ run, follow: null });
  // false until the board has opened on a tab: the URL's run, or the one openingRun names (D17)
  const [opened, setOpened] = useState(run !== null);
  const [menuOpen, setMenuOpen] = useState(false);
  // kept beside the pick, never in the URL: a reload starts unnarrowed
  const [narrowing, setNarrowing] = useState<Narrow>(UNNARROWED);
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
  // the first snapshot of the repository asked opens its tab by itself, unless the person picked first
  if (!opened && snapshot && (query.repo === null || snapshot.repo === query.repo)) {
    setOpened(true);
    setPick((p) => ({ ...p, run: openingRun(snapshot) }));
  }
  const tabs = useMemo(() => (snapshot ? runTabs(snapshot) : []), [snapshot]);
  const closedRuns = useMemo(() => (snapshot ? archive(snapshot, "") : []), [snapshot]);
  const searchArchive = useCallback((q: string) => (snapshot ? archive(snapshot, q) : []), [snapshot]);
  const known = (r: RunId | null): boolean => r === null || !!snapshot?.runs.some((s) => s.run === r);
  const picked: RunId | null = known(pick.run) ? pick.run : null;
  const archived = closedRuns.find((r) => r.run === picked) ?? null;
  const nicks = useMemo(() => (snapshot ? nicksOf(snapshot) : new Map<string, string>()), [snapshot]);
  const items = useMemo(() => (snapshot ? conversation(snapshot, { run: picked, follow: focus }) : []), [snapshot, picked, focus]);
  // a closed run picked reads "Archived <when> · read only · <done> of <of> slices" first
  const shown = useMemo(() => narrow(items, narrowing), [items, narrowing]);
  const archivedLine = useMemo(() => (archived ? { closed: archived.closed, summary: `${archived.done} of ${archived.of} slices` } : null), [archived]);

  const pickRun = (r: RunId | null): void => {
    setOpened(true);
    setPick({ run: r, follow: null });
    // the kind stays; the file goes when the new run has no item about it
    if (snapshot && narrowing.file && !conversation(snapshot, { run: r, follow: null }).some((i) => i.about === narrowing.file)) setNarrowing((n) => ({ ...n, file: null }));
    setMenuOpen(false);
  };
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const pickRepo = (repo: string): void => {
    setQuery({ repo, run: null });
    setPick(ALL);
    // the person's pick of a repository opens it on All, as before D17
    setOpened(true);
    setNarrowing((n) => ({ ...n, file: null }));
    setMenuOpen(false);
  };

  const notYet = (state: "error" | "loading", text: string) => (
    <div className="board" data-component="BoardView" data-state={state}>
      <div className="content">{text}</div>
    </div>
  );
  if (board.error && missingRun === null) return notYet("error", board.error);
  if (!snapshot) return notYet("loading", "Loading the board…");
  const listed = board.repos.filter((r) => repos.includes(r.repo));
  const selectedRun = snapshot.runs.find((r) => r.run === picked) ?? null;
  // the agent strip under a picked run, open or closed; the claims row hidden under a closed one (D7)
  const members = picked === null ? [] : agents(snapshot, picked);
  const claims = selectedRun && !selectedRun.open ? null : claimRows(snapshot, picked);
  return (
    <NicksContext.Provider value={nicks}>
      <div className="board" data-component="BoardView" data-state={snapshot.runs.length === 0 ? "no run yet" : "board"}>
        <TipLayer />
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
              <AgentStrip agents={members} hue={selectedRun ? runHue(selectedRun.code) : 0} follow={focus} onFollow={setFocus} />
              <ConversationFilters items={items} narrow={narrowing} onNarrow={setNarrowing} />
              <Conversation items={shown} archived={archivedLine} fresh={NONE} />
              {claims && <ClaimsRow rows={claims} />}
            </>
          )}
        </div>
      </div>
    </NicksContext.Provider>
  );
}

// The project's board, drawn by aiview (companions-merge §3): the repositories when the document
// names several, the tab row (☰ archive, All, the open runs, the merge lock at its end), the picked
// run's switch between its conversation (the agent strip, the conversation, the claims row) and its
// Analytics, and the across-runs view. aiview's theme; board.css reaches only `.board`.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBoard } from "../../../hooks/useBoard.ts";
import { agents, archive, claimRows, conversation, narrow, nicksOf, openingRun, runHue, runTabs, type Narrow, type Pick, type RunId } from "../../../lib/board/view.ts";
import {
  boardFieldsOf,
  DEFAULT_SCOPE,
  hashWithAcross,
  hashWithRunAnalytics,
  readAcross,
  readRunAnalytics,
  readRunInHash,
  summaryLine,
  type AcrossScope,
  type RunView,
} from "../../../lib/board/analytics.ts";
import { AcrossRunsView } from "./AcrossRunsView.tsx";
import { ConversationFilters } from "./ConversationFilters.tsx";
import { NicksContext } from "./chips.tsx";
import { AgentStrip } from "./AgentStrip.tsx";
import { ArchivePanel } from "./ArchivePanel.tsx";
import { ClaimsRow } from "./ClaimsRow.tsx";
import { RepoList } from "./RepoList.tsx";
import { RunAnalytics } from "./RunAnalytics.tsx";
import { RunTabs } from "./RunTabs.tsx";
import { RunViewSwitch } from "./RunViewSwitch.tsx";
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

/** The hash, replaced and never pushed: it keeps the document and its pointer, and fires no hashchange. */
const replaceHash = (hash: string): void => history.replaceState(history.state, "", `#${hash}`);

export function BoardView({ repos, run: asked }: { repos: string[]; run: number | null }) {
  // a run's Analytics in the URL reopens that run on it after a reload (D31); a run the document names wins
  const [analyticsInUrl] = useState<RunId | null>(() => readRunAnalytics(location.hash));
  const run = asked ?? analyticsInUrl;
  const [query, setQuery] = useState<{ repo: string | null; run: number | null }>({ repo: run === null ? (repos[0] ?? null) : null, run });
  // a run in the URL opens its tab, a closed one as an archived tab (gap 3)
  const [pick, setPick] = useState<Pick>({ run, follow: null });
  // false until the board has opened on a tab: the URL's run, or the one openingRun names (D17)
  const [opened, setOpened] = useState(run !== null);
  const [menuOpen, setMenuOpen] = useState(false);
  // kept beside the pick, never in the URL: a reload starts unnarrowed
  const [narrowing, setNarrowing] = useState<Narrow>(UNNARROWED);
  // the across-runs view and its scope, in the URL: a reload reopens them (D31)
  const [across, setAcross] = useState<AcrossScope | null>(() => readAcross(location.hash));
  // a picked run tab opens on its conversation; Analytics is in the URL (D31)
  const [runView, setRunView] = useState<RunView>(run !== null && run === analyticsInUrl ? "analytics" : "conversation");
  // a timeline mark clicked: the post to bring into view once the conversation shows
  const [postToShow, setPostToShow] = useState<number | null>(null);
  // the board fields the hash held when the board last wrote or followed it: a hashchange that changes them is a link
  // or the back button, followed without a reload
  const hashSeen = useRef(boardFieldsOf(location.hash));
  const writeHash = (hash: string): void => {
    replaceHash(hash);
    hashSeen.current = boardFieldsOf(hash);
  };
  useEffect(() => {
    const follow = (): void => {
      const fields = boardFieldsOf(location.hash);
      if (fields === hashSeen.current) return;
      hashSeen.current = fields;
      const scope = readAcross(location.hash);
      setAcross(scope);
      setMenuOpen(false);
      if (scope) return;
      setRunView(readRunAnalytics(location.hash) !== null ? "analytics" : "conversation");
      setOpened(true);
      setPick({ run: readRunInHash(location.hash), follow: null });
    };
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
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

  useEffect(() => {
    if (postToShow === null || runView !== "conversation") return;
    document.getElementById(`seq-${postToShow}`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    setPostToShow(null);
  }, [postToShow, runView]);

  const showAcross = (scope: AcrossScope | null): void => {
    setAcross(scope);
    // the across view takes a run's Analytics out of the URL: a reload reopens the across view
    writeHash(hashWithRunAnalytics(hashWithAcross(location.hash, scope), null));
  };
  const showRunView = (r: RunId | null, view: RunView): void => {
    setRunView(view);
    writeHash(hashWithRunAnalytics(location.hash, view === "analytics" ? r : null));
  };

  const pickRun = (r: RunId | null): void => {
    // a run tab or All leaves the across view
    if (across) showAcross(null);
    showRunView(r, "conversation");
    setOpened(true);
    setPick({ run: r, follow: null });
    // the kind stays; the file goes when the new run has no item about it
    if (snapshot && narrowing.file && !conversation(snapshot, { run: r, follow: null }).some((i) => i.about === narrowing.file)) setNarrowing((n) => ({ ...n, file: null }));
    setMenuOpen(false);
  };
  // a RunsTable row: the run's tab, on its Analytics (D33)
  const openRunAnalytics = (r: RunId): void => {
    pickRun(r);
    showRunView(r, "analytics");
  };
  // a timeline mark: the run's conversation, unnarrowed, scrolled to the post
  const openPost = (seq: number): void => {
    showRunView(picked, "conversation");
    setNarrowing(UNNARROWED);
    setFocus(null);
    setPostToShow(seq);
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
          <RunTabs
            tabs={tabs}
            archived={archived}
            pick={picked}
            lock={snapshot.lock}
            menuOpen={menuOpen}
            onMenu={setMenuOpen}
            onPick={pickRun}
            analytics={across !== null}
            onAnalytics={() => showAcross(across ?? DEFAULT_SCOPE)}
          />
          {menuOpen && <ArchivePanel runs={searchArchive} total={closedRuns.length} onPick={pickRun} onClose={closeMenu} />}
          {missingRun !== null && <p className="notice">run {missingRun} is not on this board</p>}
          {across !== null ? (
            <AcrossRunsView repo={snapshot.repo} repoName={snapshot.name} scope={across} onScope={showAcross} onOpenRun={openRunAnalytics} />
          ) : snapshot.runs.length === 0 ? (
            <p className="none" data-component="EmptyState">
              No run on {snapshot.name} yet.
            </p>
          ) : selectedRun && runView === "analytics" ? (
            <RunAnalytics key={selectedRun.run} repo={snapshot.repo} summary={selectedRun} onView={(v) => showRunView(selectedRun.run, v)} onOpenPost={openPost} />
          ) : (
            <>
              {selectedRun && <RunViewSwitch view="conversation" line={summaryLine(selectedRun)} json={null} onView={(v) => showRunView(selectedRun.run, v)} />}
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

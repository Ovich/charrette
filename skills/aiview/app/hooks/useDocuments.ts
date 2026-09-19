import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDocuments, type DocumentWithState } from "../lib/api.ts";
import type { Pointer } from "../../src/core/pointer.ts";

export type ConnectionState = "connecting" | "live" | "reconnecting";

export const ALL_PROJECTS = "*";

/** Nothing heard for this long means the stream is dead, whatever the browser thinks.
 *  Three server heartbeats (src/server/sse.ts), so one lost beat is not a reconnect. */
export const SILENCE_MS = 45_000;

/** Has the stream gone quiet? An EventSource whose socket broke without a FIN stays
 *  `OPEN` and fires no error, so silence is the only evidence there is. */
export const isSilent = (lastSeenMs: number, nowMs: number, timeoutMs = SILENCE_MS): boolean =>
  nowMs - lastSeenMs >= timeoutMs;

export interface DocumentsState {
  docs: DocumentWithState[];
  groups: Record<string, string>;
  projects: Record<string, string>;
  /** The active project, shared with the CLI. `*` = All projects. */
  activeProject: string;
  startId: number | null;
  /** The collection's version, or null when the server could not read one. */
  version: string | null;
  connection: ConnectionState;
  /** Bumped whenever the given doc id changed on disk — viewers key refetches off it. */
  changedTick: number;
  changedId: number | null;
  /** Bumped whenever the agent points at a mockup's components (`aiview show`). */
  shownTick: number;
  shown: Pointer | null;
  /** Bumped when the agent says the pointing is over (`aiview show --done`). */
  showDoneTick: number;
  reload: () => void;
}

export function useDocuments(): DocumentsState {
  const [docs, setDocs] = useState<DocumentWithState[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [activeProject, setActiveProject] = useState<string>(ALL_PROJECTS);
  const [startId, setStartId] = useState<number | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [changed, setChanged] = useState<{ tick: number; id: number | null }>({ tick: 0, id: null });
  const [shown, setShown] = useState<{ tick: number; pointer: Pointer | null }>({ tick: 0, pointer: null });
  const [showDoneTick, setShowDoneTick] = useState(0);
  const loadedOnce = useRef(false);

  const reload = useCallback(() => {
    fetchDocuments()
      .then((data) => {
        setDocs(data.documents);
        setGroups(data.groups);
        setProjects(data.projects);
        setActiveProject(data.activeProject);
        setVersion(data.version ?? null);
        if (!loadedOnce.current) {
          setStartId(data.start);
          loadedOnce.current = true;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    let es: EventSource | null = null;
    let lastSeen = Date.now();

    const connect = (): void => {
      es?.close();
      lastSeen = Date.now();
      es = new EventSource("/events");
      es.onopen = () => setConnection("live");
      es.onerror = () => setConnection("reconnecting");
      es.onmessage = (e) => {
        lastSeen = Date.now();
        const ev = JSON.parse(e.data) as { type: string; id?: number; slug?: string; components?: string[]; variant?: string };
        if (ev.type === "hello" || ev.type === "ping") setConnection("live");
        if (ev.type === "changed") {
          reload();
          setChanged((c) => ({ tick: c.tick + 1, id: ev.id ?? null }));
        }
        // A document was registered, moved, re-tagged or dropped by the CLI: the list
        // itself moved, so refetch it. This is what makes a new document appear without
        // a manual refresh — `changed` only fires for files already being watched.
        if (ev.type === "index") reload();
        // The agent is pointing at a mockup's components: this tab goes there.
        if (ev.type === "show" && typeof ev.id === "number") {
          const pointer: Pointer = { id: ev.id, components: ev.components ?? [], ...(ev.variant ? { variant: ev.variant } : {}) };
          setShown((s) => ({ tick: s.tick + 1, pointer }));
        }
        if (ev.type === "show-done") setShowDoneTick((t) => t + 1);
        // The agent switched project: this tab follows (D3).
        if (ev.type === "project" && ev.slug) setActiveProject(ev.slug);
      };
    };
    connect();

    // The watchdog. A broken socket that never sent a FIN leaves the EventSource `OPEN`
    // and silent, so no error ever fires and the tab shows stale documents while the
    // sidebar says "live". Silence past three heartbeats is taken as death: reconnect,
    // and catch up on everything missed — the list, and the open document, which a null
    // `id` reloads whatever it is.
    const watchdog = setInterval(() => {
      if (!isSilent(lastSeen, Date.now())) return;
      setConnection("reconnecting");
      connect();
      reload();
      setChanged((c) => ({ tick: c.tick + 1, id: null }));
    }, SILENCE_MS / 3);

    return () => {
      clearInterval(watchdog);
      es?.close();
    };
  }, [reload]);

  return {
    docs,
    groups,
    projects,
    activeProject,
    startId,
    version,
    connection,
    changedTick: changed.tick,
    changedId: changed.id,
    shownTick: shown.tick,
    shown: shown.pointer,
    showDoneTick,
    reload,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDocuments, type DocumentWithState } from "../lib/api.ts";

export type ConnectionState = "connecting" | "live" | "reconnecting";

export const ALL_PROJECTS = "*";

export interface DocumentsState {
  docs: DocumentWithState[];
  groups: Record<string, string>;
  projects: Record<string, string>;
  /** The active project, shared with the CLI. `*` = All projects. */
  activeProject: string;
  startId: number | null;
  connection: ConnectionState;
  /** Bumped whenever the given doc id changed on disk — viewers key refetches off it. */
  changedTick: number;
  changedId: number | null;
  reload: () => void;
}

export function useDocuments(): DocumentsState {
  const [docs, setDocs] = useState<DocumentWithState[]>([]);
  const [groups, setGroups] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [activeProject, setActiveProject] = useState<string>(ALL_PROJECTS);
  const [startId, setStartId] = useState<number | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [changed, setChanged] = useState<{ tick: number; id: number | null }>({ tick: 0, id: null });
  const loadedOnce = useRef(false);

  const reload = useCallback(() => {
    fetchDocuments()
      .then((data) => {
        setDocs(data.documents);
        setGroups(data.groups);
        setProjects(data.projects);
        setActiveProject(data.activeProject);
        if (!loadedOnce.current) {
          setStartId(data.start);
          loadedOnce.current = true;
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    reload();
    const es = new EventSource("/events");
    es.onopen = () => setConnection("live");
    es.onerror = () => setConnection("reconnecting");
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data) as { type: string; id?: number; slug?: string };
      if (ev.type === "hello") setConnection("live");
      if (ev.type === "changed") {
        reload();
        setChanged((c) => ({ tick: c.tick + 1, id: ev.id ?? null }));
      }
      // A document was registered, moved, re-tagged or dropped by the CLI: the list
      // itself moved, so refetch it. This is what makes a new document appear without
      // a manual refresh — `changed` only fires for files already being watched.
      if (ev.type === "index") reload();
      // The agent switched project: this tab follows (D3).
      if (ev.type === "project" && ev.slug) setActiveProject(ev.slug);
    };
    return () => es.close();
  }, [reload]);

  return {
    docs,
    groups,
    projects,
    activeProject,
    startId,
    connection,
    changedTick: changed.tick,
    changedId: changed.id,
    reload,
  };
}

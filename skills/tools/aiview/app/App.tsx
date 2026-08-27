import { useCallback, useEffect, useRef, useState } from "react";
import { fetchDocument, setActiveProject, type DocumentResponse } from "./lib/api.ts";
import { useDocuments } from "./hooks/useDocuments.ts";
import { Sidebar } from "./components/shell/Sidebar.tsx";
import { TopBar } from "./components/shell/TopBar.tsx";
import { DocHeader } from "./components/docs/DocHeader.tsx";
import { MarkdownView } from "./components/viewers/MarkdownView.tsx";
import { PendingCards } from "./components/docs/PendingCards.tsx";
import { MockupFrame } from "./components/viewers/MockupFrame.tsx";
import { PdfFrame } from "./components/viewers/PdfFrame.tsx";

const hashId = (): number | null => {
  const m = location.hash.match(/doc=(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Does the reading pane need to fetch?
 *
 *  Two different reasons to load, and they must not be confused:
 *  selecting a different document ALWAYS loads, while a file-change event only
 *  reloads the document it names. The bug this replaced applied the change-event
 *  test to selections too, so once any other document changed on disk, clicking a
 *  new one left the pane showing the old content. */
export function shouldLoad(
  currentId: number | null,
  loadedId: number | null,
  changedTick: number,
  changedId: number | null,
): boolean {
  if (currentId === null) return false;
  if (loadedId !== currentId) return true; // a new selection: always
  return changedTick === 0 || changedId === null || changedId === currentId;
}

export function App() {
  const { docs, groups, projects, activeProject, startId, connection, changedTick, changedId } = useDocuments();
  const [currentId, setCurrentId] = useState<number | null>(hashId);
  const [response, setResponse] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  /** Which document the pane is actually showing, so a selection is never mistaken
   *  for a refetch of the same one. */
  const loadedId = useRef<number | null>(null);

  // The server owns the active project; the SSE echo is what actually moves this tab,
  // so picking is fire-and-follow rather than optimistic local state.
  const pickProject = useCallback((slug: string) => {
    setActiveProject(slug).catch(() => {});
  }, []);

  const open = useCallback(
    (id: number) => {
      setCurrentId(id);
      location.hash = `doc=${id}`;
      // Opening a document outside the active project moves the mode to it (D9),
      // so the selector never disagrees with what is on screen.
      const target = docs.find((d) => d.id === id);
      if (target && activeProject !== "*" && target.project !== activeProject) pickProject(target.project);
    },
    [docs, activeProject, pickProject],
  );

  // initial doc: hash wins, then the serve --open start doc, then the newest
  useEffect(() => {
    if (currentId === null && (startId !== null || docs.length > 0)) {
      const id = startId ?? docs[0]?.id;
      if (id != null) setCurrentId(id);
    }
  }, [startId, docs, currentId]);

  useEffect(() => {
    const onHash = () => {
      const id = hashId();
      if (id !== null && id !== currentId) setCurrentId(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [currentId]);

  // (re)load the open document — also when the SSE says it changed on disk
  useEffect(() => {
    if (!shouldLoad(currentId, loadedId.current, changedTick, changedId)) return;
    let cancelled = false;
    setLoading(true);
    fetchDocument(currentId!)
      .then((r) => {
        if (cancelled) return;
        setResponse(r);
        loadedId.current = currentId;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentId, changedTick, changedId]);

  useEffect(() => {
    document.title = response?.document.title ?? "aiview";
  }, [response]);

  const doc = response?.document ?? null;
  const format = response?.format;

  return (
    <div className="grid min-h-screen grid-cols-[320px_minmax(0,1fr)] max-md:grid-cols-1">
      <Sidebar
        docs={docs}
        groups={groups}
        projects={projects}
        activeProject={activeProject}
        connection={connection}
        currentId={currentId}
        onOpen={open}
        onPickProject={pickProject}
      />
      <div className="flex min-w-0 flex-col">
        <TopBar doc={doc} groups={groups} printable={format === "markdown"} />
        <main className="w-full px-7 pb-20 pt-8 max-md:px-4 max-md:pt-5">
          {doc === null && !loading && (
            <p className="text-muted-foreground">Pick a document on the left.</p>
          )}
          {doc && (
            <>
              <DocHeader doc={doc} />
              <PendingCards items={response!.pending ?? []} />
              {response!.content === null && format !== "pdf" && (
                <p className="text-muted-foreground">
                  File is missing on disk: <code className="font-mono text-[12px]">{doc.abs_path}</code>
                </p>
              )}
              {format === "pdf" && <PdfFrame docId={doc.id} changedTick={changedTick} />}
              {format === "html" && response!.content !== null && <MockupFrame html={response!.content} />}
              {format === "markdown" && response!.content !== null && (
                <MarkdownView content={response!.content} docId={doc.id} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

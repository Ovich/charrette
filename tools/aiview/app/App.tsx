import { useCallback, useEffect, useState } from "react";
import { fetchDocument, type DocumentResponse } from "./lib/api.ts";
import { useDocuments } from "./hooks/useDocuments.ts";
import { Sidebar } from "./components/shell/Sidebar.tsx";
import { TopBar } from "./components/shell/TopBar.tsx";
import { DocHeader } from "./components/docs/DocHeader.tsx";
import { MarkdownView } from "./components/viewers/MarkdownView.tsx";
import { MockupFrame } from "./components/viewers/MockupFrame.tsx";
import { PdfFrame } from "./components/viewers/PdfFrame.tsx";

const hashId = (): number | null => {
  const m = location.hash.match(/doc=(\d+)/);
  return m ? Number(m[1]) : null;
};

export function App() {
  const { docs, groups, startId, connection, changedTick, changedId } = useDocuments();
  const [currentId, setCurrentId] = useState<number | null>(hashId);
  const [response, setResponse] = useState<DocumentResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const open = useCallback((id: number) => {
    setCurrentId(id);
    location.hash = `doc=${id}`;
  }, []);

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
    if (currentId === null) return;
    if (changedTick > 0 && changedId !== null && changedId !== currentId) return;
    let cancelled = false;
    setLoading(true);
    fetchDocument(currentId)
      .then((r) => {
        if (!cancelled) setResponse(r);
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
  const wide = format === "html" || format === "pdf";

  return (
    <div className="grid min-h-screen grid-cols-[320px_minmax(0,1fr)] max-md:grid-cols-1">
      <Sidebar docs={docs} groups={groups} connection={connection} currentId={currentId} onOpen={open} />
      <div className="flex min-w-0 flex-col">
        <TopBar doc={doc} groups={groups} printable={format === "markdown"} />
        <main className={`w-full px-7 pb-20 pt-8 max-md:px-4 max-md:pt-5 ${wide ? "" : "mx-auto max-w-[780px]"}`}>
          {doc === null && !loading && (
            <p className="text-muted-foreground">Pick a document on the left.</p>
          )}
          {doc && (
            <>
              <DocHeader doc={doc} />
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

import { useEffect, useId, useState } from "react";

type MermaidApi = typeof import("mermaid").default;

let loaded: Promise<MermaidApi> | null = null;

function pageIsDark(): boolean {
  const set = document.documentElement.dataset.theme;
  if (set) return set === "dark";
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

/** mermaid, imported once per page, on the first post that carries a block. */
function loadMermaid(): Promise<MermaidApi> {
  loaded ??= import("mermaid").then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: pageIsDark() ? "dark" : "neutral" });
    return mermaid;
  });
  return loaded;
}

type Drawing = { state: "loading" } | { state: "drawn"; svg: string } | { state: "failed"; message: string };

/** One fenced mermaid block of a post: drawn, or its source with the parse error; never blank. */
export function PostDiagram({ source }: { source: string }) {
  const id = "pd" + useId().replace(/[^\w]/g, "");
  const [drawing, setDrawing] = useState<Drawing>({ state: "loading" });
  const [showSource, setShowSource] = useState(false);
  useEffect(() => {
    let live = true;
    setDrawing({ state: "loading" });
    loadMermaid()
      .then((mermaid) => mermaid.render(id, source))
      .then(
        ({ svg }) => live && setDrawing({ state: "drawn", svg }),
        (err: unknown) => live && setDrawing({ state: "failed", message: err instanceof Error ? err.message : String(err) }),
      );
    return () => {
      live = false;
    };
  }, [id, source]);
  return (
    <div className="post-diagram" data-component="PostDiagram" data-state={drawing.state}>
      {drawing.state === "failed" && <p className="pd-error">mermaid failed: {drawing.message}</p>}
      {drawing.state === "drawn" && (
        <>
          <div className="pd-svg" dangerouslySetInnerHTML={{ __html: drawing.svg }} />
          <button type="button" className="pd-toggle" aria-expanded={showSource} onClick={() => setShowSource((s) => !s)}>
            source
          </button>
        </>
      )}
      {(drawing.state !== "drawn" || showSource) && <pre className="pd-source">{source}</pre>}
    </div>
  );
}

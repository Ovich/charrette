import { useEffect, useId, useState } from "react";

/** Lazy mermaid: the 3.5 MB chunk loads only when a doc actually contains a diagram. */
let mermaidPromise: Promise<typeof import("mermaid")> | null = null;
const loadMermaid = () => (mermaidPromise ??= import("mermaid"));

export function MermaidView({ source }: { source: string }) {
  const id = useId().replaceAll(":", "_");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    loadMermaid()
      .then(async ({ default: mermaid }) => {
        const dark = matchMedia("(prefers-color-scheme: dark)").matches;
        mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "neutral", securityLevel: "loose" });
        const { svg } = await mermaid.render(`mmd_${id}`, source);
        if (!cancelled) setSvg(svg);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [source, id]);

  // Never a blank region: source + error until (or instead of) the render.
  if (error)
    return (
      <div className="mermaid-box" data-component="MermaidView">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] text-muted-foreground">mermaid failed: {error}</div>
          <pre>
            <code>{source}</code>
          </pre>
        </div>
      </div>
    );
  if (!svg)
    return (
      <div className="mermaid-box text-[11px] text-muted-foreground" data-component="MermaidView">
        rendering diagram…
      </div>
    );
  return <div className="mermaid-box" data-component="MermaidView" dangerouslySetInnerHTML={{ __html: svg }} />;
}

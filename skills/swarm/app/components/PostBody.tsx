import { lazy, Suspense } from "react";
import { segments } from "../lib/post.ts";
import { RichText } from "./chips.tsx";

// Its own chunk, mermaid with it: a page whose posts carry no block never loads it.
const PostDiagram = lazy(() => import("./PostDiagram.tsx").then((m) => ({ default: m.PostDiagram })));

/** A row's body: its text as RichText, each fenced mermaid block as a diagram. */
export function PostBody({ body, mentions, shown }: { body: string; mentions?: boolean; shown: ReadonlySet<number> }) {
  const parts = segments(body);
  if (!parts.some((p) => p.type === "mermaid")) return <RichText text={body} mentions={mentions} shown={shown} />;
  return (
    <>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <div key={i} className="pb-text">
            <RichText text={p.text} mentions={mentions} shown={shown} />
          </div>
        ) : (
          <Suspense
            key={i}
            fallback={
              <div className="post-diagram" data-component="PostDiagram" data-state="loading">
                <pre className="pd-source">{p.source}</pre>
              </div>
            }
          >
            <PostDiagram source={p.source} />
          </Suspense>
        ),
      )}
    </>
  );
}

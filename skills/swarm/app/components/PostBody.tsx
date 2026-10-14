import { Children, lazy, Suspense, type ComponentProps, type ReactElement, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { RichText } from "./chips.tsx";

// Its own chunk, mermaid with it: a page whose posts carry no block never loads it.
const PostDiagram = lazy(() => import("./PostDiagram.tsx").then((m) => ({ default: m.PostDiagram })));

type MdNode = { type: string; value?: string; children?: MdNode[] };

/** Raw HTML in a post is shown as the text it is, never rendered. */
function remarkHtmlAsText() {
  const walk = (node: MdNode) => {
    if (node.type === "html") node.type = "text";
    node.children?.forEach(walk);
  };
  return (tree: MdNode) => walk(tree);
}

type FencedCode = ReactElement<{ className?: string; children?: unknown }> | undefined;

/** The source of a ```mermaid fence, without the newline markdown leaves at its end; null otherwise. */
function mermaidSource(children: unknown): string | null {
  const el = children as FencedCode;
  if (!/\blanguage-mermaid\b/i.test(el?.props?.className ?? "")) return null;
  return String(el?.props?.children ?? "").replace(/\n$/, "");
}

/** A row's body as GitHub-flavoured markdown: each fenced mermaid block a diagram, mentions and
 *  `#<seq>` links highlighted in the text outside code. */
export function PostBody({ body, mentions, shown }: { body: string; mentions?: boolean; shown: ReadonlySet<number> }) {
  const withMentions = (children: ReactNode) =>
    Children.map(children, (c) => (typeof c === "string" ? <RichText text={c} mentions={mentions} shown={shown} /> : c));
  const textBlock =
    <T extends "p" | "li" | "td" | "th" | "strong" | "em" | "del" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6">(Tag: T) =>
    ({ node: _node, children, ...rest }: ComponentProps<T> & { node?: unknown }) => {
      const Element = Tag as unknown as (p: Record<string, unknown>) => ReactElement;
      return <Element {...rest}>{withMentions(children)}</Element>;
    };
  const components: Components = {
    pre: ({ node: _node, ...props }) => {
      const source = mermaidSource(props.children);
      if (source === null) return <pre {...props} />;
      return (
        <Suspense
          fallback={
            <div className="post-diagram" data-component="PostDiagram" data-state="loading">
              <pre className="pd-source">{source}</pre>
            </div>
          }
        >
          <PostDiagram source={source} />
        </Suspense>
      );
    },
    p: textBlock("p"),
    li: textBlock("li"),
    td: textBlock("td"),
    th: textBlock("th"),
    strong: textBlock("strong"),
    em: textBlock("em"),
    del: textBlock("del"),
    h1: textBlock("h1"),
    h2: textBlock("h2"),
    h3: textBlock("h3"),
    h4: textBlock("h4"),
    h5: textBlock("h5"),
    h6: textBlock("h6"),
  };
  return (
    <div className="post-md" data-component="PostBody">
      <Markdown remarkPlugins={[remarkGfm, remarkHtmlAsText]} components={components}>
        {body}
      </Markdown>
    </div>
  );
}

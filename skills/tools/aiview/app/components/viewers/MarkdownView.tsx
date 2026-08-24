import type { ComponentProps, ReactElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetUrl } from "../../lib/api.ts";
import { MermaidView } from "./MermaidView.tsx";

const isRelative = (src: string) => !/^([a-z][a-z0-9+.-]*:|\/)/i.test(src);

const mermaidSource = (children: unknown): string | null => {
  const el = children as ReactElement<{ className?: string; children?: unknown }> | undefined;
  if (el?.props?.className?.includes("language-mermaid")) return String(el.props.children ?? "");
  return null;
};

export function MarkdownView({ content, docId }: { content: string; docId: number }) {
  return (
    <article className="md" data-component="MarkdownView">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ```mermaid fences render as diagrams, without the surrounding <pre>
          pre: (props: ComponentProps<"pre">) => {
            const src = mermaidSource(props.children);
            if (src !== null) return <MermaidView source={src} />;
            return <pre {...props} />;
          },
          // doc-relative images resolve through the asset route, keyed to this document
          img: ({ src, ...rest }: ComponentProps<"img">) => (
            <img src={typeof src === "string" && isRelative(src) ? assetUrl(docId, src) : src} {...rest} />
          ),
        }}
      >
        {content}
      </Markdown>
    </article>
  );
}

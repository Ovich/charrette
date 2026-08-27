import type { ComponentProps, ReactElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { assetUrl } from "../../lib/api.ts";
import { CodeView } from "./CodeView.tsx";
import { MermaidView } from "./MermaidView.tsx";

const isRelative = (src: string) => !/^([a-z][a-z0-9+.-]*:|\/)/i.test(src);

type FencedCode = ReactElement<{ className?: string; children?: unknown }> | undefined;

const mermaidSource = (children: unknown): string | null => {
  const el = children as FencedCode;
  if (el?.props?.className?.includes("language-mermaid")) return String(el.props.children ?? "");
  return null;
};

/** The `language-x` a fence carries, plus its text — null for an unfenced <pre>. */
const fenced = (children: unknown): { lang: string; source: string } | null => {
  const el = children as FencedCode;
  const lang = /language-([\w-]+)/.exec(el?.props?.className ?? "")?.[1];
  return lang ? { lang, source: String(el?.props?.children ?? "") } : null;
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
            const code = fenced(props.children);
            if (code) return <CodeView source={code.source} lang={code.lang} />;
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

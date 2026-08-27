import { useEffect, useState } from "react";
import type { HighlighterCore } from "shiki/core";

/**
 * Lazy shiki, on the mermaid pattern: the grammars load only when a document
 * actually contains a fenced block in a language we highlight.
 *
 * Two themes are baked into one render (`defaultColor: false`), so each token
 * carries `--shiki-light` and `--shiki-dark` and the CSS in styles.css picks by
 * `prefers-color-scheme`. Switching the OS theme needs no re-render, which is
 * what makes this safe to cache across documents.
 */
const LANGS = {
  ts: () => import("shiki/langs/typescript.mjs"),
  tsx: () => import("shiki/langs/tsx.mjs"),
  js: () => import("shiki/langs/javascript.mjs"),
  jsx: () => import("shiki/langs/jsx.mjs"),
  json: () => import("shiki/langs/json.mjs"),
  jsonc: () => import("shiki/langs/jsonc.mjs"),
  sh: () => import("shiki/langs/shellscript.mjs"),
  sql: () => import("shiki/langs/sql.mjs"),
  html: () => import("shiki/langs/html.mjs"),
  css: () => import("shiki/langs/css.mjs"),
  yaml: () => import("shiki/langs/yaml.mjs"),
  md: () => import("shiki/langs/markdown.mjs"),
  python: () => import("shiki/langs/python.mjs"),
  diff: () => import("shiki/langs/diff.mjs"),
} as const;

/** What a fence may be called, mapped to the grammar that renders it. */
const ALIASES: Record<string, keyof typeof LANGS> = {
  ts: "ts", typescript: "ts", tsx: "tsx",
  js: "js", javascript: "js", mjs: "js", jsx: "jsx",
  json: "json", jsonc: "jsonc",
  sh: "sh", bash: "sh", shell: "sh", zsh: "sh", console: "sh",
  sql: "sql", html: "html", css: "css",
  yaml: "yaml", yml: "yaml", md: "md", markdown: "md",
  py: "python", python: "python", diff: "diff",
};

let highlighterPromise: Promise<HighlighterCore> | null = null;

const loadHighlighter = () =>
  (highlighterPromise ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, light, dark] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("shiki/themes/github-light.mjs"),
      import("shiki/themes/github-dark.mjs"),
    ]);
    return createHighlighterCore({
      themes: [light.default, dark.default],
      langs: await Promise.all(Object.values(LANGS).map((load) => load())),
      engine: createJavaScriptRegexEngine(),
    });
  })());

export function CodeView({ source, lang }: { source: string; lang: string }) {
  const grammar = ALIASES[lang.toLowerCase()];
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!grammar) return;
    let cancelled = false;
    setHtml(null);
    loadHighlighter()
      .then((hl) => {
        const out = hl.codeToHtml(source, {
          lang: grammar,
          themes: { light: "github-light", dark: "github-dark" },
          defaultColor: false,
        });
        if (!cancelled) setHtml(out);
      })
      // A missing grammar or a broken theme must never cost the reader the code
      // itself: the plain block below stays on screen.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [source, grammar]);

  // Plain first, highlighted when it arrives — the code is readable throughout.
  if (!html)
    return (
      <pre data-component="CodeView">
        <code>{source}</code>
      </pre>
    );
  return <div className="shiki-box" data-component="CodeView" dangerouslySetInnerHTML={{ __html: html }} />;
}

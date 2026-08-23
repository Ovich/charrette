import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { truncatePath } from "../../lib/utils.ts";

/** Always under the title: the document's absolute local path, click copies it. */
export function DocPath({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the tooltip still shows the full path */
    }
  };
  return (
    <button
      data-component="DocPath"
      onClick={copy}
      title={copied ? "Path copied" : `Copy path\n${path}`}
      className="mb-2.5 inline-flex max-w-full cursor-pointer items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-md border border-border bg-surface-2 py-0.5 pl-1.5 pr-2 font-mono text-[11px] text-muted-foreground hover:bg-surface hover:text-foreground"
    >
      {copied ? <Check size={12} className="shrink-0 text-ok" /> : <Copy size={12} className="shrink-0 opacity-60" />}
      {copied ? "Path copied" : truncatePath(path)}
    </button>
  );
}

import { useState } from "react";
import { ChevronRight, FileText, LayoutTemplate, Lightbulb, ListChecks, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils.ts";
import type { DocumentWithState } from "../../lib/api.ts";

const ICONS: Record<string, LucideIcon> = {
  workbench: Wrench,
  mockup: LayoutTemplate,
  plan: ListChecks,
  brainstorm: Lightbulb,
};

/** "workbench" -> "Workbenches", "pr-analysis" -> "Pr analyses". */
export function kindPlural(kind: string): string {
  const word = kind.replace(/-/g, " ");
  const plural = /(ch|sh|s|x)$/.test(word) ? `${word}es` : /sis$/.test(word) ? word.replace(/sis$/, "ses") : `${word}s`;
  return plural.charAt(0).toUpperCase() + plural.slice(1);
}

/** The pinned documents, grouped by kind: one menu item per kind, opened to its documents.
 *  Pure, so the grouping is tested without the DOM. */
export function pinnedByKind(docs: DocumentWithState[]): { kind: string; docs: DocumentWithState[] }[] {
  const byKind = new Map<string, DocumentWithState[]>();
  for (const d of docs) if (d.pinned) byKind.set(d.kind, [...(byKind.get(d.kind) ?? []), d]);
  return [...byKind]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, list]) => ({ kind, docs: list.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")) }));
}

function KindItem({ kind, docs, currentId, onOpen, folded }: { kind: string; docs: DocumentWithState[]; currentId: number | null; onOpen: (id: number) => void; folded: boolean }) {
  const holdsCurrent = docs.some((d) => d.id === currentId);
  const [open, setOpen] = useState(false);
  const Icon = ICONS[kind] ?? FileText;
  const shown = !folded && (open || holdsCurrent);
  return (
    <div data-component="PinnedKind" data-kind={kind}>
      <button
        onClick={() => setOpen(!shown)}
        aria-expanded={shown}
        aria-label={kindPlural(kind)}
        title={kindPlural(kind)}
        className={cn(
          "flex h-8 w-full cursor-pointer items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-md px-2 text-left text-muted-foreground hover:bg-surface-2 hover:text-foreground",
          holdsCurrent && !shown && "bg-accent-soft text-accent",
        )}
      >
        <Icon size={16} strokeWidth={1.5} className="shrink-0" />
        <span className="nav-text">{kindPlural(kind)}</span>
        <span className="nav-text ml-auto flex items-center gap-1 text-[12px]">
          {docs.length}
          <ChevronRight size={13} className={cn("transition-transform motion-reduce:transition-none", shown && "rotate-90")} />
        </span>
      </button>
      {shown && (
        <div className="mb-1 ml-[15px] border-l border-border pl-2">
          {docs.map((d) => (
            <button
              key={d.id}
              data-component="PinnedDoc"
              onClick={() => onOpen(d.id)}
              aria-current={d.id === currentId}
              title={d.abs_path}
              className={cn(
                "block h-7 w-full cursor-pointer truncate rounded-md px-2 text-left text-[13px] hover:bg-surface-2",
                d.id === currentId ? "bg-accent-soft font-medium text-accent hover:bg-accent-soft" : "text-foreground",
              )}
            >
              {d.title ?? "(untitled)"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** One menu item per kind that holds a pinned document, under Board, each opening to its documents. */
export function PinnedNav({ docs, currentId, onOpen, folded = false }: { docs: DocumentWithState[]; currentId: number | null; onOpen: (id: number) => void; folded?: boolean }) {
  const kinds = pinnedByKind(docs);
  if (kinds.length === 0) return null;
  return (
    <>
      <div className="mx-2 my-1.5 border-t border-border" aria-hidden="true" />
      {kinds.map((k) => (
        <KindItem key={k.kind} kind={k.kind} docs={k.docs} currentId={currentId} onOpen={onOpen} folded={folded} />
      ))}
    </>
  );
}

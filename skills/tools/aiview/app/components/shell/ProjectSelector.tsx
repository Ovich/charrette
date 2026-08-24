import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils.ts";
import type { DocumentWithState } from "../../lib/api.ts";
import { ALL_PROJECTS } from "../../hooks/useDocuments.ts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.tsx";

/** The context bar: what everything below the selector is scoped to.
 *  Assembled from devices the codebase already owns — Input's border/radius/shadow
 *  on the trigger, DocGroup's chevron and count pill, DocItem's active treatment on
 *  the open rows. No tokens of its own. */
export function ProjectSelector({
  projects,
  active,
  docs,
  onPick,
}: {
  /** slug -> display title. */
  projects: Record<string, string>;
  active: string;
  /** Every document, unscoped: the counts are the point of the menu. */
  docs: DocumentWithState[];
  onPick: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const slugs = Object.keys(projects).sort();
  const count = (slug: string) => (slug === ALL_PROJECTS ? docs.length : docs.filter((d) => d.project === slug).length);
  const label = (slug: string) => (slug === ALL_PROJECTS ? "All projects" : (projects[slug] ?? slug));

  const pick = (slug: string) => {
    setOpen(false);
    if (slug !== active) onPick(slug);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-component="ProjectSelector" asChild>
      <div>
        <CollapsibleTrigger asChild>
          <button
            className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left shadow-(--shadow-sm) hover:bg-surface-2"
            aria-label={`Project: ${label(active)}`}
          >
            <span
              className={cn(
                "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold tracking-tight",
                active === ALL_PROJECTS && "text-muted-foreground",
              )}
            >
              {label(active)}
            </span>
            <span className="ml-auto rounded-full bg-surface-2 px-1.5 font-mono text-[10.5px] text-faint-foreground">
              {count(active)}
            </span>
            <ChevronDown
              size={14}
              className={cn(
                "shrink-0 text-faint-foreground transition-transform motion-reduce:transition-none",
                !open && "-rotate-90",
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-1.5 overflow-hidden rounded-lg border border-border bg-background shadow-(--shadow-sm)">
            {[...slugs, ALL_PROJECTS].map((slug, i) => (
              <button
                key={slug}
                onClick={() => pick(slug)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-2",
                  i > 0 && "border-t border-border",
                  slug === ALL_PROJECTS && "text-muted-foreground",
                  slug === active && "bg-accent-soft font-semibold shadow-[inset_2px_0_0] shadow-accent",
                )}
              >
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{label(slug)}</span>
                <span className="ml-auto font-mono text-[10.5px] text-faint-foreground">{count(slug)}</span>
              </button>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

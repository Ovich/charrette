import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils.ts";
import type { DocumentWithState } from "../../lib/api.ts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.tsx";
import { DocItem } from "./DocItem.tsx";

export function DocGroup({
  title,
  docs,
  currentId,
  onOpen,
}: {
  title: string;
  docs: DocumentWithState[];
  currentId: number | null;
  onOpen: (id: number) => void;
}) {
  const containsCurrent = docs.some((d) => d.id === currentId);
  const [open, setOpen] = useState(containsCurrent);
  return (
    <Collapsible open={open || containsCurrent} onOpenChange={setOpen} data-component="DocGroup" asChild>
      <div className="mb-2 overflow-hidden rounded-lg border border-border bg-background shadow-(--shadow-sm)">
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full cursor-pointer select-none items-center gap-1.5 px-2.5 py-2 text-left text-[12.5px] font-semibold hover:bg-surface-2",
            )}
          >
            <ChevronDown
              size={14}
              className={cn("shrink-0 text-faint-foreground transition-transform motion-reduce:transition-none", !(open || containsCurrent) && "-rotate-90")}
            />
            <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{title}</span>
            <span className="ml-auto rounded-full bg-surface-2 px-1.5 font-mono text-[10.5px] text-faint-foreground">
              {docs.length}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border">
            {docs.map((d, i) => (
              <div key={d.id} className={cn(i > 0 && "border-t border-border")}>
                <DocItem doc={d} active={d.id === currentId} grouped onOpen={onOpen} />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

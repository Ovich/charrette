import { cn, fmtStart, fmtUpdated, projectName } from "../../lib/utils.ts";
import { docActivity } from "../../hooks/useSidebarEntries.ts";
import type { DocumentWithState } from "../../lib/api.ts";
import { KindChip } from "./KindChip.tsx";

export function DocItem({
  doc,
  active,
  grouped = false,
  showProject = true,
  onOpen,
}: {
  doc: DocumentWithState;
  active: boolean;
  /** Rendered inside a DocGroup container (square corners, divider handled by parent). */
  grouped?: boolean;
  /** Only in All-projects mode: scoped, it is the same string on every row. */
  showProject?: boolean;
  onOpen: (id: number) => void;
}) {
  return (
    <div
      data-component="DocItem"
      title={doc.abs_path}
      onClick={() => onOpen(doc.id)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(doc.id)}
      role="button"
      tabIndex={0}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col gap-0.5 px-2.5 py-2",
        grouped ? "pl-3.5" : "mb-0.5 rounded-lg",
        active ? "bg-accent-soft shadow-[inset_2px_0_0] shadow-accent" : "hover:bg-surface-2",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <KindChip kind={doc.kind} />
        <span className="font-mono text-[10.5px] tabular-nums text-faint-foreground">{fmtStart(doc.created_at)}</span>
      </div>
      <div className={cn("text-[12.5px] font-medium leading-snug line-clamp-2", !doc.exists && "line-through text-muted-foreground")}>
        {doc.title ?? "(untitled)"}
      </div>
      <div className="flex items-center gap-2 text-[10.5px] text-faint-foreground">
        {showProject && <span className="text-accent">{projectName(doc.project)}</span>}
        <span className="font-mono">updated {fmtUpdated(docActivity(doc))}</span>
      </div>
    </div>
  );
}

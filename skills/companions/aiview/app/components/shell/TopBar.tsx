import type { Document, DocumentWithState } from "../../lib/api.ts";
import { Button } from "../ui/button.tsx";
import { DocPath } from "../docs/DocPath.tsx";
import { ProjectSelector } from "./ProjectSelector.tsx";
import { PinToggle } from "../docs/PinToggle.tsx";

/** The 48px bar over the content: project / group / document, then the document's tools. */
export function TopBar({
  doc,
  here: hereOverride,
  groups,
  printable,
  projects,
  activeProject,
  allDocs,
  onPickProject,
}: {
  doc: Document | null;
  /** The crumb when no document is shown (the empty board). */
  here?: string;
  groups: Record<string, string>;
  printable: boolean;
  projects: Record<string, string>;
  activeProject: string;
  allDocs: DocumentWithState[];
  onPickProject: (slug: string) => void;
}) {
  const groupTitle = doc?.group_slug ? (groups[doc.group_slug] ?? doc.group_slug) : null;
  const here = hereOverride ?? (doc ? (doc.kind === "swarm" ? "Board" : (doc.title ?? "(untitled)")) : null);
  return (
    <header
      data-component="TopBar"
      className="topbar sticky top-0 z-20 flex h-12 min-w-0 shrink-0 items-center gap-2 border-b border-border bg-card px-4 max-md:px-3"
    >
      <ProjectSelector projects={projects} active={activeProject} docs={allDocs} onPick={onPickProject} />
      <span className="flex min-w-0 items-center gap-2 font-medium">
        {groupTitle && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate text-muted-foreground max-lg:hidden">{groupTitle}</span>
          </>
        )}
        {here && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="truncate">{here}</span>
          </>
        )}
      </span>
      <div className="ml-auto flex min-w-0 items-center gap-1.5">
        {doc && doc.kind !== "swarm" && (
          <PinToggle id={doc.id} pinned={doc.pinned} label className={doc.pinned ? "h-7 px-2 text-[12px] text-accent hover:bg-surface-2" : "h-7 px-2 text-[12px] hover:bg-surface-2"} />
        )}
        {doc && doc.kind !== "swarm" && <DocPath path={doc.abs_path} />}
        {printable && (
          <Button variant="outline" onClick={() => window.print()} title="Export to PDF via the browser print dialog">
            Export PDF
          </Button>
        )}
      </div>
    </header>
  );
}

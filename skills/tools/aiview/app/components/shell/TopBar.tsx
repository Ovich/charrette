import type { Document } from "../../lib/api.ts";
import { Button } from "../ui/button.tsx";
import { DocPath } from "../docs/DocPath.tsx";

export function TopBar({
  doc,
  groups,
  printable,
}: {
  doc: Document | null;
  groups: Record<string, string>;
  printable: boolean;
}) {
  const groupTitle = doc?.group_slug ? (groups[doc.group_slug] ?? doc.group_slug) : null;
  return (
    <div
      data-component="TopBar"
      className="topbar sticky top-0 z-10 flex min-w-0 items-center gap-2.5 border-b border-border bg-background/85 px-7 py-2.5 backdrop-blur max-md:px-4"
    >
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
        {groupTitle && (
          <>
            <span className="whitespace-nowrap">{groupTitle}</span>
            <span className="text-faint-foreground">/</span>
          </>
        )}
        <b className="overflow-hidden text-ellipsis whitespace-nowrap font-semibold text-foreground">
          {doc ? (doc.title ?? "(untitled)") : "aiview"}
        </b>
      </span>
      <div className="ml-auto flex min-w-0 items-center gap-1.5">
        {doc && <DocPath path={doc.abs_path} />}
        {printable && (
          <Button variant="primary" onClick={() => window.print()} title="Export to PDF via the browser print dialog">
            Export PDF
          </Button>
        )}
      </div>
    </div>
  );
}

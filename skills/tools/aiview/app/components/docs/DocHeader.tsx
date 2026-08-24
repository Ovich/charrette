import { fmtStart, fmtUpdated, projectName } from "../../lib/utils.ts";
import type { Document } from "../../lib/api.ts";
import { Badge } from "../ui/badge.tsx";
import { KindChip } from "./KindChip.tsx";
import { DocPath } from "./DocPath.tsx";

export function DocHeader({ doc }: { doc: Document }) {
  return (
    <div data-component="DocHeader" className="mb-6">
      <h1 className="mb-1.5 text-[26px] font-bold leading-tight tracking-tight text-balance">
        {doc.title ?? "(untitled)"}
      </h1>
      <DocPath path={doc.abs_path} />
      <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <KindChip kind={doc.kind} />
        <span className="font-mono tabular-nums">started {fmtStart(doc.created_at)}</span>
        <span className="text-faint-foreground">·</span>
        {doc.tags.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
        {doc.tags.length > 0 && <span className="text-faint-foreground">·</span>}
        <span>{projectName(doc.project)}</span>
        <span className="text-faint-foreground">·</span>
        <span className="font-mono">updated {fmtUpdated(doc.last_seen_at)}</span>
      </div>
    </div>
  );
}

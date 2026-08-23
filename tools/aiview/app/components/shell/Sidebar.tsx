import { Search } from "lucide-react";
import type { DocumentWithState } from "../../lib/api.ts";
import type { ConnectionState } from "../../hooks/useDocuments.ts";
import { useFilters } from "../../hooks/useFilters.ts";
import { sidebarEntries } from "../../hooks/useSidebarEntries.ts";
import { Input } from "../ui/input.tsx";
import { Badge } from "../ui/badge.tsx";
import { KindChip } from "../docs/KindChip.tsx";
import { DocItem } from "../docs/DocItem.tsx";
import { DocGroup } from "../docs/DocGroup.tsx";
import { LiveIndicator } from "../docs/LiveIndicator.tsx";

function FilterLabel({ children }: { children: string }) {
  return (
    <div className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-widest text-faint-foreground">
      {children}
    </div>
  );
}

export function Sidebar({
  docs,
  groups,
  connection,
  currentId,
  onOpen,
}: {
  docs: DocumentWithState[];
  groups: Record<string, string>;
  connection: ConnectionState;
  currentId: number | null;
  onOpen: (id: number) => void;
}) {
  const f = useFilters(docs);
  // grouping happens after filtering, so a container shows only its matching members
  const entries = sidebarEntries(f.shown, groups);
  return (
    <aside
      data-component="Sidebar"
      className="sticky top-0 flex h-screen min-w-0 flex-col border-r border-border bg-surface max-md:static max-md:h-auto max-md:max-h-[45vh] max-md:border-b max-md:border-r-0"
    >
      <div className="flex items-center gap-2 px-3.5 pb-2.5 pt-3.5">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-gradient-to-br from-accent to-[hsl(262_70%_58%)] text-[11px] font-bold text-white">
            av
          </span>
          aiview
        </span>
        <LiveIndicator state={connection} />
      </div>

      <div className="px-3.5 pb-2.5">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter documents…"
            className="pl-7.5 text-[13px]"
            value={f.query}
            onChange={(e) => f.setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="border-b border-border px-3.5 pb-2.5">
        <FilterLabel>Kind</FilterLabel>
        <div className="flex flex-wrap gap-1" data-component="KindChips">
          {f.allKinds.map((k) => (
            <KindChip key={k} kind={k} dim={f.kinds.size > 0 && !f.kinds.has(k)} onClick={() => f.toggleKind(k)} />
          ))}
        </div>
        <FilterLabel>Tags</FilterLabel>
        <div className="flex flex-wrap gap-1" data-component="TagChips">
          {f.allTags.map((t) => (
            <Badge key={t} active={f.tags.has(t)} onClick={() => f.toggleTag(t)} role="button" className="cursor-pointer">
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2" data-component="DocList">
        {f.shown.length === 0 && (
          <div className="px-2 py-3 text-[12px] text-muted-foreground">
            {docs.length === 0 ? (
              <>
                No documents yet. Register one:
                <code className="mt-1 block rounded bg-surface-2 px-1.5 py-1 font-mono text-[11px]">aiview add &lt;file&gt;</code>
              </>
            ) : (
              "No documents match — clear filters?"
            )}
          </div>
        )}
        {entries.map((e) =>
          e.type === "doc" ? (
            <DocItem key={`d${e.doc.id}`} doc={e.doc} active={e.doc.id === currentId} onOpen={onOpen} />
          ) : (
            <DocGroup key={`g${e.slug}`} title={e.title} docs={e.docs} currentId={currentId} onOpen={onOpen} />
          ),
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border px-3.5 py-2 text-[10.5px] text-faint-foreground">
        {docs.length} documents · aiview.sqlite · versioned
      </div>
    </aside>
  );
}

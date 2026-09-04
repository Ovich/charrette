// One fs.watch per document directory, debounced per doc, emitting "changed".
// Who touches the index or broadcasts SSE is the caller's business.
//
// A document can depend on sibling files it binds components from (core/bind.ts). The
// caller tells the watcher which files a host was composed from, and a change on any of
// them emits "changed" for the host too. Sources need not be registered documents: the
// directory watch already covers the folder, and their names are matched here.
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";

export interface WatchableDoc {
  id: number;
  abs_path: string;
}

export interface ChangedEvent {
  id: number;
}

/** resolve(dir, filename) -> the watched doc that file belongs to, if any. */
export type DocResolver = (dir: string, filename: string) => WatchableDoc | undefined;

export class DocWatcher extends EventEmitter {
  private watched = new Map<string, fs.FSWatcher>();
  private timers = new Map<number, NodeJS.Timeout>();
  /** host id -> absolute paths of the files it was composed from, replaced on each resolve. */
  private sources = new Map<number, Set<string>>();
  private resolve: DocResolver;
  private debounceMs: number;

  constructor(resolve: DocResolver, debounceMs = 150) {
    super();
    this.resolve = resolve;
    this.debounceMs = debounceMs;
  }

  ensureWatch(doc: WatchableDoc): void {
    const dir = path.dirname(doc.abs_path);
    if (this.watched.has(dir)) return;
    try {
      const w = fs.watch(dir, (_event, name) => {
        if (!name) return;
        const hit = this.resolve(dir, String(name));
        if (hit) this.schedule(hit.id);
        for (const id of this.hostsOf(path.resolve(dir, String(name)))) this.schedule(id);
      });
      this.watched.set(dir, w);
    } catch (e) {
      console.error(`watch failed for ${dir}: ${(e as Error).message}`);
    }
  }

  /** Replace (never merge) the set of files `hostId` depends on. An empty list clears it. */
  setSources(hostId: number, absPaths: string[]): void {
    if (absPaths.length === 0) this.sources.delete(hostId);
    else this.sources.set(hostId, new Set(absPaths.map((p) => path.resolve(p))));
  }

  /** The hosts composed from `absPath`. */
  hostsOf(absPath: string): number[] {
    const key = path.resolve(absPath);
    const ids: number[] = [];
    for (const [id, set] of this.sources) if (set.has(key)) ids.push(id);
    return ids;
  }

  private schedule(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => this.emit("changed", { id } satisfies ChangedEvent), this.debounceMs),
    );
  }

  close(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const w of this.watched.values()) w.close();
    this.watched.clear();
    this.sources.clear();
  }
}

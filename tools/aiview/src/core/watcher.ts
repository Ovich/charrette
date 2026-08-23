// One fs.watch per document directory, debounced per doc, emitting "changed".
// Who touches the index or broadcasts SSE is the caller's business.
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
        if (!hit) return;
        clearTimeout(this.timers.get(hit.id));
        this.timers.set(
          hit.id,
          setTimeout(() => this.emit("changed", { id: hit.id } satisfies ChangedEvent), this.debounceMs),
        );
      });
      this.watched.set(dir, w);
    } catch (e) {
      console.error(`watch failed for ${dir}: ${(e as Error).message}`);
    }
  }

  close(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const w of this.watched.values()) w.close();
    this.watched.clear();
  }
}

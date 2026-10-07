// The SSE clients of /events, with a heartbeat: aiview's hub, copied (D17).
//
// A silent stream cannot be told from a dead one: a socket can break without a FIN and the
// tab's EventSource then fires no error. A `ping` every beat lets both ends notice: a write
// that fails prunes the client here, and a tab that hears nothing for several beats
// reconnects (app/hooks/useBoard.ts).
import type { ServerResponse } from "node:http";

export const HEARTBEAT_MS = 15_000;

export type BoardEvent = { type: "hello" } | { type: "ping" } | { type: "changed"; repo: string };

export interface SseHub {
  add(res: ServerResponse): void;
  broadcast(event: BoardEvent): void;
  size(): number;
  close(): void;
}

export function createSseHub(heartbeatMs = HEARTBEAT_MS): SseHub {
  const clients = new Set<ServerResponse>();

  const drop = (res: ServerResponse): void => {
    if (clients.delete(res)) res.destroy();
  };
  const send = (res: ServerResponse, event: BoardEvent): void => {
    if (res.writableEnded || res.destroyed) return drop(res);
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`, (err) => {
        if (err) drop(res);
      });
    } catch {
      drop(res);
    }
  };

  const beat = setInterval(() => {
    for (const res of [...clients]) send(res, { type: "ping" });
  }, heartbeatMs);
  // a heartbeat is never what keeps the process up
  beat.unref?.();

  return {
    add(res) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      clients.add(res);
      res.on("close", () => clients.delete(res));
      res.on("error", () => drop(res));
      send(res, { type: "hello" });
    },
    // the set is copied: a failed write drops its client from it
    broadcast(event) {
      for (const res of [...clients]) send(res, event);
    },
    size: () => clients.size,
    close() {
      clearInterval(beat);
      for (const res of [...clients]) drop(res);
    },
  };
}

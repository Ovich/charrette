// SSE client registry for /events.
import type { ServerResponse } from "node:http";

export interface SseHub {
  add(res: ServerResponse): void;
  broadcast(event: unknown): void;
}

export function createSseHub(): SseHub {
  const clients = new Set<ServerResponse>();
  return {
    add(res) {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ type: "hello" })}\n\n`);
      clients.add(res);
      res.on("close", () => clients.delete(res));
    },
    broadcast(event) {
      for (const res of clients) res.write(`data: ${JSON.stringify(event)}\n\n`);
    },
  };
}

// One run's source, the page aiview frames (plan D2): GET /api/run?id= and /events; the run's
// repository refetches on its `changed`.
import { useEffect, useState } from "react";
import type { BoardSnapshot } from "../../src/board/board.ts";
export type Connection = "live" | "reconnecting";

export interface RunState {
  /** The run's repository snapshot; null while it loads, or when the run is unknown. */
  snapshot: BoardSnapshot | null;
  connection: Connection;
}

export function useRun(run: number): RunState {
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [connection, setConnection] = useState<Connection>("reconnecting");

  useEffect(() => {
    let repo: string | null = null;
    const load = (): void => {
      void fetch(`/api/run?id=${run}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<{ snapshot: BoardSnapshot }>) : null))
        .then((body) => {
          if (!body) return;
          repo = body.snapshot.repo;
          setSnapshot(body.snapshot);
        })
        .catch(() => {});
    };
    load();
    const es = new EventSource("/events");
    es.onopen = () => setConnection("live");
    es.onerror = () => setConnection("reconnecting");
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as { type: string; repo?: string };
      if (ev.type === "hello" || ev.type === "ping") setConnection("live");
      if (ev.type === "changed" && (repo === null || ev.repo === repo)) load();
    };
    return () => es.close();
  }, [run]);

  return { snapshot, connection };
}

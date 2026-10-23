// A repository's figures for an analytics view (across runs, or one run), live: GET /api/stats, refetched on the
// repository's `board-changed` on aiview's /events, as useBoard is (D32). Keeps the body as the server
// sent it, for "Copy as JSON" to put on the clipboard unchanged (US3).
import { useEffect, useState } from "react";
import type { Stats } from "../../../swarm-board/src/client/reader.ts";
import { statsUrl, type StatsAsk } from "../lib/board/analytics.ts";

export interface StatsState {
  /** null while loading, or on error. */
  stats: Stats | null;
  /** The response body, verbatim. */
  body: string | null;
  /** The server's error message. */
  error: string | null;
}

export function useStats(repo: string, ask: StatsAsk): StatsState {
  const [state, setState] = useState<StatsState>({ stats: null, body: null, error: null });
  const url = statsUrl(repo, ask);

  useEffect(() => {
    let live = true;
    const load = (): void => {
      void fetch(url, { cache: "no-store" })
        .then(async (r) => {
          const body = await r.text();
          if (!live) return;
          const parsed = JSON.parse(body) as Stats | { error: string };
          if ("error" in parsed) return setState({ stats: null, body: null, error: parsed.error });
          setState({ stats: parsed, body, error: null });
        })
        .catch(() => {});
    };
    load();
    const es = new EventSource("/events");
    es.onmessage = (m) => {
      const ev = JSON.parse(m.data) as { type: string; repo?: string };
      if (ev.type === "board-changed" && ev.repo === repo) load();
    };
    return () => {
      live = false;
      es.close();
    };
  }, [url, repo]);

  return state;
}

// The page's one source: GET /api/repos, GET /api/board?repo=, and /events. The shown
// repository refetches on its `changed`; another repository's `changed` refetches the list
// and counts toward its unread pill, per tab (D34).
import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardSnapshot, RepoSummary } from "../../src/board/board.ts";

export type Connection = "live" | "reconnecting";
export type RepoView = RepoSummary & { unread: number };

export interface BoardState {
  /** null while loading; empty when no repository has a run. */
  repos: RepoView[] | null;
  /** The shown repository's snapshot; null while it loads. */
  snapshot: BoardSnapshot | null;
  connection: Connection;
}

/** Nothing heard for this long means the stream is dead, whatever the browser thinks:
 *  three server heartbeats (src/server/sse.ts), so one lost beat is not a reconnect. */
export const SILENCE_MS = 45_000;

const getJson = async <T,>(url: string): Promise<T | null> => {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
};

export function useBoard(repo: string | null): BoardState {
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [snapshot, setSnapshot] = useState<BoardSnapshot | null>(null);
  const [connection, setConnection] = useState<Connection>("reconnecting");
  const [unread, setUnread] = useState<Record<string, number>>({});
  const shown = useRef(repo);
  shown.current = repo;

  const loadRepos = useCallback(() => {
    void getJson<RepoSummary[]>("/api/repos").then((r) => r && setRepos(r));
  }, []);
  const loadSnapshot = useCallback((id: string) => {
    void getJson<BoardSnapshot>(`/api/board?repo=${encodeURIComponent(id)}`).then((s) => {
      if (s && s.repo === shown.current) setSnapshot(s);
    });
  }, []);

  // the shown repository: its snapshot, and its unread count read
  useEffect(() => {
    if (!repo) return;
    loadSnapshot(repo);
    setUnread((u) => (u[repo] ? { ...u, [repo]: 0 } : u));
  }, [repo, loadSnapshot]);

  useEffect(() => {
    loadRepos();
    let es: EventSource | null = null;
    let lastSeen = Date.now();
    const connect = (): void => {
      es?.close();
      lastSeen = Date.now();
      es = new EventSource("/events");
      es.onopen = () => setConnection("live");
      es.onerror = () => setConnection("reconnecting");
      es.onmessage = (m) => {
        lastSeen = Date.now();
        const ev = JSON.parse(m.data) as { type: string; repo?: string };
        if (ev.type === "hello" || ev.type === "ping") setConnection("live");
        if (ev.type !== "changed" || !ev.repo) return;
        if (ev.repo === shown.current) loadSnapshot(ev.repo);
        else {
          loadRepos();
          const other = ev.repo;
          setUnread((u) => ({ ...u, [other]: (u[other] ?? 0) + 1 }));
        }
      };
    };
    connect();
    // the watchdog: a socket broken without a FIN stays OPEN and silent; silence past three
    // heartbeats is taken as death: reconnect, and catch up on what was missed
    const watchdog = setInterval(() => {
      if (Date.now() - lastSeen < SILENCE_MS) return;
      setConnection("reconnecting");
      connect();
      loadRepos();
      if (shown.current) loadSnapshot(shown.current);
    }, SILENCE_MS / 3);
    return () => {
      clearInterval(watchdog);
      es?.close();
    };
  }, [loadRepos, loadSnapshot]);

  const current = snapshot && snapshot.repo === repo ? snapshot : null;
  // the shown repository's runs come with its snapshot, fresher than the list
  const view: RepoView[] | null =
    repos &&
    repos.map((r) => ({ ...r, runs: current && r.repo === current.repo ? current.runs : r.runs, unread: r.repo === repo ? 0 : (unread[r.repo] ?? 0) }));
  return { repos: view, snapshot: current, connection };
}

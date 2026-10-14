// useBoard, with fetch and EventSource stood in for: the route it asks, its refetch on its own
// repository's `changed`, and the server's 404 message.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useBoard } from "./hooks/useBoard.ts";

class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
  close(): void {}
  emit(ev: object): void {
    this.onmessage?.({ data: JSON.stringify(ev) });
  }
}

const REPO = "/r/.git";
const body = { repos: [{ repo: REPO, name: "r", runs: [] }], snapshot: { repo: REPO, name: "r", runs: [], lock: null, roster: [], events: [], queues: {}, files: [], flags: [] } };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url.includes("run=999")) return { ok: false, status: 404, json: async () => ({ error: "no run 999" }) };
    return { ok: true, status: 200, json: async () => body };
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => vi.unstubAllGlobals());

test("asks ?run= when given a run", async () => {
  const { result } = renderHook(() => useBoard({ repo: null, run: 6 }));
  await waitFor(() => expect(result.current.snapshot?.repo).toBe(REPO));
  expect(fetchMock.mock.calls[0][0]).toBe("/api/board?run=6");
  expect(result.current.repos.map((r) => r.repo)).toEqual([REPO]);
});

test("refetches on changed for its repository, not for another", async () => {
  const { result } = renderHook(() => useBoard({ repo: REPO, run: null }));
  await waitFor(() => expect(result.current.snapshot).not.toBeNull());
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/board?repo=${encodeURIComponent(REPO)}`);
  act(() => FakeEventSource.last!.emit({ type: "changed", repo: "/other/.git" }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  act(() => FakeEventSource.last!.emit({ type: "changed", repo: REPO }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});

test("exposes the server's 404 message, snapshot null", async () => {
  const { result } = renderHook(() => useBoard({ repo: null, run: 999 }));
  await waitFor(() => expect(result.current.error).toBe("no run 999"));
  expect(result.current.snapshot).toBeNull();
});

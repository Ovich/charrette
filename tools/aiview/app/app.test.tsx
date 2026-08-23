// Component + pure-logic tests (vitest, jsdom). Visual acceptance runs against the mockup.
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);
import { applyFilters } from "./hooks/useFilters.ts";
import { truncatePath, kindHue } from "./lib/utils.ts";
import { DocPath } from "./components/docs/DocPath.tsx";
import { DocItem } from "./components/docs/DocItem.tsx";
import type { DocumentWithState } from "./lib/api.ts";

const doc = (over: Partial<DocumentWithState>): DocumentWithState => ({
  id: 1,
  file_path: "docs/x.brainstorm.md",
  abs_path: "C:\\JOBS\\docs\\x.brainstorm.md",
  project: "JOBS",
  title: "Board X",
  kind: "brainstorm",
  tags: ["aiview"],
  group_slug: null,
  created_at: "2026-08-23T09:00:00Z",
  last_seen_at: "2026-08-23T10:00:00Z",
  exists: true,
  format: "markdown",
  ...over,
});

describe("applyFilters", () => {
  const docs = [
    doc({ id: 1, kind: "brainstorm", tags: ["aiview", "webapp"], title: "Board" }),
    doc({ id: 2, kind: "spec", tags: ["aiview"], title: "Spec", file_path: "docs/x.spec.md" }),
    doc({ id: 3, kind: "pdf", tags: ["itech"], title: "cv-live.pdf", file_path: "out/cv.pdf" }),
  ];
  test("no filters returns everything", () => {
    expect(applyFilters(docs, { query: "", kinds: new Set(), tags: new Set() })).toHaveLength(3);
  });
  test("kind filter is a union, tag filter an intersection", () => {
    expect(applyFilters(docs, { query: "", kinds: new Set(["spec", "pdf"]), tags: new Set() }).map((d) => d.id)).toEqual([2, 3]);
    expect(applyFilters(docs, { query: "", kinds: new Set(), tags: new Set(["aiview", "webapp"]) }).map((d) => d.id)).toEqual([1]);
  });
  test("query matches title or path, case-insensitive", () => {
    expect(applyFilters(docs, { query: "SPEC", kinds: new Set(), tags: new Set() }).map((d) => d.id)).toEqual([2]);
    expect(applyFilters(docs, { query: "out/cv", kinds: new Set(), tags: new Set() }).map((d) => d.id)).toEqual([3]);
  });
});

describe("utils", () => {
  test("truncatePath keeps the filename visible", () => {
    const p = "C:\\very\\long\\path\\that\\goes\\on\\and\\on\\forever\\until\\it\\must\\be\\cut\\file.spec.md";
    const t = truncatePath(p, 40);
    expect(t.length).toBeLessThanOrEqual(41);
    expect(t.endsWith("file.spec.md")).toBe(true);
    expect(t).toContain("…");
    expect(truncatePath("short.md", 40)).toBe("short.md");
  });
  test("kindHue is deterministic and in range", () => {
    expect(kindHue("brainstorm")).toBe(kindHue("brainstorm"));
    expect(kindHue("spec")).toBeGreaterThanOrEqual(0);
    expect(kindHue("spec")).toBeLessThan(360);
  });
});

describe("sidebarEntries", () => {
  test("groups collapse into containers, members oldest-first, entries by latest activity", async () => {
    const { sidebarEntries } = await import("./hooks/useSidebarEntries.ts");
    const docs = [
      doc({ id: 1, group_slug: "g", created_at: "2026-08-20T00:00:00Z", last_seen_at: "2026-08-23T00:00:00Z" }),
      doc({ id: 2, group_slug: "g", created_at: "2026-08-19T00:00:00Z", last_seen_at: "2026-08-21T00:00:00Z" }),
      doc({ id: 3, group_slug: null, created_at: "2026-08-22T00:00:00Z", last_seen_at: "2026-08-22T00:00:00Z" }),
      doc({ id: 4, group_slug: null, created_at: "2026-08-10T00:00:00Z", last_seen_at: "2026-08-24T00:00:00Z" }),
    ];
    const entries = sidebarEntries(docs, { g: "Group G" });
    // order: doc 4 (activity 24th), group g (23rd), doc 3 (22nd)
    expect(entries.map((e) => (e.type === "doc" ? e.doc.id : e.slug))).toEqual([4, "g", 3]);
    const group = entries[1];
    if (group.type !== "group") throw new Error("expected group");
    expect(group.title).toBe("Group G");
    expect(group.docs.map((d) => d.id)).toEqual([2, 1]); // oldest-first inside
  });
  test("unknown group title falls back to slug", async () => {
    const { sidebarEntries } = await import("./hooks/useSidebarEntries.ts");
    const entries = sidebarEntries([doc({ id: 1, group_slug: "x" })], {});
    expect(entries[0].type === "group" && entries[0].title).toBe("x");
  });
});

describe("DocPath", () => {
  test("click copies the absolute path and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const p = "C:\\JOBS\\docs\\x.md";
    render(<DocPath path={p} />);
    fireEvent.click(screen.getByRole("button"));
    expect(writeText).toHaveBeenCalledWith(p);
    expect(await screen.findByText("Path copied")).toBeTruthy();
  });
});

describe("DocItem", () => {
  test("carries the path as tooltip and opens on click", () => {
    const onOpen = vi.fn();
    const d = doc({});
    render(<DocItem doc={d} active={false} onOpen={onOpen} />);
    const item = screen.getByRole("button");
    expect(item.getAttribute("title")).toBe(d.abs_path);
    fireEvent.click(item);
    expect(onOpen).toHaveBeenCalledWith(1);
  });
  test("missing file renders struck through", () => {
    render(<DocItem doc={doc({ exists: false })} active={false} onOpen={() => {}} />);
    expect(screen.getByText("Board X").className).toContain("line-through");
  });
});

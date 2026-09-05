// Component + pure-logic tests (vitest, jsdom). Visual acceptance runs against the mockup.
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);
import { applyFilters, applyScope } from "./hooks/useFilters.ts";
import { truncatePath, kindHue } from "./lib/utils.ts";
import { DocPath } from "./components/docs/DocPath.tsx";
import { shouldLoad } from "./App.tsx";
import { docActivity, sidebarEntries } from "./hooks/useSidebarEntries.ts";
import { DocItem } from "./components/docs/DocItem.tsx";
import { ProjectSelector } from "./components/shell/ProjectSelector.tsx";
import { Sidebar } from "./components/shell/Sidebar.tsx";
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
  updated_at: "2026-08-23T10:00:00Z",
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
    // activity is the file's mtime (updated_at), not the index's last_seen_at
    const docs = [
      doc({ id: 1, group_slug: "g", created_at: "2026-08-20T00:00:00Z", updated_at: "2026-08-23T00:00:00Z" }),
      doc({ id: 2, group_slug: "g", created_at: "2026-08-19T00:00:00Z", updated_at: "2026-08-21T00:00:00Z" }),
      doc({ id: 3, group_slug: null, created_at: "2026-08-22T00:00:00Z", updated_at: "2026-08-22T00:00:00Z" }),
      doc({ id: 4, group_slug: null, created_at: "2026-08-10T00:00:00Z", updated_at: "2026-08-24T00:00:00Z" }),
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

describe("project scope", () => {
  const docs = [
    doc({ id: 1, project: "CIIP", kind: "pr-analysis", tags: ["portail"], title: "POR-3410" }),
    doc({ id: 2, project: "JOBS", kind: "spec", tags: ["cv"], title: "Spec" }),
    doc({ id: 3, project: "JOBS", kind: "brainstorm", tags: ["cv"], title: "Board" }),
  ];

  test("scope narrows to one project; '*' keeps everything", () => {
    expect(applyScope(docs, "JOBS").map((d) => d.id)).toEqual([2, 3]);
    expect(applyScope(docs, "CIIP").map((d) => d.id)).toEqual([1]);
    expect(applyScope(docs, "*")).toHaveLength(3);
  });

  test("scope runs before the chips, so the chip lists are themselves scoped (D16)", () => {
    // This is what makes "everything below is scoped" true rather than decorative:
    // JOBS must not offer a pr-analysis chip that can only match a CIIP document.
    const scoped = applyScope(docs, "JOBS");
    expect([...new Set(scoped.map((d) => d.kind))].sort()).toEqual(["brainstorm", "spec"]);
    expect([...new Set(scoped.flatMap((d) => d.tags))]).toEqual(["cv"]);
  });
});

describe("ProjectSelector", () => {
  const projects = { CIIP: "CIIP", JOBS: "JOBS" };
  const docs = [doc({ id: 1, project: "CIIP" }), doc({ id: 2, project: "JOBS" }), doc({ id: 3, project: "JOBS" })];

  test("shows the active project and its document count", () => {
    render(<ProjectSelector projects={projects} active="JOBS" docs={docs} onPick={() => {}} />);
    expect(screen.getByLabelText("Project: JOBS")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy(); // JOBS holds 2 of the 3
  });

  test("All projects reads as such and counts everything", () => {
    render(<ProjectSelector projects={projects} active="*" docs={docs} onPick={() => {}} />);
    expect(screen.getByLabelText("Project: All projects")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  test("picking another project reports it; picking the active one is a no-op", () => {
    const onPick = vi.fn();
    render(<ProjectSelector projects={projects} active="JOBS" docs={docs} onPick={onPick} />);
    fireEvent.click(screen.getByLabelText("Project: JOBS")); // open the menu
    fireEvent.click(screen.getByText("CIIP"));
    expect(onPick).toHaveBeenCalledWith("CIIP");

    onPick.mockClear();
    fireEvent.click(screen.getByLabelText("Project: JOBS"));
    fireEvent.click(screen.getAllByText("JOBS")[1]!); // the menu row, not the trigger
    expect(onPick).not.toHaveBeenCalled();
  });
});

describe("DocItem project line", () => {
  test("hidden when scoped, shown in All-projects mode", () => {
    const d = doc({ project: "JOBS" });
    const { queryByText } = render(<DocItem doc={d} active={false} showProject={false} onOpen={() => {}} />);
    expect(queryByText("JOBS")).toBeNull();
    cleanup();
    render(<DocItem doc={d} active={false} showProject onOpen={() => {}} />);
    expect(screen.getByText("JOBS")).toBeTruthy();
  });
});

describe("shouldLoad — the reading pane's fetch rule", () => {
  test("nothing selected: never loads", () => {
    expect(shouldLoad(null, null, 0, null)).toBe(false);
  });

  test("a new selection always loads, even mid-stream of other documents' changes", () => {
    // the regression: doc 16 changed on disk, then the user clicks doc 19.
    expect(shouldLoad(19, 16, 5, 16)).toBe(true);
  });

  test("the same document reloads only when the change event names it", () => {
    expect(shouldLoad(19, 19, 5, 19)).toBe(true); // this one changed -> reload
    expect(shouldLoad(19, 19, 5, 16)).toBe(false); // a different one -> leave it alone
  });

  test("before any change event, the selected document loads", () => {
    expect(shouldLoad(19, null, 0, null)).toBe(true);
    expect(shouldLoad(19, 19, 0, null)).toBe(true);
  });
});

describe("sidebar ordering", () => {
  const g = { "aiview-webapp": "aiview web app", "project-selector": "aiview project selector" };
  // The regression: four old documents were MOVED, which stamped last_seen_at to now.
  // Bookkeeping must not float a year-old group above what is actually being edited.
  const docs = [
    doc({ id: 11, group_slug: "aiview-webapp", created_at: "2026-08-23T11:28:00Z",
          last_seen_at: "2026-08-24T11:21:00Z", updated_at: "2026-08-23T14:30:00Z", title: "old board" }),
    doc({ id: 14, group_slug: "aiview-webapp", created_at: "2026-08-23T11:51:00Z",
          last_seen_at: "2026-08-24T11:21:00Z", updated_at: "2026-08-23T14:30:00Z", title: "old plan" }),
    doc({ id: 16, group_slug: "project-selector", created_at: "2026-08-24T09:49:00Z",
          last_seen_at: "2026-08-24T11:23:00Z", updated_at: "2026-08-24T11:23:00Z", title: "live board" }),
  ];

  test("the group holding the most recently changed document is first", () => {
    const entries = sidebarEntries(docs, g);
    expect(entries[0]!.type).toBe("group");
    expect((entries[0] as { slug: string }).slug).toBe("project-selector");
  });

  test("moving old documents does not reorder the sidebar", () => {
    // same documents, but last_seen_at says the old ones were just touched
    const touched = docs.map((d) =>
      d.group_slug === "aiview-webapp" ? { ...d, last_seen_at: "2026-08-24T23:59:00Z" } : d,
    );
    const entries = sidebarEntries(touched, g);
    expect((entries[0] as { slug: string }).slug).toBe("project-selector");
  });

  test("a missing file falls back to last_seen_at rather than sorting last forever", () => {
    const gone = doc({ id: 99, group_slug: null, exists: false, updated_at: null, last_seen_at: "2026-08-25T08:00:00Z" });
    expect(docActivity(gone)).toBe("2026-08-25T08:00:00Z");
    expect(sidebarEntries([...docs, gone], g)[0]).toMatchObject({ type: "doc" });
  });

  test("members inside a group still read oldest-first", () => {
    const group = sidebarEntries(docs, g).find((e) => e.type === "group" && e.slug === "aiview-webapp");
    expect((group as { docs: { id: number }[] }).docs.map((d) => d.id)).toEqual([11, 14]);
  });
});

describe("kind chip inside a document row", () => {
  test("clicking the chip still opens the document (the click must reach the row)", () => {
    const onOpen = vi.fn();
    render(<DocItem doc={doc({ id: 7 })} active={false} onOpen={onOpen} />);
    const chip = document.querySelector('[data-component="KindChip"]')!;
    fireEvent.click(chip);
    expect(onOpen).toHaveBeenCalledWith(7);
  });
});

describe("Sidebar — clicking a row's kind chip", () => {
  const docs = [
    doc({ id: 5, kind: "spec", title: "Spec five", group_slug: null }),
    doc({ id: 6, kind: "plan", title: "Plan six", group_slug: "g" }),
  ];
  const render_ = (onOpen: (id: number) => void) =>
    render(
      <Sidebar docs={docs} groups={{ g: "Group G" }} projects={{ JOBS: "JOBS" }} activeProject="JOBS"
        connection="live" currentId={null} onOpen={onOpen} onPickProject={() => {}} />,
    );

  test("a flat row: clicking its kind chip opens the document", () => {
    const onOpen = vi.fn();
    render_(onOpen);
    const row = screen.getByText("Spec five").closest('[data-component="DocItem"]')!;
    fireEvent.click(row.querySelector('[data-component="KindChip"]')!);
    expect(onOpen).toHaveBeenCalledWith(5);
  });

  test("a row inside a group: clicking its kind chip opens the document", () => {
    const onOpen = vi.fn();
    render_(onOpen);
    fireEvent.click(screen.getByText("Group G")); // groups start collapsed
    const row = screen.getByText("Plan six").closest('[data-component="DocItem"]')!;
    fireEvent.click(row.querySelector('[data-component="KindChip"]')!);
    expect(onOpen).toHaveBeenCalledWith(6);
  });

  test("a decorative kind chip is not an event target; a filter chip is", () => {
    render_(() => {});
    const rowChip = screen.getByText("Spec five").closest('[data-component="DocItem"]')!
      .querySelector('[data-component="KindChip"]')!;
    expect(rowChip.tagName).toBe("SPAN");
    expect(rowChip.className).toContain("pointer-events-none");

    const filterChip = document.querySelector('[data-component="KindChips"] [data-component="KindChip"]')!;
    expect(filterChip.tagName).toBe("BUTTON");
    expect(filterChip.className).not.toContain("pointer-events-none");
  });
});

describe("composition overlay", () => {
  test("withOverlay appends the layer before </body> with the summary and target", async () => {
    const { withOverlay, OVERLAY_MARK, shortName } = await import("./lib/overlay.ts");
    const summary = { sources: ["2026-09-03-dock-tools.mockup.html"], errors: [{ ref: "a#B", message: 'Not "found"' }], warnings: [] };
    const out = withOverlay("<html><body><p>host</p></body></html>", { bindings: summary, target: "ToolPrefix" });
    expect(out.indexOf(OVERLAY_MARK)).toBeGreaterThan(out.indexOf("<p>host</p>"));
    expect(out.indexOf(OVERLAY_MARK)).toBeLessThan(out.indexOf("</body>"));
    expect(out).toContain('data-target="ToolPrefix"');
    // the summary rides on an attribute, escaped, and comes back intact
    const raw = out.match(/data-summary="([^"]*)"/)![1];
    const unescaped = raw.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&");
    expect(JSON.parse(unescaped)).toEqual(summary);
    expect(out).toContain("<script " + OVERLAY_MARK + ">");
    expect(withOverlay("<p>no body</p>")).toContain(OVERLAY_MARK);
    // the layer takes the mouse: the mockup is looked at, not operated, in Composition
    expect(out).toMatch(/#__aiview\{[^}]*pointer-events:auto/);
    expect(out).toMatch(/#__aiview \.av-box\{[^}]*pointer-events:auto;cursor:pointer/);
    expect(out).toMatch(/#__aiview \.av-box\.av-err\{[^}]*pointer-events:none/);
    // offered components get their own colour
    expect(out).toMatch(/#__aiview \.av-box\.av-decl\{[^}]*#15803d/);
    expect(out).toMatch(/#__aiview \.av-lbl\{[^}]*pointer-events:auto/);
    // every class the layer uses is namespaced: a mockup's own .box or .row rule must never style the layer
    const layerCss = out.slice(out.indexOf("<style " + OVERLAY_MARK), out.indexOf("</style>", out.indexOf("<style " + OVERLAY_MARK)));
    expect(layerCss).not.toMatch(/#__aiview \.(box|lbl|legend|row|pv|pvh|pvb)\b/);
    // no legend, no preview panel: the mode is outlines, labels and the veil
    expect(layerCss).not.toMatch(/av-legend|av-pv/);
    expect(shortName("2026-09-03-dock-tools.mockup.html")).toBe("dock-tools");
  });

  test("sourceDocFor matches by base name inside the host's folder only", async () => {
    const { sourceDocFor } = await import("./App.tsx");
    const host = doc({ id: 1, abs_path: "C:\\home\\docs\\JOBS\\host.mockup.html" });
    const docs = [
      host,
      doc({ id: 2, abs_path: "C:\\home\\docs\\JOBS\\tools.mockup.html" }),
      doc({ id: 3, abs_path: "C:\\home\\docs\\OTHER\\tools.mockup.html" }),
      doc({ id: 4, abs_path: "/home/docs/JOBS/posix.mockup.html" }),
    ];
    expect(sourceDocFor(docs, host, "tools.mockup.html")?.id).toBe(2);
    expect(sourceDocFor(docs, host, "missing.mockup.html")).toBeUndefined();
    const posixHost = doc({ id: 5, abs_path: "/home/docs/JOBS/host.mockup.html" });
    expect(sourceDocFor(docs, posixHost, "posix.mockup.html")?.id).toBe(4);
  });
});

describe("MockupFrame modes", () => {
  afterEach(() => localStorage.clear());

  test("the mode toggle persists and Composition injects the overlay", async () => {
    const { MockupFrame } = await import("./components/viewers/MockupFrame.tsx");
    const { OVERLAY_MARK } = await import("./lib/overlay.ts");
    const bindings = { sources: ["tools.mockup.html"], errors: [], warnings: [] };
    render(<MockupFrame html="<html><body><p>h</p></body></html>" bindings={bindings} />);
    const frame = () => document.querySelector("iframe")!;
    expect(frame().getAttribute("srcdoc")).not.toContain(OVERLAY_MARK);
    expect(screen.getByText("1 source")).toBeTruthy();
    fireEvent.click(screen.getByText("composition"));
    expect(localStorage.getItem("aiview.mockupMode")).toBe("composition");
    expect(frame().getAttribute("srcdoc")).toContain(OVERLAY_MARK);
    fireEvent.click(screen.getByText("rendered"));
    expect(frame().getAttribute("srcdoc")).not.toContain(OVERLAY_MARK);
  });

  test("a message from the frame's own window opens the source; others are ignored", async () => {
    const { MockupFrame } = await import("./components/viewers/MockupFrame.tsx");
    const onOpenSource = vi.fn();
    render(<MockupFrame html="<html><body></body></html>" onOpenSource={onOpenSource} />);
    const frame = document.querySelector("iframe")!;
    const data = { type: "aiview:open", file: "tools.mockup.html", component: "ToolPrefix" };
    window.dispatchEvent(new MessageEvent("message", { data, source: null }));
    expect(onOpenSource).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { data, source: frame.contentWindow }));
    expect(onOpenSource).toHaveBeenCalledWith("tools.mockup.html", "ToolPrefix");
  });
});

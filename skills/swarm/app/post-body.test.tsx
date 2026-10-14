// A post's body (SL5): fenced mermaid blocks drawn as diagrams, `#<seq>` links. jsdom cannot lay
// mermaid out: it is mocked, its render resolving an svg or rejecting.
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { segments, seqRefs } from "./lib/post.ts";

const mermaidMock = vi.hoisted(() => ({
  imported: 0,
  render: (async () => ({ svg: "" })) as (id: string, src: string) => Promise<{ svg: string }>,
}));
vi.mock("mermaid", () => {
  mermaidMock.imported++;
  return {
    default: {
      initialize: () => {},
      render: (id: string, src: string) => mermaidMock.render(id, src),
    },
  };
});

import { PostBody } from "./components/PostBody.tsx";

afterEach(cleanup);

const FENCE = "```";

describe("segments", () => {
  test("text only", () => {
    expect(segments("hello @S3")).toEqual([{ type: "text", text: "hello @S3" }]);
  });
  test("one block", () => {
    expect(segments(`${FENCE}mermaid\nflowchart LR\n A-->B\n${FENCE}`)).toEqual([{ type: "mermaid", source: "flowchart LR\n A-->B" }]);
  });
  test("two blocks with text between", () => {
    expect(segments(`a\n${FENCE}mermaid\nX\n${FENCE}\nmid\n${FENCE}mermaid\nY\n${FENCE}\nz`)).toEqual([
      { type: "text", text: "a" },
      { type: "mermaid", source: "X" },
      { type: "text", text: "mid" },
      { type: "mermaid", source: "Y" },
      { type: "text", text: "z" },
    ]);
  });
  test("an unclosed fence stays text", () => {
    const body = `see\n${FENCE}mermaid\nflowchart LR`;
    expect(segments(body)).toEqual([{ type: "text", text: body }]);
  });
  test("a Mermaid info string, any case", () => {
    expect(segments(`${FENCE}Mermaid\nX\n${FENCE}`)).toEqual([{ type: "mermaid", source: "X" }]);
  });
  test("a non-mermaid fence is left as text", () => {
    const body = `${FENCE}ts\nconst a = 1;\n${FENCE}`;
    expect(segments(body)).toEqual([{ type: "text", text: body }]);
  });
});

describe("seqRefs", () => {
  test("finds #42, ignores #abc and a#42", () => {
    expect(seqRefs("see #42 and #7, not #abc nor a#42")).toEqual([42, 7]);
  });
});

describe("PostBody", () => {
  test("a body with a block shows the text and a drawn diagram; the toggle reveals the source", async () => {
    mermaidMock.render = async () => ({ svg: '<svg data-testid="drawn"></svg>' });
    const { container } = render(<PostBody body={`see below\n${FENCE}mermaid\nflowchart LR\n A-->B\n${FENCE}`} shown={new Set()} />);
    expect(screen.getByText("see below")).toBeTruthy();
    await screen.findByTestId("drawn");
    const diagram = container.querySelector('[data-component="PostDiagram"]')!;
    expect(diagram.getAttribute("data-state")).toBe("drawn");
    expect(diagram.querySelector("pre")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "source" }));
    expect(diagram.querySelector("pre")!.textContent).toBe("flowchart LR\n A-->B");
  });

  test("a rejected render shows mermaid failed and the source", async () => {
    mermaidMock.render = async () => {
      throw new Error("Parse error on line 1");
    };
    const { container } = render(<PostBody body={`${FENCE}mermaid\nnot a diagram\n${FENCE}`} shown={new Set()} />);
    await screen.findByText("mermaid failed: Parse error on line 1");
    const diagram = container.querySelector('[data-component="PostDiagram"]')!;
    expect(diagram.getAttribute("data-state")).toBe("failed");
    expect(diagram.querySelector("pre")!.textContent).toBe("not a diagram");
  });

  test("#42 links when 42 is shown, plain text when not", () => {
    render(<PostBody body="settled in #42" shown={new Set([42])} />);
    const link = screen.getByRole("link", { name: "#42" });
    expect(link.getAttribute("href")).toBe("#seq-42");
    cleanup();
    render(<PostBody body="settled in #42" shown={new Set([7])} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("settled in #42")).toBeTruthy();
  });
});

// Kept last in the file and isolated by module: mermaid is imported only once a block needs it.
test("a body without a block never imports mermaid", async () => {
  vi.resetModules();
  mermaidMock.imported = 0;
  const { PostBody: Fresh } = await import("./components/PostBody.tsx");
  render(<Fresh body="no diagram here @S3" shown={new Set()} />);
  await new Promise((r) => setTimeout(r, 20));
  expect(mermaidMock.imported).toBe(0);
});

// The build leaves mermaid in chunks of its own, apart from the page's entry.
test.skipIf(!safeExists(join(__dirname, "../dist/assets")))("dist holds mermaid apart from the entry chunk", () => {
  const dir = join(__dirname, "../dist/assets");
  const js = readdirSync(dir).filter((f) => f.endsWith(".js"));
  const entry = js.filter((f) => f.startsWith("index-"));
  expect(js.length).toBeGreaterThan(entry.length);
  const big = js.filter((f) => statSync(join(dir, f)).size > 400_000 && !f.startsWith("index-"));
  expect(big.length).toBeGreaterThan(0);
});

function safeExists(p: string) {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

// The conversation, rendered (plan D8, D9): the item's edge and tint by tier, every special word
// and board event carrying its tip on hover and keyboard focus.
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardSnapshot, RunSummary, SnapshotEvent, SnapshotRunner } from "../../swarm/src/board/snapshot.ts";
import { conversation, TIPS } from "./lib/board/view.ts";
import { Conversation } from "./components/viewers/board/Conversation.tsx";
import { TipLayer } from "./components/viewers/board/Tip.tsx";

// jsdom cannot lay mermaid out: it is mocked, its render resolving an svg
vi.mock("mermaid", () => ({
  default: { initialize: () => {}, render: async () => ({ svg: '<svg data-testid="drawn"></svg>' }) },
}));

afterEach(cleanup);

const AT = "2026-10-14T10:00:00Z";
const RUN: RunSummary = { run: 1, kind: "plan", plan: "alpha", group: "alpha", code: "AL", title: "Alpha", link: null, open: true, runners: 2, done: 0, of: 2 };
const member = (slice: string, nick: string): SnapshotRunner => ({
  runner: `alpha/${slice}`, nick, plan: "alpha", slice, title: slice, doing: "", state: "working", stale: false,
  files: [], joined: AT, ended: null, calls: 0, listening: false, on: [], lastCall: AT,
});
let seq = 0;
const item = (from: string, body: string, over: Partial<SnapshotEvent> = {}): SnapshotEvent => ({
  seq: ++seq, at: AT, kind: "msg", from, body, about: null, run: 1, channel: 1, ...over,
});
const EVENTS = [
  item("alpha/orchestrator", "do this first", { kind: "urgent" }),
  item("alpha/S1", "flag", { kind: "event", event: "flag", about: "b.ts", mentions: ["alpha/S2", "alpha/S1"] }),
  item("alpha/S2", "@S1 I add a call in a.ts", { about: "a.ts" }),
  item("alpha/S1", "@orchestrator new question: keep the old route?"),
  item("alpha/orchestrator", "quiet 12 min", { kind: "event", event: "quiet" }),
  item("alpha/S2", "@S1 S1 the top", { kind: "agreement", about: "c.ts" }),
  item("alpha/S1", "just talk"),
  item("alpha/S1", "merged abc: rebase your branch onto it.", { kind: "event", event: "merged" }),
  item("alpha/S1", "joined: the page", { kind: "event", event: "joined" }),
];
const SNAP: BoardSnapshot = {
  repo: "/r/.git", name: "r", runs: [RUN], lock: null, roster: [member("S1", "Sleepy Otter"), member("S2", "Brave Badger"), member("orchestrator", "Calm Owl")],
  events: EVENTS, queues: {}, files: [{ path: "a.ts", holders: ["alpha/S1"], interface: false }], flags: [],
};

const show = () => {
  const r = render(
    <>
      <TipLayer />
      <Conversation items={conversation(SNAP, { run: null, follow: null })} archived={null} fresh={new Set()} />
    </>,
  );
  const li = (text: string | RegExp) => screen.getByText(text).closest("li") as HTMLElement;
  return { ...r, li };
};

test("act now (urgent, an open flag): a red edge class; the open flag alone its tint class", () => {
  const { li } = show();
  const urgent = li("do this first");
  expect([...urgent.classList]).toEqual(expect.arrayContaining(["item", "act", "urgent"]));
  expect(urgent.classList.contains("open")).toBe(false);
  const flag = li("flag");
  expect([...flag.classList]).toEqual(expect.arrayContaining(["item", "act", "flag", "open"]));
});

test("waiting (a held file, a question, quiet): the dashed edge class", () => {
  const { li } = show();
  for (const text of [/I add a call in a\.ts/, /new question/, "quiet 12 min"]) {
    expect(li(text).classList.contains("wait"), String(text)).toBe(true);
  }
});

test("decided and talk carry no edge class; a plain message no word", () => {
  const { li } = show();
  const agreed = li(/S1 the top/);
  expect(agreed.classList.contains("decided")).toBe(true);
  const talk = li("just talk");
  expect(["act", "wait", "decided"].some((c) => talk.classList.contains(c))).toBe(false);
  expect(talk.querySelector(".what")).toBeNull();
});

test("the stylesheet: an item has no fill but the open flag's tint; act a solid red edge, wait a dashed one", () => {
  const css = readFileSync(join(__dirname, "components/viewers/board/board.css"), "utf8");
  // every rule whose selector is the item itself, with any of its classes, under the board's root
  const itemRules = [...css.matchAll(/^\.board (\.item(?:\.[\w-]+)*)\s*\{([^}]*)\}/gm)].map((m) => ({ selector: m[1], body: m[2] }));
  expect(itemRules.filter((r) => /background/.test(r.body)).map((r) => r.selector)).toEqual([".item.flag.open"]);
  expect(css).toContain(".board .item.act { border-left: 2px solid var(--danger); }");
  expect(css).toContain(".board .item.wait { border-left: 2px dashed var(--amber); }");
});

test("every special word carries its tip, focusable (D9)", () => {
  show();
  const tipOf = (word: string | RegExp) => {
    const el = screen.getByText(word);
    expect(el.getAttribute("tabindex"), String(word)).toBe("0");
    return el.getAttribute("data-tip");
  };
  expect(tipOf("! urgent")).toBe(TIPS.urgent);
  expect(tipOf("⚑ flag · open")).toBe(TIPS.flag);
  expect(tipOf("held file")).toBe(TIPS.held);
  expect(tipOf(/^\? question for/)).toBe(TIPS.question);
  expect(tipOf("◷ quiet 12 min")).toBe(TIPS.quiet);
  expect(tipOf(/^✔ agreed with/)).toBe(TIPS.agreement);
});

test("a board event explains itself on hover and on keyboard focus (D9)", () => {
  const { li } = show();
  const merged = li(/merged abc/).querySelector("[data-tip]") as HTMLElement;
  expect(merged.dataset.tip).toBe(TIPS.merged);
  expect(merged.getAttribute("tabindex")).toBe("0");
  expect((li(/joined: the page/).querySelector("[data-tip]") as HTMLElement).dataset.tip).toBe(TIPS.joined);
  const box = screen.getByRole("tooltip", { hidden: true });
  fireEvent.mouseOver(merged);
  expect(box.hidden).toBe(false);
  expect(box.textContent).toBe(TIPS.merged);
  fireEvent.focusOut(merged);
  expect(box.hidden).toBe(true);
  fireEvent.focusIn(screen.getByText("! urgent"));
  expect(box.textContent).toBe(TIPS.urgent);
});

test("a message carrying a mermaid fence shows it as a diagram in the conversation", async () => {
  const FENCE = "```";
  const said = item("alpha/S1", `the flow\n${FENCE}mermaid\nflowchart LR\n A-->B\n${FENCE}`);
  const snap = { ...SNAP, events: [said] };
  const { container } = render(<Conversation items={conversation(snap, { run: null, follow: null })} archived={null} fresh={new Set()} />);
  await screen.findByTestId("drawn");
  const diagram = container.querySelector('[data-component="ConversationItem"] [data-component="PostDiagram"]');
  expect(diagram).not.toBeNull();
  expect(screen.getByText("the flow")).toBeTruthy();
});

test("a member reads code first, then nick (D10); the agreement word names the other member so", () => {
  const { li } = show();
  const agreed = li(/S1 the top/);
  expect(agreed.querySelector('[data-component="RunnerTag"]')?.textContent).toBe("AL·S2");
  expect(screen.getByText("✔ agreed with AL·S1 Sleepy Otter")).toBeTruthy();
});

// The board's core events (D59): the one place an event name is listed. A member subscribes to
// the events that wake its `wait --mentions`; adding an event is a row in EVENTS and the call
// that posts it by its constant.
import type { Message, Participant } from "./board.ts";
import { profileOf } from "./kinds.ts";

export type EventName = "agreement" | "endorsement" | "merged" | "joined" | "ended" | "stale" | "opened" | "closed" | "urgent" | "flag";
export type Scope = "run" | "main";
export type Subscription = { event: EventName; scope: Scope };

export interface EventDef {
  name: EventName;
  /** always wakes, whatever the subscriptions (urgent) */
  always?: boolean;
  /** the line a woken member runs next, or null; `cli` is the command prefix the CLI prints */
  next?(m: Message, me: Participant, cli: string): string | null;
}

/** A POSIX shell word, double-quoted when it holds anything else than plain characters. */
const word = (w: string): string => (/^[\w@%+=:,./-]+$/.test(w) ? w : `"${w.replace(/(["\\$`])/g, "\\$1")}"`);

export const EVENTS: Record<EventName, EventDef> = {
  // a seat backs another member's agreement (D36)
  agreement: {
    name: "agreement",
    next: (m, me, cli) =>
      profileOf(me.kind).member === "seat" && m.from !== me.name ? `back it: ${cli} endorse ${m.seq} --as ${word(me.name)}` : null,
  },
  endorsement: { name: "endorsement" },
  merged: { name: "merged" },
  joined: { name: "joined" },
  ended: { name: "ended" },
  stale: { name: "stale" },
  // in main when a run opens: its kind, group and title (D69)
  opened: { name: "opened" },
  closed: { name: "closed" },
  urgent: { name: "urgent", always: true },
  // a write outside the writer's claim on a path another holds (D10); mentions: the holder, then the writer
  flag: {
    name: "flag",
    next: (m, me, cli) => {
      const [holder, writer] = m.mentions;
      if (!m.about || !holder || !writer) return null;
      if (me.name === holder) return `settle it: ${cli} agree ${word(`@${writer} <who changes what>`)} --about ${word(m.about)}`;
      if (me.name === writer) return `settle it: ${cli} post ${word(`@${holder} <what you change>`)} --about ${word(m.about)}`;
      return null;
    },
  },
};

const NAMES = Object.keys(EVENTS) as EventName[];
const isEvent = (s: string): s is EventName => Object.hasOwn(EVENTS, s);

/** The message's event: its stored name, else what its kind is (agreement, endorsement, urgent); null for a plain post. */
export function eventOf(m: Message): EventName | null {
  if (m.event && isEvent(m.event)) return m.event;
  return m.kind === "agreement" || m.kind === "endorsement" || m.kind === "urgent" ? m.kind : null;
}

/** "agreement,main:merged" (or a list of such); throws on an unknown name, listing the known ones. */
export function parseSubscriptions(spec: string | string[]): Subscription[] {
  const parts = (Array.isArray(spec) ? spec : [spec]).flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  const out: Subscription[] = [];
  for (const p of parts) {
    const main = p.startsWith("main:");
    const name = main ? p.slice(5) : p;
    if (!isEvent(name)) throw new Error(`unknown event ${name}: the events are ${NAMES.join(", ")}`);
    const sub: Subscription = { event: name, scope: main ? "main" : "run" };
    if (!out.some((o) => o.event === sub.event && o.scope === sub.scope)) out.push(sub);
  }
  return out;
}

/** "agreement, main:merged" */
export function formatSubscriptions(subs: Subscription[]): string {
  return subs.map((s) => (s.scope === "main" ? `main:${s.event}` : s.event)).join(", ");
}

/** Mentions `me` by name or its plan's @all. */
export function mentions(m: Message, me: Participant): boolean {
  return m.mentions.includes(me.name) || m.mentions.includes(`${me.plan}/*`);
}

/** A message that ends `me`'s `wait --mentions`: a mention, an always event, or a subscribed event in its scope. */
export function wakes(m: Message, me: Participant, subs: Subscription[]): boolean {
  if (m.from === me.name) return false;
  if (mentions(m, me)) return true;
  const e = eventOf(m);
  if (!e) return false;
  if (EVENTS[e].always) return true;
  const scope: Scope | null = m.channel === "main" ? "main" : m.channel.run === me.run ? "run" : null;
  return scope !== null && subs.some((s) => s.event === e && s.scope === scope);
}

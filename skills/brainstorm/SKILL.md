---
name: brainstorm
description: Use before building anything non-trivial (a new feature, service, integration, or system) to turn an idea into an approved spec and an implementation plan, with architecture diagrams. Covers the design conversation itself: requirements, approaches, boundaries, data flow. Not for bug fixes or mechanical edits.
---

# Brainstorm

Turns an idea into a design, a written spec, and a plan (through questions, not
assumptions) and **draws the design while discussing it.**

A diagram here is a thinking tool, not decoration. Its job is to make a boundary,
an ordering, or a dependency visible early enough to argue about cheaply.

<HARD-GATE>
No implementation, no scaffolding, no code, no file creation for the thing being
designed until the spec is written and the user has approved it. Every project, however
simple. A simple project's spec is three paragraphs, but it exists and it's approved.
</HARD-GATE>

## Flow

1. **Read the context**: existing code, `AGENTS.md`/`CLAUDE.md`, recent commits, the
   conventions already in force. Design that fights the house rules is wasted design.
2. **Scope check**: if the request is several independent systems, say so now and help
   decompose it. Each piece gets its own spec. Don't refine details of a project that
   needs splitting first.
3. **Question loop**: one question per message. Multiple choice where the options are
   knowable; open-ended where they aren't. Understand purpose, constraints, success
   criteria, and what's explicitly out of scope.
4. **Approaches**: propose 2–3 with real trade-offs. Lead with your recommendation and
   why. YAGNI every one of them before presenting.
5. **Design, in sections**: scale each section to its complexity. Ask after each one
   whether it holds before moving on.
6. **Write the spec** → self-review → user reviews it.
7. **Write the plan**: phased, each phase independently verifiable.

## The board (live document)

The design lives in one Markdown file from the first question, not in chat. Create
`YYYY-MM-DD-<topic>.brainstorm.md` in the data home — ask the `aiview` skill for the
path rather than composing one, and never write inside the project repo — as soon as
the context is read, and keep every decision, open question, considered option,
diagram, and research note in it: the chat is transient, the board is the record.
Structure:
decisions table (status: agreed / proposed / open / deferred), context being built on,
design sections, diagrams, research notes.

Open the board via the `aiview` skill (`../aiview/SKILL.md` in this collection)
the moment you create it: kind `brainstorm` (from the filename), tags = project + topic,
group = the topic (titled: the spec and plan will join it), started honestly. Tell
the user the URL it prints. Nothing to babysit: the server is detached; keep editing
the same file, it reloads on save. Resuming on another machine needs no
re-registration: list the brainstorm-kind documents and read the relevant board before
asking the user anything again.

## Diagrams

Use the `write-diagrams` skill (`../write-diagrams/SKILL.md` in this
collection). Pick from its catalog by the open question, follow its discipline. Brainstorm-specific guidance: use
diagrams **during the question loop**, not only in the spec: a diagram with a `?` on
the contested arrow is the cheapest way to ask a question. Expect 2–4 for a feature;
the board's most common catalog entries are container, sequence, state machine,
dependency graph, and option comparison.

## Approaches

Present options conversationally with the trade-off that actually decides it, not a
feature matrix. When the options differ structurally, draw them: two small container
diagrams side by side beat two paragraphs. Say which you'd pick and why.

## The spec

Write `YYYY-MM-DD-<topic>.spec.md` beside the board, register it with aiview as kind
`spec` carrying the board's tags **and the board's `--group`** (one piece of work, one
container), and note the spec path at the top of the board. Contents:

**Problem**: what's wrong today, who feels it · **Goals / non-goals**: the non-goals
are the valuable half · **Design**: prose plus the diagrams that earned their place ·
**Data**: shapes, ownership, migrations · **Failure modes**: what breaks, what the
user sees · **Testing**: what proves this works · **Open questions**: with a named
owner, or none at all.

Then self-review with fresh eyes and fix inline: any TBD or placeholder left? Do two
sections contradict each other? Does every diagram match the prose beside it? Could a
requirement be read two ways? If so, pick one and write it plainly. Is this one
implementation plan's worth of work, or does it still need splitting?

Then stop and ask the user to review the file before you write the plan.

## The plan

Only after the spec is approved. Phases, each one independently verifiable: a phase
whose completion you can't check isn't a phase. Per phase: what changes, which files,
how it's verified, and what it unblocks. Order by dependency, and put the riskiest
unknown first: that's where the plan will change.

**The plan carries diagrams** (`write-diagrams` skill): they are the implementer's
mental model and durable context for every later AI session that reads the plan:

- A **phasing diagram always**, even for a plain chain: it is the tracker (below), so the
  plan cannot record progress without it — and it is the plan's **opening section**,
  first in the file after the title and links. The tracker is the plan's working core:
  a resumer meets where the work stands before any prose, and a stale one is caught the
  moment the file opens rather than after the phases have been re-read.
- The **boundary diagram the implementation must hold** (usually the dependency
  graph, forbidden edges drawn) comes right after the tracker, before phase 1: every
  extraction or refactor phase is checked against it.
- A phase whose behavior is an **ordering with failure branches** (a daemon
  handshake, a retry flow, a migration) gets its sequence or state diagram inside
  the phase, drawn before the phase is executed.
- Carry the relevant spec/board diagram into the phase that implements it; if the
  board produced no diagram for a boundary the plan depends on, draw it now: its
  absence is a review finding, not a pass.

Write `YYYY-MM-DD-<topic>.plan.md` beside the board and spec, and register it with
aiview as kind `plan`, carrying the board's tags and `--group`.

### The tracker is the diagram

A plan is read twice: once to agree on it, and then by whoever resumes the work — often a
later session with none of the conversation in context, sometimes weeks later. The second
reader needs **state**, and phases alone do not carry it.

So the plan's phasing diagram does double duty: it is the **tracker**, the single place
that says where the work stands. Not an illustration of progress recorded elsewhere — the
record itself.

**Every step is a node**, at the granularity someone would pause at, with the dependency
edges and decision gates that already belong in a phasing diagram. Each label opens with
its status:

| Glyph | Means |
|---|---|
| ✅ | Done — its done-when was met, and the evidence is written into the step below |
| ▶ | In progress — the one place work is happening |
| ⏸ | Blocked on someone else — the node says what it waits on and when it was asked for |
| ⬜ | Not started |
| ✖ | Failed or abandoned — the step says what happened and what changed because of it |

**One ▶ at a time**, or the diagram stops answering "where am I". ⏸ is what keeps that
rule honest: when a step stalls on something outside your control — an approval, a
registration, another team's deploy — it becomes ⏸ and the frontier moves to whatever can
proceed without it. A step parked as ▶ for days claims attention it is not getting.

**One node carries the resume state**, drawn apart from the flow and connected to nothing:
the branch and the commit it was cut from, what is uncommitted and why (including anything
deliberately throwaway), anything parked elsewhere — a stash, a side branch, a
half-finished experiment — and the facts the work has earned that a fresh session would
otherwise rediscover the hard way: a rename, a version bump, an environment quirk, an
error you stopped in the middle of.

That node is what makes the plan **pausable**. A step can be abandoned mid-flight as long
as the diagram says where the work sat when it stopped.

#### Running it is another skill's job

Everything about *executing* this plan — how much to do without asking, when to stop, how
the tracker is kept true while the work happens, and what to do when reality departs from
it — belongs to the `execute-plan` skill (`../execute-plan/SKILL.md` in this collection).
Author the tracker here; that skill runs it — and it will refuse a plan without one, because
a plan that cannot record progress cannot be resumed by whoever picks it up.

Two rules matter while authoring, because they shape what you draw: **one ▶ at a time**,
and **steps at the granularity someone would pause at**. A step whose first half can finish
while the second waits on someone else is two steps, and drawing it as one guarantees a
hole in the tracker the day it happens.

#### Keeping it readable

**One column.** A tracker is scanned, not studied, and the scan is ruined by width.
`flowchart TB`, steps chained linearly, only the gates branching sideways. Three things
widen it in practice:

- **The state node is connected to nothing, so the layout parks it beside the flow.** Pin
  it above with an invisible edge — `ST ~~~ S01` — and the column starts at the top.
- **Long labels set node width, and one wide node widens the graph.** Keep every `<br/>`
  line short; the state node is the usual offender, since it wants to say everything.
- **`direction` inside a subgraph that is itself an edge endpoint** fights the outer
  layout. Leave it out; the outer `TB` already governs.

Styling repeats what the glyph already said, never replaces it (`write-diagrams` has the
reasoning, and the eight-digit hex rather than `rgba()`):

```
classDef done stroke:#4a9d5f,stroke-width:2px,fill:#7f7f7f1a
classDef next stroke:#d08b28,stroke-width:2px,fill:#7f7f7f1a
classDef todo stroke-dasharray:4 3
classDef state stroke:#8a8a8a,stroke-width:1px,fill:#7f7f7f12
```

**Parse the diagram, do not eyeball it.** Mermaid fails quietly, a broken `classDef` still
renders, just wrong, and a tracker nobody can read is a tracker nobody updates. Run
`aiview mermaid-check <plan>` after every edit to the tracker.

## Red flags

| Thought | Reality |
|---|---|
| "This is simple, I'll just build it" | The gate applies to every project. Simple ones are where wrong assumptions hide. |
| "The user knows what they want" | They know the outcome. The boundaries are what you're for. |
| "Let me scaffold while we talk" | Files created before approval get defended instead of discarded. |
| "The plan says what to do, that is enough to resume" | It says the intent. Which branch, what is uncommitted, what already failed — none of that is in the phases. |
| "I'll add a checklist at the top as well" | Two trackers drift, and then the reader has to work out which one is lying. The diagram, and nothing else. |
| "This step is blocked, so it is ✖" | ✖ is abandoned. Blocked is ⏸, it names what it waits on, and the frontier moves to what can proceed meanwhile. |
| "The plan didn't predict this, so the plan was wrong" | Plans are hypotheses. The tracker is where reality is recorded — a diagram that never changed is one nobody was using. |

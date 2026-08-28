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

- The **boundary diagram the implementation must hold** (usually the dependency
  graph, forbidden edges drawn) goes at the top, before phase 1: every extraction
  or refactor phase is checked against it.
- A phase whose behavior is an **ordering with failure branches** (a daemon
  handshake, a retry flow, a migration) gets its sequence or state diagram inside
  the phase, drawn before the phase is executed.
- A **phasing diagram always**, even for a plain chain: it is the tracker (below), so the
  plan cannot record progress without it.
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
that says where the work stands. Not an illustration of progress recorded elsewhere —
the record itself.

**Every step is a node**, at the granularity someone would pause at, with the dependency
edges and the decision gates that already belong in a phasing diagram. Each node's label
opens with its status:

| Glyph | Means |
|---|---|
| ✅ | Done — its done-when was met, and the evidence is written into the step below |
| ▶ | In progress — at most one, or the diagram stops answering "where am I" |
| ⬜ | Not started |
| ✖ | Failed or abandoned — the step text says what happened and what changed because of it |

**One node carries the resume state**, drawn apart from the flow and connected to nothing:
the branch and the commit it was cut from, what is uncommitted and why (including anything
deliberately throwaway), anything parked elsewhere — a stash, a side branch, a
half-finished experiment — and the facts the work has earned that a fresh session would
otherwise rediscover the hard way: a rename, a version bump, an environment quirk, an
error you stopped in the middle of.

That node is what makes the plan **pausable**. A step can be abandoned mid-flight as long
as the diagram says where the work sat when it stopped.

**Tick as you go, never in a batch at the end.** A node turns ✅ only when its own done-when
is met; the evidence — what was observed, not "worked" — goes into the step's prose. A
tracker updated once at the end of a session was wrong for the whole session, and a stale
diagram is worse than none: it is confidently misleading. When an outcome changes the plan
— a spike that fails, a decision reopened — amend the step and mark it ✖, rather than
leaving intent and reality disagreeing.

**Nowhere else records progress.** No checklist, no status table, no second summary at the
top. Two trackers drift, and then the plan has to be read twice to find out which half is
lying. The steps hold detail and evidence; the diagram holds state.

**Update the tracker before handing control back.** Not only as steps land — *before every
handoff*: a question for the user, a request to approve something, the end of a turn.
That moment is the one where a session can end without warning, and whatever the tracker
does not say by then is lost with it. A question asked over a stale tracker also wastes
the answer: the human has to correct the record before they can address the question.

So the order is fixed, and it is worth being rigid about: **finish the work, write the
evidence into the step, move the glyphs and the state node, then ask.** If a step ended in
a way that changes the plan — a spike that failed, a decision reopened, a step that turned
out to be two — amend the plan first as well. The question then arrives on top of a
document that is true.

**If you paused in the middle of a step, the step was too coarse.** Split it where the
pause fell, and let the glyphs sit on either side. A step whose first half is done and
second half is not cannot be marked, and an unmarkable step is a hole in the tracker —
which is what "steps at the granularity someone would pause at" means in practice. The
split is usually the same shape: work that can be checked locally, then the verification
that needs something you do not control — a deploy, a real identity provider, another
person's review.

The glyph carries the meaning so the diagram survives a dark theme, a grayscale print and
a colour-blind reader. Colour only repeats what the glyph already said:

```
classDef done stroke:#4a9d5f,stroke-width:2px,fill:#7f7f7f1a
classDef next stroke:#d08b28,stroke-width:2px,fill:#7f7f7f1a
classDef todo stroke-dasharray:4 3
classDef state stroke:#8a8a8a,stroke-width:1px,fill:#7f7f7f12
```

Eight-digit hex and translucent fills, for the reasons the `write-diagrams` skill gives.

**Keep it one column.** A tracker is scanned, not studied, and the scan is ruined by width.
`flowchart TB`, steps chained linearly, and only the gates allowed to branch sideways —
that is the whole shape. Three things widen it in practice:

- **The state node is connected to nothing, so the layout parks it beside the flow.** Pin
  it above with an invisible edge — `ST ~~~ S01` — and the column starts at the top.
- **Long labels set node width, and one wide node widens the graph.** Keep every `<br/>`
  line short; the state node is the usual offender, since it wants to say everything.
- **`direction` inside a subgraph that is itself an edge endpoint** fights the outer
  layout. Leave it out; the outer `TB` already governs.

**Parse the diagram, do not eyeball it.** Mermaid fails quietly — a broken `classDef` still
renders, just wrong — and a tracker nobody can read is a tracker nobody updates.

## Red flags

| Thought | Reality |
|---|---|
| "This is simple, I'll just build it" | The gate applies to every project. Simple ones are where wrong assumptions hide. |
| "The user knows what they want" | They know the outcome. The boundaries are what you're for. |
| "Let me scaffold while we talk" | Files created before approval get defended instead of discarded. |
| "I'll update the tracker when the phase is done" | Then it was wrong for the whole phase. Tick each step as it lands, or the block misleads the next session. |
| "The plan says what to do, that is enough to resume" | It says the intent. Which branch, what is uncommitted, what already failed — none of that is in the phases. |
| "I'll add a checklist at the top as well" | Two trackers drift, and then the reader has to work out which one is lying. The diagram, and nothing else. |
| "I'll ask the user first, then update the tracker" | The handoff is where the session may end. Ask over a stale tracker and the human spends their answer fixing the record. |

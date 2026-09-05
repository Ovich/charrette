---
name: write-plan
description: Use when an approved spec exists and the implementation plan for its next increment has to be written, or an existing plan has to be redrawn after an increment landed. Produces the plan document whose phasing diagram is the tracker execute-plan runs from. Not for designing the change (brainstorm) and not for carrying the plan out (execute-plan).
---

# Write a plan

The plan is the iteration's plan, not the project's: it covers one increment, a change
that works and can be verified when it lands, and stops where the next increment would
begin. No big design up front: a plan is sized to what the person can hold in mind
and approve in one reading.

## Input

An approved spec, opened via the `aiview` skill (`../aiview/SKILL.md` in this
collection) so it is on screen, and the board it came from when there is one. When
the plan follows an earlier increment, read that increment's plan first: its finished
steps say what was learned, and this plan is written with that in hand.

## Phases

Each phase independently verifiable: a phase whose completion you can't check isn't a
phase. Per phase: what changes, which files, the spec's user stories it serves in
full or in part (`US3`), how it's verified with something observed rather than
"implemented", and what it unblocks. Order by dependency, and put the riskiest
unknown first: that's where the plan will change. Stories never shape a phase: cut
phases by what changes together, and a story served by several phases is verified
where they meet, the join's done-when being that story's acceptance criteria.

Once the phases are drafted, look for the ones that can run at the same time: phases
that touch disjoint files and need nothing from each other before a later phase joins
them. Name them to the person in chat, one message ("phases 2 and 3 touch different
areas and could run in parallel, draw them as branches?"), and draw the fork only on a
yes. `execute-plan` runs branches at once, one subagent per branch, and a fork drawn
over a shared file is the merge conflict it would have had to resolve.

## Implementation decisions

The plan carries a register, one row per decision the implementation rests on: id
(`ID4`), kind, the decision, its source, and the phase or story it binds. Six kinds:
a module created or updated, an interface that changes, an architectural choice, a
schema change, an API contract, a technical clarification the person gave. The
source is the person with the interview entry (`Q7`), the code, or the docs. Fill it
from the spec and the hardening interview; the spec states a contract, the register
records what was decided about it and where it lands. `execute-plan` adds rows as
the work decides things the plan did not.

## Diagrams

Use the `write-diagrams` skill (`../write-diagrams/SKILL.md` in this collection).
The plan's diagrams are the implementer's mental model and durable context for every
later session that reads it:

- A **phasing diagram always**, even for a plain chain: it is the tracker (below), and it
  is the plan's **opening section**, first after the title and links, so a resumer meets
  where the work stands before any prose and a stale one is caught the moment the file
  opens.
- The **boundary diagram the implementation must hold** (usually the dependency
  graph, forbidden edges drawn) comes right after the tracker, before phase 1: every
  extraction or refactor phase is checked against it.
- A phase whose behavior is an **ordering with failure branches** (a daemon
  handshake, a retry flow, a migration) gets its sequence or state diagram inside
  the phase, drawn before the phase is executed.
- Carry the relevant spec or board diagram into the phase that implements it; if the
  board produced no diagram for a boundary the plan depends on, draw it now: its
  absence is a review finding, not a pass.

## The tracker

The phasing diagram is the plan's tracker, the record of where the work stands, kept by
the `execute-plan` skill from the first step on. Draw it to its protocol,
`../execute-plan/references/tracker.md`, read before drawing: one node per step at the
granularity someone would pause at, a status glyph opening every label, a state node
connected to nothing that holds the resume state, one column. Run
`aiview mermaid-check <plan>` after drawing it.

## The document

Write `YYYY-MM-DD-<topic>.plan.md` beside the spec (ask the `aiview` skill for the
path) and open it via that skill as kind `plan`, carrying the spec's tags and
`--group`. Note the plan's path at the top of the board.

## Harden it, on request

With the plan drafted, ask one multiple-choice question in chat: harden the plan
through an interview (recommended when a phase touches code nobody in the
conversation has read, or when there are more than three phases), or approve it as
drafted. On yes, run the `interview` skill (`../interview/SKILL.md` in this
collection) with the implementation decisions register as the tree, phase by phase:
the modules, interfaces, architecture, schema, contracts and clarifications each
phase rests on, the rows already filled confirmed from the code, the missing ones
resolved with the person. A decision a phase needs that cannot be made before an
earlier phase runs cuts that phase to "planned after phase N runs". Hardening fills
the register and removes assumptions; it does not add detail. The interview runs in
chat: write what it settles into the register and the phases it concerns, and the
exchange itself into an **interview log** at the end of the plan, one entry per
question in the order asked, appended as each answer lands, verbatim, the question
with its options and recommendation, then the answer as given. Record the answer to
the hardening question in the plan's header (`hardened: yes` or `no`).

Then stop and ask the person to approve the plan. Running it is `execute-plan`'s job.

## Red flags

| Thought | Reality |
|---|---|
| "I'll plan the whole feature while I have the context" | Plan the increment. The next plan is written with this one's learning in hand, which you do not have yet. |
| "I'll add a checklist at the top as well" | Two trackers drift, and then the reader has to work out which one is lying. The diagram, and nothing else. |
| "The hardening made the plan longer" | Then it added detail instead of removing assumptions. A phase that cannot be verified now becomes a line saying when it will be planned. |

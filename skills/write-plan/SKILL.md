---
name: write-plan
description: Use when an approved spec exists and the implementation plan for its next increment has to be written, or an existing plan has to be redrawn after an increment landed. Produces the plan document whose diagram is the tracker execute-plan runs from. Not for designing the change (brainstorm) and not for carrying the plan out (execute-plan).
---

# Write a plan

One spec, iterated; one plan per increment. The plan takes the stories the spec has
not delivered yet and stops where the next increment would begin. It is sized to what
the person can hold in mind and approve in one reading.

## Input

The approved spec, open in the viewer (`aiview` skill, `../aiview/SKILL.md` in this
collection), its board, and the previous plan's finished steps when this is not the
first increment.

How the project tests, read before drawing a slice: its scripts, its existing tests,
its CI. A codebase with no tests yet gets the question in the draft review: at which
level each layer is tested, and what a test may touch.

## Slices

Cut the spec into thin vertical slices, each through every integration layer the
change touches, schema to screen, each verifiable end to end when it lands. A slice
takes from each layer only what it needs: the two columns, not the whole schema; the
one endpoint, not the whole service; the one screen state. The rest of a layer waits
for the slice that needs it. Never cut by layer: schema then API then screens
verifies nothing until the last one.

Per slice: the stories it serves (`US3`), what changes, which files, the done-when as
a test, what it unblocks, and a mark when it needs a person:
`👤 decision` (architecture, contract), `👤 design review` (a screen, a mockup), or
none. Order riskiest unknown first. Slices that touch disjoint files and need nothing
from each other before a join may fork; propose the fork in one message, draw it on
a yes.

## Test first

Every slice is built test first, and its steps say so: the first step writes the test
that proves the done-when, named with its file; the second runs it and records that
it fails; only then the implementation, and the last step runs the test and records
that it passes. A screen's behaviour is tested the same way; its look is the
`👤 design review`. A slice drawn without the failing-test step is not a slice.

## Implementation decisions

A register in the plan: id (`ID4`), kind, decision, status (agreed, open, deferred),
source, slice. Kinds: module created or updated, interface change, architecture,
schema, API contract, technical clarification from the person. Sources: `board D3`,
`board Q7`, `plan Q2`, the code, the docs. The spec states a contract; the register
records what was decided about it. Rows ordered by slice. `execute-plan` adds rows as
the work decides things.

## Diagrams

The `write-diagrams` skill (`../write-diagrams/SKILL.md` in this collection). The
tracker first, drawn to `../execute-plan/references/tracker.md` (read before
drawing): one subgraph per slice, its title carrying the stories and the mark. Then
the boundary the implementation must hold, usually the dependency graph with
forbidden edges. Inside a slice with an ordering and failure branches, its sequence
or state diagram. `aiview mermaid-check <plan>` after every edit.

## The document

`YYYY-MM-DD-<topic>.plan.md` beside the spec (path from the `aiview` skill), opened
as kind `plan` with the spec's tags and `--group`. Opening lines: title, the spec's
and the board's paths, the stories this increment delivers, `hardened: yes | no`.
Note the plan's path at the top of the spec and the board.

## Draft review, then hardening on request

With the plan drafted, ask the person, one question per message, with your
recommendation: is the granularity right; does the dependency flow hold; should any
slice split; are the `👤` marks complete. Redraw on their answers.

Then one multiple-choice question: harden the plan through an interview
(recommended when a slice touches code nobody in the conversation has read, or when
there are more than three slices), or skip. On yes, run the `interview` skill
(`../interview/SKILL.md` in this collection) with the register as the tree, slice by
slice: filled rows confirmed from the code, missing rows resolved with the person. A
decision a slice needs that cannot be made before an earlier slice runs cuts that
slice to "planned after slice N runs". Hardening fills the register and removes
assumptions; it adds no detail. Write what it settles into the register and the
slices, and the exchange into an interview log at the end of the plan, in the board's
log format (`brainstorm` skill), entries `Q1`, `Q2`.

Then stop and ask the person to approve the plan. Running it is `execute-plan`'s job.

## Red flags

| Thought | Reality |
|---|---|
| "I'll plan the whole feature while I have the context" | Plan the increment. The next plan is written with this one's learning in hand, which you do not have yet. |
| "Schema first, then the API, then the screens" | Nothing is verifiable until the last slice. One story end to end, then the next. |
| "The test can come once the code works" | Then the test is written to fit the code. The test comes first, is seen failing, and the code is written to pass it. |
| "The hardening made the plan longer" | Then it added detail instead of removing assumptions. A slice that cannot be decided now becomes a line saying when it will be planned. |

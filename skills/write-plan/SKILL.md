---
name: write-plan
description: Use when an approved spec exists and the implementation plan for its next increment has to be written, or an existing plan has to be redrawn after an increment landed. Produces the plan document whose diagram is the tracker execute-plan runs from. Not for designing the change (brainstorm) and not for carrying the plan out (execute-plan).
---

# Write a plan

**One spec, iterated; one plan per increment.** The plan takes the stories the spec has not delivered yet, stops where the next increment would begin, and is sized to what the person can approve in one reading.

## Input

- **The approved spec**, open in the viewer (`aiview` skill, `../aiview/SKILL.md` in this collection), its board, and the previous plan's finished steps when this is not the first increment.
- **How the project tests**, read before drawing a slice: its scripts, its existing tests, its CI. A codebase with no tests yet gets the question in the draft review: at which level each layer is tested, and what a test may touch.

## Slices

- **Cut the spec into thin vertical slices**, each through every integration layer the change touches, schema to screen, each verifiable end to end when it lands. Never by layer.
- **A slice takes from each layer only what it needs**: the two columns, not the whole schema; the one endpoint, not the whole service; the one screen state.
- **Per slice**: the stories it serves (`US3`), what it delivers end to end, the slices that block it, the done-when as a test, and a mark when it needs a person: `👤 decision` (architecture, contract), `👤 design review` (a screen, a mockup), or none.
- **Size each slice to one fresh context window**; a slice is one agent's work. Order riskiest unknown first.
- **Slices that block nothing of each other's may fork**, on the terms `../execute-plan/references/tracker.md` sets. Propose the fork in one message, draw it on a yes.
- **Each slice merges to `main` on its own and leaves the deployed environment green**: complete, or inert where it is not yet. When a slice cannot be, the plan names what makes it inert (a value optional until the slice that supplies it, a route unmounted until its screen exists).
- **Every slice's done-when is a test seen failing before the work and passing after**; a slice with no such done-when is not a slice. A screen's behaviour is tested the same way; its look is the `👤 design review`. The plan draws no "write the test" step: that is `write-code`'s (`../write-code/SKILL.md` in this collection).

## The slice document

**One document per slice, the whole context one agent needs, and the only place instructions live.** The plan's table is the record of what happened.

- **Written after the draft review and the hardening**, one per slice with work left, and one for any slice drawn later, when it is drawn. A finished slice gets none.
- **Named `<plan-stem>-<node>.slice.md`**, kind `slice`, the plan's tags, the plan's group. Under each slice's heading, the plan names its document.
- **Carry the part that binds, trimmed to it.** The conventions file is never copied.
- **No source file paths.** Document names, commands and interfaces are not paths. A code snippet only when it carries a decision prose cannot, a schema, a state machine, a type shape, trimmed to the decision.

<slice-template>

# <node id>: <title>

> **Slice document** of `<plan file>`. Carry it out with the `execute-slice` skill:
> check the blockers first, and stop if any is unmet.

**What this delivers.** The end-to-end behaviour, from the user's side.

**Blocked by.** The slices this one depends on, named whether or not they are done. It
is the shape of the work, not a status. "Nothing" only when nothing was ever required.

**Acceptance criteria.** A checklist. A command and its expected exit code wherever one
exists.

**Context.** Carried, not linked. The agent may open any document, but everything it
needs to start should already be here, in this order, each block naming the document and
the date it was carried from:

- *What this is for*: the spec's own sentences about this behaviour, quoted.
- *The decisions that bind*: each **quoted with its id and date, never paraphrased**. The
  board stays the authority: on a conflict the slice is wrong, and the agent reports it.
- *The picture*: the fragment of the spec's or board's diagram this slice touches,
  inlined as mermaid and trimmed to that fragment, never the whole architecture.
- *The screen*, for work with a face: the mockup's relevant part rendered into markdown,
  the component and element names it offers (`aiview components`), its copy, and each
  state with what triggers it. The mockup file stays the authority for the look, and the
  design language names the tokens.
- *The interfaces* the plan designed for it, inlined, since the tests are written against
  them.
- *What exists already* that this work builds on.

Document names resolve through `aiview`.

**What is already known, so the slice does not rediscover it.** The environment facts a
first command trips on: versions, what must be running, which credentials and how they
expire, what is deployed right now and what that proves. Anything tried and abandoned,
with why.

**Not in this slice.** What a reader would reasonably assume is included and is not.
Only when there is such a thing.

**Watch out.** Only when the slice has a known trap.

</slice-template>

## Modules

**The interface is designed in the plan and implemented in the slice.** An **interface** is everything a caller must know to use the module correctly: the signature, the invariants, the ordering, the error modes, the required configuration.

- **Deep modules**: a small interface over much functionality. A module whose interface is as large as what it hides is folded into its caller or its callee instead of created.
- **The deletion test decides**: complexity that vanishes when the module is deleted was passing through; complexity that resurfaces across its callers earned the module.
- **Callers and tests cross the same seam**; wanting to test past the interface means the module is the wrong shape.
- **No seam without variation**: one adapter signals possibility, two signal necessity.
- **Inside a module**: accept dependencies rather than create them, return results rather than produce side effects, keep the surface small.
- **Every module a slice touches is a register row** with one of these states:

| State | Meaning | Tested |
|---|---|---|
| new | A new module; the slice states what it exposes and what it hides | At the interface, unit |
| deepened | Functionality added behind an unchanged interface | Interface tests extended |
| interface change | What it exposes changes; the slice lists the callers | At the interface, every caller re-run |
| wiring | Thin glue between modules: a route, a registration, a config line, a call added; no logic | Through the modules it connects, never on its own |
| ui | A screen or component changed | Behaviour tested, look reviewed (`👤 design review`) |
| schema | Columns or a migration, for this slice only | Through the module that owns the data |

## The register

**A table in the plan of the implementation decisions**: id (`ID4`), kind, decision, status (agreed, open, deferred), source, slice, rows ordered by slice.

- **Kinds**: module (with its state from the table above, and the interface for new and interface change), architecture, API contract, technical clarification from the person.
- **Sources**: `board D3`, `board Q7`, `plan Q2`, the code, the docs.
- **`execute-plan` adds rows** as the work decides things.

## Diagrams

**The `write-diagrams` skill (`../write-diagrams/SKILL.md` in this collection).**

- **The tracker first**, drawn to `../execute-plan/references/tracker.md`, read before drawing.
- **Then the boundary the implementation must hold**, usually the dependency graph with forbidden edges.
- **Inside a slice with an ordering and failure branches**, its sequence or state diagram.
- **`aiview mermaid-check <plan>` and `aiview tracker check <plan>` after every edit.**

## The document

- **`YYYY-MM-DD-<topic>.plan.md` beside the spec**, kind `plan`, the spec's tags, in the group `aiview` gives a plan (`../aiview/SKILL.md` in this collection): its own, shared with its slices.
- **Opening lines**: title, the spec's and the board's paths, the stories this increment delivers, `hardened: yes | no`.
- **Note the plan's path at the top of the spec and the board.**
- **With a roadmap** (`../roadmap/SKILL.md` in this collection), the plan carries the slot's slug as a tag, and a finished plan is one of the moments the roadmap is redrawn.

## Draft review, hardening, then the slice documents

1. **Draft the plan without its slice documents**: the tracker, the register, the diagrams.
2. **Review the draft with the person**, one question per message, with your recommendation: is the granularity right; does the dependency flow hold; should any slice split; are the `👤` marks complete. Redraw on their answers.
3. **Offer hardening**, one multiple-choice question: harden through an interview (recommended when a slice touches code nobody in the conversation has read, or when there are more than three slices), or skip. On yes, run the `interview` skill (`../interview/SKILL.md` in this collection) with the register as the tree, slice by slice: filled rows confirmed from the code, missing rows resolved with the person. A decision a slice needs that cannot be made before an earlier slice runs cuts that slice to "planned after slice N runs". Hardening fills the register and removes assumptions; it adds no detail. Write what it settles into the register and the tracker, and the exchange into an interview log at the end of the plan, in the board's log format (`brainstorm` skill), entries `Q1`, `Q2`.
4. **Write the slice documents**, from the register as review and hardening left it.
5. **Stop and ask the person to approve the plan**, reminding them in the same message that it carries the interfaces of the new and changed modules, worth a look before the run. Running it is `execute-plan`'s.

## Red flags

| Thought | Reality |
|---|---|
| "I'll plan the whole feature while I have the context" | Plan the increment. The next plan is written with this one's learning in hand, which you do not have yet. |
| "Schema first, then the API, then the screens" | Nothing is verifiable until the last slice. One story end to end, then the next. |
| "I'll write the slice documents now and harden after" | Hardening moves register rows, and every slice document quotes them word for word. Harden first and slice second, or rewrite every document that quoted a moved row. |
| "The hardening made the plan longer" | Then it added detail instead of removing assumptions. A slice that cannot be decided now becomes a line saying when it will be planned. |

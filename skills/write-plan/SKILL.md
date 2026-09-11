---
name: write-plan
description: Use when an approved spec exists and the implementation plan for its next increment has to be written, or an existing plan has to be redrawn after an increment landed. Produces the plan document whose diagram is the tracker execute-plan runs from, its register of decisions and the modules each slice touches. Not for designing the change (brainstorm), not for writing a slice's own document (write-slice) and not for carrying the plan out (execute-plan).
---

# Write a plan

**One spec, iterated; one plan per increment.** The plan takes the stories the spec has not delivered yet, stops where the next increment would begin, and is sized to what the person can approve in one reading.

## Input

- **The approved spec**, open in the viewer (`aiview` skill, `../aiview/SKILL.md` in this collection), and the previous plan's finished steps when this is not the first increment. The board is not opened: the spec is what the brainstorm extracted and tightened, and a decision the spec does not carry is a finding for the spec.
- **How the project tests**, read before drawing a slice: its scripts, its existing tests, its CI. A codebase with no tests yet gets the question in the draft review: at which level each layer is tested, and what a test may touch.

## Slices

- **Cut the spec into thin vertical slices**, each through every integration layer the change touches, schema to screen, each verifiable end to end when it lands. Never by layer.
- **A slice takes from each layer only what it needs**: the two columns, not the whole schema; the one endpoint, not the whole service; the one screen state.
- **Per slice**: the stories it serves (`US3`), what it delivers end to end, the slices that block it, the done-when as a test, and a mark when it needs a person: `👤 decision` (architecture, contract), `👤 design review` (a screen, a mockup), or none.
- **Size each slice to one fresh context window**; a slice is one agent's work. Order riskiest unknown first.
- **Slices that block nothing of each other's may fork**, on the terms `../execute-plan/references/tracker.md` sets. Propose the fork in one message, draw it on a yes.
- **Each slice merges to `main` on its own and leaves the deployed environment green**: complete, or inert where it is not yet. When a slice cannot be, the plan names what makes it inert (a value optional until the slice that supplies it, a route unmounted until its screen exists).
- **Every slice's done-when is a test seen failing before the work and passing after**; a slice with no such done-when is not a slice. A screen's behaviour is tested the same way; its look is the `👤 design review`. The plan draws no "write the test" step: that is `write-code`'s (`../write-code/SKILL.md` in this collection).

## The register

**A table in the plan of the implementation decisions**: id (`ID4`), kind, decision, status (agreed, open, deferred), source, slice, rows ordered by slice.

- **Kinds**: module (every module a slice touches, with its state as `write-slice` names them; the interface is the slice document's), architecture, API contract, technical clarification from the person.
- **Sources**: the spec by decision id (`D3`), `plan Q2`, the code, the docs.
- **`execute-plan` adds rows** as the work decides things.

## Diagrams

**The `write-diagrams` skill (`../write-diagrams/SKILL.md` in this collection).**

- **The tracker first**, drawn to `../execute-plan/references/tracker.md`, read before drawing.
- **Then the boundary the implementation must hold**, usually the dependency graph with forbidden edges.
- **Inside a slice with an ordering and failure branches**, its sequence or state diagram.
- **`aiview mermaid-check <plan>` and `aiview tracker check <plan>` after every edit.**

## The document

- **`YYYY-MM-DD-<topic>.plan.md` beside the spec**, kind `plan`, the spec's tags, in the group `aiview` gives a plan (`../aiview/SKILL.md` in this collection): its own, shared with its slices.
- **Opening lines**: title, the spec's path, the stories this increment delivers, `hardened: yes | no`.
- **Note the plan's path at the top of the spec.**
- **With a roadmap** (`../roadmap/SKILL.md` in this collection), the plan carries the slot's slug as a tag, and a finished plan is one of the moments the roadmap is redrawn.

## Draft review, hardening, approval, then the slice documents

1. **Draft the plan without its slice documents**: the tracker, the register, the diagrams.
2. **Review the draft with the person**, one question per message, with your recommendation: is the granularity right; does the dependency flow hold; should any slice split; are the `👤` marks complete. Redraw on their answers.
3. **Offer hardening**, one multiple-choice question: harden through an interview (recommended when a slice touches code nobody in the conversation has read, or when there are more than three slices), or skip. On yes, run the `interview` skill (`../interview/SKILL.md` in this collection) with the register as the tree, slice by slice: filled rows confirmed from the code, missing rows resolved with the person. A decision a slice needs that cannot be made before an earlier slice runs cuts that slice to "planned after slice N runs". Hardening fills the register and removes assumptions; it adds no detail. Write what it settles into the register and the tracker, and the exchange into an interview log at the end of the plan, in the board's log format (`brainstorm` skill), entries `Q1`, `Q2`.
4. **Stop and ask the person to approve the plan.**
5. **Then one slice document per slice with work left**, with `write-slice` (`../write-slice/SKILL.md` in this collection). A finished slice gets none.

## Red flags

| Thought | Reality |
|---|---|
| "I'll plan the whole feature while I have the context" | Plan the increment. The next plan is written with this one's learning in hand, which you do not have yet. |
| "Schema first, then the API, then the screens" | Nothing is verifiable until the last slice. One story end to end, then the next. |
| "The hardening made the plan longer" | Then it added detail instead of removing assumptions. A slice that cannot be decided now becomes a line saying when it will be planned. |

---
name: write-plan
description: Use when something non-trivial is to be built or reworked and its implementation plan has to be written, from an idea or from a board, or when a plan has to be redrawn after an increment landed. Produces, through an interview, the one plan document that holds the design, the decisions, the slices, the tracker execute-plan runs from and the orchestrator's mandate. Not for keeping an open discussion (brainstorm), not for a slice's own document (write-slice) and not for carrying the plan out (execute-plan).
---

# Write a plan

**One document holds the design and the plan.** What the interview settles is written
once, there, and the slices carry its sections word for word.

**No code in the repository for the thing being planned until the plan is approved.**

1. **Open `YYYY-MM-DD-<topic>.plan.md` before the first question**, through the `aiview` skill: kind `plan`, tags = project + topic, in the group aiview gives a plan, shared with its slices. With a roadmap, the slot's slug is a tag. Its sections are `references/skeleton.md`, read before writing the first one. A board on the topic is the starting point: its agreed decisions become rows and are not asked again.
2. **Run the `interview` skill** on the decisions table, and write each section as its decisions land. A request that is several independent systems is split first, one plan each. One plan per increment: it stops where the next increment would begin.
3. **Every major area is a deep module**, designed as the `deepen-module` skill says, in the plan's modules section. A module the interview cannot settle there gets its own `module` document, and the plan quotes its entry.
4. **When no row is open, ask once what else this should cover.**
5. **Cut the slices and draw the tracker**, to the `execute-plan` skill's `references/tracker.md`, read before drawing. `aiview mermaid-check <plan>` and `aiview tracker check <plan>` after every edit.
6. **Close the interview with the orchestrator's mandate**: the questions of the `execute-plan` skill's `references/mandate.md`, the answers in the plan's *Execution* section.
7. **Stop and ask the person to approve the plan.** Then one slice document per slice, with `write-slice`.

## Slices

- **Thin and vertical**, through every layer the change touches, each verifiable end to end when it lands. By layer only when one check holds every step, an interface that must not change held by the suite, and the plan says so.
- **Per slice**: what it delivers end to end, the slices that block it, its check as a command the orchestrator can run, the tests it owes, and a mark when it needs a person: `👤 decision`, `👤 design review`, or none.
- **The tests a slice owes are written at the end of the slice**, after its code is validated against the suite as it stands.
- **One slice is one agent's context window.** Riskiest unknown first.
- **Slices that block nothing of each other's may fork**, on the terms the `execute-plan` skill's `references/tracker.md` sets.
- **A slice that lands on `main` leaves it green**: complete, or inert where it is not yet, and the plan names what makes it inert.
- **A decision a slice needs that cannot be made before an earlier slice runs** cuts that slice to "planned after slice N runs".

## Red flags

| Thought | Reality |
|---|---|
| "I'll plan the whole feature while I have the context" | The next plan is written with this increment's learning in hand, which you do not have yet. |
| "Schema first, then the API, then the screens" | Nothing is verifiable until the last slice. |

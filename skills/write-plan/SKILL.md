---
name: write-plan
description: Use when something non-trivial is to be built or reworked and its implementation plan has to be written, from an idea or from a board, or when a plan has to be redrawn after an increment landed. Produces, through an interview, the one plan document that holds the design, the decisions, the slices, the tracker execute-plan runs from and the orchestrator's mandate. Not for keeping an open discussion (brainstorm), not for cutting the slices or writing their documents (write-slice) and not for carrying the plan out (execute-plan).
---

# Write a plan

**One document holds the design and the plan.** What the interview settles is written
once, there, and each slice carries its part of it verbatim, narrowed to its scope.

**No code in the repository for the thing being planned until the plan is approved.**

1. **Open `YYYY-MM-DD-<topic>.plan.md` before the first question**, through the `aiview` skill: kind `plan`, tags = project + topic, in the group aiview gives a plan, shared with its slices. With a roadmap, the slot's slug is a tag. Its two parts, Design and Execution, are `references/skeleton.md`, read before writing the first section. A board on the topic is the starting point: its agreed decisions become rows and are not asked again.
2. **Run the `interview` skill** on the decisions table, and write each section as its decisions land. A request that is several independent systems is split first, one plan each. One plan per increment: it stops where the next increment would begin.
3. **Every major area is a deep module**, designed as the `deepen-module` skill says, in the plan's modules section. A module the interview cannot settle there gets its own `module` document, and the plan quotes its entry.
4. **When no row is open, ask once what else this should cover.**
5. **Discuss and decide the testing strategy**: what is tested and at which seams. When the implementer writes the tests is the mandate's.
6. **Cut the slices** as the `write-slice` skill's `references/cutting.md` says, **and draw the tracker** to the `execute-plan` skill's `references/tracker.md`, from its `references/tracker-skeleton.md`, all read first. `aiview mermaid-check <plan>` and `aiview tracker check <plan>` after every edit.
7. **Close the interview with the orchestrator's mandate**: the questions of the `execute-plan` skill's `references/orchestrator-mandate.md`, the answers in the plan's *Mandate* section and in the one line under the tracker.
8. **Stop and ask the person to approve the plan.** Then one slice document per slice, with `write-slice`.

## Red flags

| Thought | Reality |
|---|---|
| "I'll plan the whole feature while I have the context" | The next plan is written with this increment's learning in hand, which you do not have yet. |

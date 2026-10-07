---
name: write-slice
description: Use when a plan's increment has to be cut into slices, or when an approved plan exists and one of its slices needs the document an agent will carry it out from, including a slice execute-plan draws mid-run. Produces the cut, or one slice's document with the design and modules it carries. Not for writing the plan (write-plan) and not for carrying a slice out (execute-slice).
---

# Write a slice

**Cutting a plan's increment into slices**: read `references/cutting.md`. The rest of this skill is one slice's document.

**One document per slice, the whole design one agent needs.** The mandate (when tests are written, the pull request, the boundaries) is not in it: it reaches the agent through the brief at dispatch (the `orchestrate-plan` skill).

## Before writing

- **The plan**, open through the `aiview` skill: the slice, its check, its `👤` mark, the decisions that name it. The mockup too, when the slice has a face.
- **A decision the plan does not carry is a finding for the plan**, never one taken here.

## Modules

**The interface is designed here and implemented by the slice's agent.** An **interface** is everything a caller must know: signatures, invariants, ordering, error modes, required configuration.

- **Signatures as code, bodies never**: a block in the project's language, the exports with their types. Before the first block, read `references/examples.md`: one block per state.
- **An agreed `module` document (`deepen-module`) is quoted word for word.**
- **Callers bound by different rules get an entry each**, named for their case, the stricter case's rules in its signature, over a core they cannot import.
- **One block per module the slice touches, under the plan's name for it.** A module the slice only calls gets no block. A module the plan does not name is a finding for the plan, never a block invented here.

| State | What the block carries |
|---|---|
| new | The whole interface as code, what it hides, the dependencies it accepts |
| deepened | The interface, marked unchanged; one sentence on what is added behind it. A new export is an interface change |
| interface change | The signature before and after, and every caller with what changes for it |
| wiring | The one call added, from which module to which export; no logic |
| ui | The component's inputs, outputs, states and their triggers, and the export it calls |
| schema | The columns or the migration, the module that owns them, generated or written |

## Tests

**Only when the mandate's `tests` is not `none`.** One line per seam: the module whose interface the tests cross, and the cases by name, each traced to an acceptance criterion. Tests read the answer through the interface, never through a table, a private function or a spy. For the test slice of `tests: at the plan end`, the cases the other slices left owed.

## The document

- **Named `<plan-stem>-<node>.slice.md`**, kind `slice`, the plan's tags and group, opened through `aiview` the moment it exists. The plan names it under the slice's heading.
- **Carry the part that binds.** The conventions file is never copied.
- **No source file paths in the instructions.** A module keeps the plan's name.

<slice-template>

# <node id>: <title>

> **Slice document** of `<plan file>`. Carry it out with the `execute-slice` skill.

**What this delivers.** The end-to-end behaviour, from the user's side.

**Blocked by.** The slices this one depends on, done or not. "Nothing" only when nothing
was ever required.

**Acceptance criteria.** A checklist, the slice's `👤` mark among them. A command and its
expected exit code wherever one exists.

**Context.** Carried, not linked, each block naming its document and date:

- *The design*: the plan's **Design** part narrowed to this slice, verbatim, diagrams
  narrowed the same way. On a conflict the slice is wrong, and the agent reports it.
- *The flow*: the slice's own sequence, every branch, as mermaid.
- *The screen*, for work with a face: the mockup's component names (`aiview components`)
  and its copy. Its copy, states and routes are decisions, and a departure is a finding.
- *The modules*, one block each.
- *The tests*, when the mandate has them.
- *The gaps*: the modules the plan lacks and the decisions this document could not take,
  numbered, for the person.

**What is already known.** The environment facts a first command trips on: versions, what
must be running, which credentials and how they expire. Anything tried and abandoned, with why.

**Not in this slice.** What a reader would assume is included and is not.

</slice-template>

**Hand it over** by giving the person the URL to read.

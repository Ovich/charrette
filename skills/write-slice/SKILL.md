---
name: write-slice
description: Use when a plan's increment has to be cut into slices, or when an approved plan exists and one of its slices needs the document an agent will carry it out from, including a slice execute-plan draws mid-run. Produces the cut, or one slice's document with the modules table its tests are written against. Not for writing the plan (write-plan) and not for carrying a slice out (execute-slice).
---

# Write a slice

**Cutting a plan's increment into slices**: read `references/cutting.md`. The rest of this skill is one slice's document.

**When the plan's mandate says `tests: at the plan end`**, read `references/tests-at-the-plan-end.md` before writing any slice's document: what every slice carries in place of its tests, and the test slice's own document.

**One document per slice, the whole context one agent needs, and the only place instructions live.**

## Before writing

- **The approved plan**, open through the `aiview` skill: the slice, its check, its `👤` mark, the decisions that name it. The mockup too, when the slice has a face.
- **The plan is the approved statement of every decision.** A decision it does not carry is a finding for the plan.
- **After the plan is approved**: the interview moves decisions, and the slice carries them verbatim.

## Modules

**The interface is designed here and implemented by the slice's agent.** An **interface** is everything a caller must know: signatures, invariants, ordering, error modes, required configuration. A **seam** is where an interface lives, and the tests cross it there.

- **Signatures as code, bodies never**: a block in the project's language, the exports with their types. Before the first block, read `references/examples.md`: one block per state and per kind of seam.
- **An agreed `module` document (`deepen-module`) is quoted word for word.**
- **A test's fixture is a module too**, in the tests' support folder behind one small interface.
- **One block per module the slice touches, test support included, each from the plan under the plan's name for it.** A module the slice only calls gets no block. A module the plan does not name, or names under a state that cannot be its, is a finding for the plan, never a block invented here; the document lists the gap.
- **The decisions table is the authority** when the plan carries one module under two states.

| State | What the block carries | Tested |
|---|---|---|
| new | The whole interface as code, what it hides, the dependencies it accepts | At its seam, every case named |
| deepened | The interface, marked unchanged; one sentence on what is added behind it. A new export is an interface change | The cases at the same seam, extended |
| interface change | The signature before and after, and every caller with what changes for it | At its seam, and every caller re-run |
| wiring | The one call added, from which module to which export; no logic | Through the seams of the modules it joins |
| ui | The component's inputs, outputs, states and their triggers, and the export it calls | Behaviour by state, look reviewed (`👤 design review`) |
| schema | The columns or the migration, the module that owns them, generated or written | Through its owner's seam |

## Seams under test

**Agreed with the person before the work starts; when the tests are written is the mandate's, or this slice's own `tests:`.** One block per seam, the fewest seams that cover the criteria, existing seams before new ones, the highest seam that still names the behaviour.

- **A seam block carries**: the module whose interface it is, what sits behind it and how the tests cross it (table below), the cases by name, each traced to an acceptance criterion or a branch of the flow, and what is not tested past it.
- **One glance per seam**: the block fits a screen, the signature block stays under ten lines, the cases are a list of names, and with more than two seams the flow marks where each sits.
- **A branch with no case, or a case on no branch, is a gap in the design.**
- **Tests read the answer through the interface**, never through a table the library owns, a private function or a spy on a collaborator. An answer the interface cannot give back is a finding: the interface is missing something.
- **One adapter is a hypothetical seam, two are a real one.**

| Behind the seam | How the tests cross it |
|---|---|
| in-process: computation, memory, no I/O | directly |
| a dependency with a local stand-in, a database in-process, a filesystem in memory | the stand-in runs in the suite; the seam stays inside the module |
| our own service across a network | a port at the seam, an in-memory adapter for the tests, the transport adapter for production |
| a third party | a port at the seam and a mock adapter for the tests, one function per operation so a stand-in answers one shape |

## The document

- **Named `<plan-stem>-<node>.slice.md`**, kind `slice`, the plan's tags and group, opened through `aiview` the moment it exists. The plan names it under the slice's heading.
- **Carry the part that binds.** The conventions file is never copied.
- **No source file paths in the instructions.** A module keeps the plan's name.
- **The branch and the pull request are the brief's.**

<slice-template>

# <node id>: <title>

> **Slice document** of `<plan file>`. Carry it out with the `execute-slice` skill:
> check the blockers first, and stop if any is unmet.
> **tests:** <only where this slice departs from the mandate's, in the mandate's words>

**What this delivers.** The end-to-end behaviour, from the user's side.

**Blocked by.** The slices this one depends on, done or not. "Nothing" only when nothing
was ever required.

**Acceptance criteria.** A checklist, the slice's `👤` mark among them. A command and its
expected exit code wherever one exists.

**Context.** Carried, not linked, in this order, each block naming its document and date:

- *The design*: the structure of the plan's **Design** part, each section narrowed to the
  scope of this slice, verbatim, and each diagram narrowed the same way. On a conflict the slice is wrong,
  and the agent reports it.
- *The flow*: the slice's own sequence, every branch, as mermaid, the seams marked on it.
- *The screen*, for work with a face: the mockup's component names (`aiview components`)
  and its copy. Its copy, states and routes are decisions, and a departure is a finding.
- *The seams under test*, one block each.
- *The modules*, one block each, **never "none new"**: deepened and wiring are states too.
- *The gaps and the findings*: the modules the plan lacks, each with what waits on it,
  then the decisions this document could not take, numbered, for the person.
- *What exists already* that this work builds on.

**What is already known, so the slice does not rediscover it.** The command that runs one
test file, and the one that runs one end-to-end spec. The environment facts a
first command trips on: versions, what must be running, which credentials and how they
expire, what is deployed and what that proves. Anything tried and abandoned, with why.

**Not in this slice.** What a reader would assume is included and is not.

**Watch out.** Only when the slice has a known trap.

</slice-template>

## Handing it over

**Stop and ask the person to agree the seams under test first**, then to read the rest.

---
name: write-slice
description: Use when an approved plan exists and one of its slices needs the document an agent will carry it out from, including a slice execute-plan draws mid-run. Takes one slice of the plan; produces its document, with the modules table its tests are written against. Not for cutting the increment into slices (write-plan) and not for carrying a slice out (execute-slice).
---

# Write a slice

**One document per slice, the whole context one agent needs, and the only place instructions live.** The plan's tracker records what happened.

## Before writing

- **The approved plan**, open in the viewer (`aiview` skill, `../aiview/SKILL.md` in this collection): the node, its done-when, its `👤` mark, and the register rows that name this slice.
- **The spec, and the mockup when the slice has a face**, for the sentences the document quotes. The board is never opened: the spec is the approved statement of every decision, and a decision the spec does not carry is a finding for the spec.
- **After the plan is approved**, never before: review and hardening move register rows, and every slice document quotes them word for word.

## Modules

**The interface is designed here and implemented by the slice's agent.** An **interface** is everything a caller must know to use the module correctly: the signatures, the invariants, the ordering, the error modes, the required configuration. A **seam** is where an interface lives, and the tests cross it there.

- **Signatures are written as code, bodies never.** A block in the project's language, the exports with their types, shallow on purpose: it is the contract, not a start on the implementation. Before the first block, read `references/examples.md`: one block per state and per kind of seam.
- **Deep modules**: a small interface over much functionality. A module whose interface is as large as what it hides is folded into its caller or its callee instead of created.
- **The deletion test decides**: complexity that vanishes when the module is deleted was passing through; complexity that resurfaces across its callers earned the module.
- **Inside a module**: accept dependencies rather than create them, return results rather than produce side effects, keep the surface small.
- **A test's fixture is a module too**: it lives in the tests' support folder behind one small interface, and the test file reads as its claims.
- **One block per module the slice touches, test support included, and every one comes from the plan's register**, under the register's own name for it. A module the slice only calls gets no block: the call sits on the caller's line. A module the register does not name, or names under a state that cannot be its, is reported to the person as a finding for the plan, never a block invented here; until the plan fills it, the document lists the gap, so the agent's stop is expected.
- **The register is the authority** when the plan carries the same module twice with two states.

| State | What the block carries | Tested |
|---|---|---|
| new | The whole interface as code, what it hides, the dependencies it accepts | At its seam, every case named |
| deepened | The interface, marked unchanged; one sentence on what is added behind it. A new export is not deepening, it is an interface change | The cases at the same seam, extended |
| interface change | The signature before and after, and every caller with what changes for it | At its seam, and every caller re-run |
| wiring | The one call added, from which module to which export; no logic | Through the seams of the modules it joins, never on its own |
| ui | The component's inputs, outputs, states and their triggers, and the export it calls | Behaviour by state, look reviewed (`👤 design review`) |
| schema | The columns or the migration, the module that owns them, generated or written | Through its owner's seam |

## Seams under test

**Written down and agreed with the person before any test exists**, one block per seam, the fewest seams that cover the criteria, existing seams before new ones, the highest seam that still names the behaviour.

- **A seam block carries**: the module whose interface it is; what sits behind it and how the tests cross it, from the table below; the cases, named, each traced to an acceptance criterion or to a branch of the flow; and what is not tested past it.
- **Written for the person who validates it, at one glance per seam**: the block fits a screen, the signature block stays under ten lines, the cases are a list of names, and with more than two seams the flow marks where each sits.
- **A branch with no case, or a case on no branch, is a gap in the design**, found here and not in the run.
- **Tests read the answer through the interface, never through a side channel.** A table the library owns, a private function, a spy on a collaborator: each is a test that breaks on a refactor that changed no behaviour.
- **One adapter is a hypothetical seam, two are a real one.** A port for tests alone is indirection; the second adapter is production.

| Behind the seam | How the tests cross it |
|---|---|
| in-process: computation, memory, no I/O | directly |
| a dependency with a local stand-in, a database in-process, a filesystem in memory | the stand-in runs in the suite; the seam stays inside the module |
| our own service across a network | a port at the seam, an in-memory adapter for the tests, the transport adapter for production |
| a third party | a port at the seam and a mock adapter for the tests, one function per operation so a stand-in answers one shape |

## The document

- **Named `<plan-stem>-<node>.slice.md`**, kind `slice`, the plan's tags, the plan's group; opened via `aiview` the moment it exists. Under the slice's heading, the plan names its document.
- **Carry the part that binds, trimmed to it.** The conventions file is never copied.
- **No source file paths in the instructions.** Document names, commands and interfaces are not paths; a module keeps the register's name.
- **The branch and the pull request are the brief's, not the document's.**

<slice-template>

# <node id>: <title>

> **Slice document** of `<plan file>`. Carry it out with the `execute-slice` skill:
> check the blockers first, and stop if any is unmet.

**What this delivers.** The end-to-end behaviour, from the user's side.

**Blocked by.** The slices this one depends on, named whether or not they are done. It
is the shape of the work, not a status. "Nothing" only when nothing was ever required.

**Acceptance criteria.** A checklist, the slice's `👤` mark among them. A command and its
expected exit code wherever one exists.

**Context.** Carried, not linked. The agent may open any document, but everything it
needs to start should already be here, in this order, each block naming the document and
the date at its top:

- *The decisions that bind*, every one a criterion depends on: the spec's own sentences,
  **quoted, never paraphrased**, with the decision id where the sentence carries one and
  the spec's heading where it does not. The spec stays the
  authority: on a conflict the slice is wrong, and the agent reports it.
- *The flow*: the slice's own sequence, with every branch, as mermaid, the seams marked
  on it. The cases below trace to its branches; the whole architecture never appears.
- *The screen*, for work with a face: the mockup's component names (`aiview components`)
  and its copy. The mockup is high fidelity: its copy, its states and its routes are
  decisions, not suggestions, and a departure from it is a finding, never a choice made
  here. The mockup file stays the authority for the look, and the design language names
  the tokens.
- *The seams under test*, one block each, as *Seams under test* above says.
- *The modules*, one block each, **never "none new"**: the module as the register names
  it, its state, then what the state's row in *Modules* above requires.
- *The gaps and the findings*: the modules the register lacks, each with what waits on
  it, then the decisions this document could not take, numbered, for the person.
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

## Handing it over

**Stop and ask the person to agree the seams under test first**, then to read the rest. A test at a seam the person did not agree is written by nobody.

## Red flags

| Thought | Reality |
|---|---|
| "The interfaces are obvious from the code, I'll write none new" | A slice that touches no module has no code. Deepened and wiring are states too. |
| "I'll check the row landed in the table" | That is a side channel. The interface that wrote it can read it back; if it cannot, the interface is missing something. |
| "I'll sketch the function body so the agent knows what I mean" | The body is the agent's. A signature and its error modes say what you mean. |

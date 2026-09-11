---
name: write-slice
description: Use when an approved plan exists and one of its slices needs the document an agent will carry it out from, including a slice execute-plan draws mid-run. Takes one slice of the plan; produces its document, with the modules table its tests are written against. Not for cutting the increment into slices (write-plan) and not for carrying a slice out (execute-slice).
---

# Write a slice

**One document per slice, the whole context one agent needs, and the only place instructions live.** The plan's tracker records what happened.

## Before writing

- **The approved plan**, open in the viewer (`aiview` skill, `../aiview/SKILL.md` in this collection): the node, its done-when, its `👤` mark, and the register rows that name this slice.
- **The spec, the board, and the mockup when the slice has a face**, for the sentences the document quotes.
- **After the draft review and the hardening**, never before: hardening moves register rows, and every slice document quotes them word for word.

## Modules

**The interface is designed here and implemented by the slice's agent.** An **interface** is everything a caller must know to use the module correctly: the signature, the invariants, the ordering, the error modes, the required configuration.

- **Deep modules**: a small interface over much functionality. A module whose interface is as large as what it hides is folded into its caller or its callee instead of created.
- **The deletion test decides**: complexity that vanishes when the module is deleted was passing through; complexity that resurfaces across its callers earned the module.
- **Callers and tests cross the same seam**; wanting to test past the interface means the module is the wrong shape.
- **No seam without variation**: one adapter signals possibility, two signal necessity.
- **Inside a module**: accept dependencies rather than create them, return results rather than produce side effects, keep the surface small.
- **A test's fixture is a module too**: it lives in the tests' support folder behind one small interface, and the test file reads as its claims.
- **One row per module the slice touches, test support included, and every row comes from the plan's register.** A module the register does not name is reported to the person as a finding for the plan, never a row invented here.

| State | Meaning | Tested |
|---|---|---|
| new | A new module; the row states what it exposes and what it hides | At the interface, unit |
| deepened | Functionality added behind an unchanged interface | Interface tests extended |
| interface change | What it exposes changes; the row lists the callers | At the interface, every caller re-run |
| wiring | Thin glue between modules: a route, a registration, a config line, a call added; no logic | Through the modules it connects, never on its own |
| ui | A screen or component changed | Behaviour tested, look reviewed (`👤 design review`) |
| schema | Columns or a migration, for this slice only | Through the module that owns the data |

## The document

- **Named `<plan-stem>-<node>.slice.md`**, kind `slice`, the plan's tags, the plan's group; opened via `aiview` the moment it exists. Under the slice's heading, the plan names its document.
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
- *The modules*, **a table, never "none new"**: module · state · interface, "unchanged"
  for deepened and wiring · how it is tested.
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

**Stop and ask the person to read it, the modules table first.**

## Red flags

| Thought | Reality |
|---|---|
| "The interfaces are obvious from the code, I'll write none new" | A slice that touches no module has no code. Deepened and wiring are states too. |

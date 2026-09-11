---
name: execute-slice
description: Use when handed one slice document to carry out, as the agent doing the work rather than the one holding the plan. Does the work from that document alone and returns the evidence and the branch. Not for writing the slice document (write-slice) and not for running a plan (execute-plan).
---

# Execute a slice

## When to stop

Each is a report, never an improvisation.

<stops>

- **The acceptance criteria already pass.** Say so and end.
- **The document has no seams under test or no module blocks**, or the work touches a module it does not name, a test fixture included. Report it; a module is designed in the plan, never in the slice.
- **A test wants to cross past a seam the document names**, a table read, a private call, a spy. Report it; the module is the wrong shape, and that is the plan's to fix.
- **The document names something that does not exist**, a module, a command, a fact the work depends on. Report it; never guess around it.
- **The work reveals a dependency the document did not name.** Say what it is and where it surfaced.

</stops>

## The work

- **Before the first edit, invoke `write-code`** (`../write-code/SKILL.md` in this collection) and work under it: test first, two commits, no test weakened, the runs reported.
- **Stay inside the acceptance criteria**; anything the document did not ask for is out of scope.
- **Open the draft pull request the brief names on the first commit**, which is the first self-contained change, a dependency install included. Commit small, push as you go, keep its checklist current.
- **Tick each criterion in the slice document as its evidence lands.** The document is yours to edit; the plan is not.

## The return

- **The branch, its base, and the commits on it**, pushed or not.
- **What changed and where.**
- **The failing run before and the passing run after**, verbatim.
- **Each criterion with its evidence.**
- **Anything the document did not predict**, above all a blocker it failed to name.

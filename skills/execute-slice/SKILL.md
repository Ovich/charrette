---
name: execute-slice
description: Use when handed one slice document to carry out, as the agent doing the work rather than the one holding the plan. Does the work from that document alone and returns the evidence and the branch. Not for writing the slice document (write-slice) and not for running a plan (execute-plan).
---

# Execute a slice

## When to stop

Each is a report, never an improvisation.

<stops>

- **The acceptance criteria already pass.** Say so and end.
- **The document has no design carried from the plan, no seams under test or no module blocks**, or the work touches a module it does not name, a test fixture included. Report it: modules are designed in the plan.
- **A test wants to cross past a seam the document names**, a table read, a private call, a spy. Report it.
- **The document names something that does not exist**, a module, a command, a fact the work depends on. Report it.
- **The work reveals a dependency the document did not name.** Say what it is and where it surfaced.

</stops>

## The work

- **The brief names when the tests are written**, and the slice document's own `tests:` wins over it; none named is *at the slice end*. Before the first line of code, read the one reference for it and no other: `references/tests-at-the-plan-end.md`, `references/tests-at-the-slice-end.md`, `references/tests-commit-only-at-green.md` or `references/tests-commit-per-phase.md`. In all four the tests are the ones the documents name, at the seams they name.
- **The slice's check runs once, before the return, and again only after a fix.** What runs while working is the rhythm's.
- **Never weaken a test to make a suite green**: not loosened, not deleted, not skipped.
- **Stay inside the acceptance criteria**; anything the document did not ask for is out of scope.
- **Open the draft pull request the brief names on the first commit**, which is the first self-contained change, a dependency install included; push to it when the brief says it is open. Commit small, push as you go, keep its checklist current.
- **Tick each criterion in the slice document as its evidence lands.** The document is yours to edit; the plan is not.

## The return

- **The branch, its base, and the commits on it**, pushed or not.
- **What changed and where.**
- **The check's last run**, verbatim.
- **Each criterion with its evidence.**
- **The rhythm followed**: each test's failure as seen, by case, or, at the plan end, the proof run in their place and the tests this slice broke, by name.
- **Anything the document did not predict**, above all a blocker it failed to name.

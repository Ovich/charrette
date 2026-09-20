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

- **The brief names when the tests are written**, and the slice document's own `tests:` wins over it. No rhythm named is *at the slice end*. In all three the tests are the ones the document names, at the seams it names, and the slice lands with the check at 0.
  - ***at the slice end***: write the production code. Validate it with the project's check and the suite as it stands, adjusted only where the slice changes a shape. Then write the tests, and see each one that guards new behaviour fail once: written after the code, it has never been red.
  - ***commit only at green***: one named case at a time: the test, its failure for the reason the case names, the code that passes it. Commit only with the suite green. An attempt that will not go green is dropped back to the last commit, never patched forward. No refactor phase: one tidy inside the module before the last commit.
  - ***commit per phase (red/green/refactor)***: the same cycle with a commit at each phase, the failing one's message opening `[RED]`. A `[RED]` commit is pushed only with the green that follows it: alone on the branch it fails the pull request's check.
- **Never weaken a test to make a suite green**: not loosened, not deleted, not skipped.
- **Stay inside the acceptance criteria**; anything the document did not ask for is out of scope.
- **Open the draft pull request the brief names on the first commit**, which is the first self-contained change, a dependency install included. Commit small, push as you go, keep its checklist current.
- **Tick each criterion in the slice document as its evidence lands.** The document is yours to edit; the plan is not.

## The return

- **The branch, its base, and the commits on it**, pushed or not.
- **What changed and where.**
- **The check's last run**, verbatim.
- **Each criterion with its evidence.**
- **The rhythm followed, and each test's failure as seen**, by case.
- **Anything the document did not predict**, above all a blocker it failed to name.

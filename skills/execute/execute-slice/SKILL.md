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

- **The brief's `tests` line says when the tests are written, what runs while working, and what runs at the end.** It is the plan's mandate and it overrides any habit, this skill's included. The slice document names the seams and the cases; it does not decide when they are written. A brief without a `tests` line, and a document with no *Tests* section either: the code first, then the tests the document names, each test file run alone, the slice's check once at the end, no test weakened.
- **A proof is not a test.** Where the brief says to write none, whatever drives the proof — a script, a browser driver, a config — is scratch: it lives outside the repository and never lands in a test directory or under a name the suite collects.
- **Stay inside the acceptance criteria**; anything the document did not ask for is out of scope.
- **Open the draft pull request the brief names on the first commit**, which is the first self-contained change, a dependency install included; push to it when the brief says it is open. Commit small, push as you go, keep its checklist current.
- **Tick each criterion in the slice document as its evidence lands.** The document is yours to edit; the plan is not.

## The return

- **The branch, its base, and the commits on it**, pushed or not.
- **What changed and where.**
- **The check's last run**, verbatim.
- **Each criterion with its evidence.**
- **What the brief's `tests` line asked for**: each test's failure as seen, by case, or the proof's output and the tests this slice broke, by name.
- **Anything the document did not predict**, above all a blocker it failed to name.

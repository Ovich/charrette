---
name: execute-slice
description: Use when handed one slice document to carry out, as the agent doing the work rather than the one holding the plan. Does the work from that document alone and returns the evidence and the branch. Not for writing slices (write-plan) and not for running a plan (execute-plan).
---

# Execute a slice

## When to stop

Three things end the slice before it is finished. Each is a report, not an improvisation.

<stops>

- **The acceptance criteria already pass.** Say so and end.
- **The document names something that does not exist** — a module, a command, a fact the
  work depends on. A document that cannot be followed is a document to fix, not to guess
  around.
- **The work reveals a dependency the document did not name.** Say what it is and where
  it surfaced. This is the finding the orchestrator most needs, and it never appears in a
  plan: it appears in the doing.

</stops>

## The work

Follow `write-code` (`../write-code/SKILL.md` in this collection). Stay inside the
acceptance criteria: anything the document did not ask for is out of scope, and anything
it asked for that proves impossible is a stop with the reason, not an improvisation.

Tick each criterion in the slice document as its evidence lands. The document is yours to
edit. The plan is not.

## The return

The branch, its base, and the commits on it, pushed or not. What changed and where. The
failing run before and the passing run after, verbatim. Each criterion with its evidence.
Anything the document did not predict, above all a blocker it failed to name.

---
name: execute-slice
description: Use when handed one slice document to carry out, as the agent doing the work rather than the one holding the plan. Checks the slice may start, does it, and returns the evidence and the branch. Not for writing slices (write-plan) and not for running a plan (execute-plan).
---

# Execute a slice

One slice, one agent, one return. The slice document is the context. Of the plan, read
only the tracker, and only for the gate below.

Names of documents in the slice resolve through `aiview` (`../aiview/SKILL.md` in this
collection). A name is not a path: the data home differs per machine.

## The gate

**Blocked by names the dependency whether or not it is met.** Check each named slice
against its tracker glyph.

<gate>

- Every blocker done: proceed.
- Any blocker not done: stop. Say which, and end. Do not start the parts that look
  independent.
- Cannot tell: stop. An unverifiable dependency is an unmet one.
- The acceptance criteria already pass: stop. Say so.

</gate>

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

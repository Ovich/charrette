# Orchestrating in swarm mode

Read when the mandate says `mode: swarm`, with the `swarm` skill's orchestrator side, which owns
everything said on the board. This file says what changes in this skill's own duties. The
phases, seats and roles are the plan's *Mandate*; the cut is the `write-plan` skill's
`references/swarm.md`.

## The run

- **One board run for the plan**, opened before the first phase with the first phase's slices
  as its rows; a later phase's slices are added at its open (`slice add`). A row is a slice,
  `S<phase><seat>`, as the tracker numbers it; its `role` names the seat and its role in the phase, `seat2 · builder`.
- **Leave the plan's branch checked out nowhere** while the run is open (detach the main
  checkout): a seat fast-forwards it from its own worktree, and git refuses to move a branch
  checked out elsewhere. Re-run each check in a detached worktree of its own.

## A phase

1. **Its slices are cut**: the first phase's with the plan; a later one's now, with the
   `write-slice` skill's `references/swarm.md`, from what the phases before taught. The tracker's
   placeholder step becomes the slices.
2. **Open it**: `slice add` each slice, then the `swarm` skill's `phase <name> "<text>"`, the
   text naming every seat's role in it.
3. **Dispatch every seat of the phase at once**, one fresh subagent each, each in its own git
   worktree (`isolation: "worktree"`), as the `orchestrate` skill says. The brief carries the
   board line, the slice id, the seat and its role (`references/brief.md`). A seat with no slice
   in this phase is not dispatched; a special seat's phase dispatches it alone.
4. **Watch the board**: it replaces the periodic check. The digest (the `orchestrate` skill's
   `scripts/watch-agents.mjs`) remains for a seat the board shows stale. A drift is answered on
   the board, by the interrupt the `swarm` skill's orchestrator side describes.
5. **A return**: the seat merged its own branch under the board's lock; no merge subagent.
   Re-run the slice's check on the branch it merged into, tick, mark the slice done on the
   board, remove its worktree from the main checkout once the tick stands.
6. **The phase closes** when every slice of it is ticked and the full check is green on the
   merged branch: the board's `all-done`, then that check. Only then the next phase is cut and
   opened. A seat that stopped on a finding ended on the board: fix the slice document and
   dispatch a fresh subagent into the same slice, or pause when the finding changes the phase.

## Agreements

**Two seats' agreements are theirs.** One that changes a decision the plan took becomes a row
in the plan's decisions, as the `execute-plan` skill says for any change.

## Every subagent joins the board

A slice, a fix drawn from a verification, a slice added mid-phase: its brief carries the board
line and a slice id on the run (`slice <id> --run <run> --state running` first); a brief without
one is a classic dispatch and is not sent.

## The close

**Close the run on the board once the last phase closes**, before the plan's close. A slice the
person does (a walk, a trial) is not on the board's work: it stays open in the plan's tracker and
never holds the run open. A run left open stays an active tab.

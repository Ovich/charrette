# Orchestrating in swarm mode

Read when the mandate says `mode: swarm`, with the `swarm` skill's orchestrator side, which owns
everything said on the board. This file says what changes in this skill's own duties.

## Dispatch

- **Every slice document exists before the run**; a missing one is written first (`write-slice`).
- **Open the run on the board before the first dispatch**, every slice and its blockers in it.
- **Every slice whose blockers are done is dispatched at once**, no cap, one subagent each, each in
  its own git worktree (`isolation: "worktree"`). A slice whose blockers land later is dispatched
  then, to a fresh subagent. How the calls are sent is the `orchestrate` skill's.
- **The brief carries the board line and the swarm pull request line** (`references/brief.md`).
  The subagent definition is the same as in classic mode: the board line tells it to load the
  `swarm` skill, runner side.
- **Every subagent a swarm run sends joins its board**: a slice, a fix drawn from a verification, a
  slice added mid-run. Its brief carries the board line and a slice id on the run (`slice <id> --run
  <run> --state running` first); a brief without one is a classic dispatch and is not sent.

## Checking the run

- **The board replaces the periodic check**: what each runner does, says and holds is there.
  The digest (the `orchestrate` skill's `scripts/watch-agents.mjs`) remains for a runner the board shows stale.
- **A runner's drift is answered on the board**, by the interrupt the `swarm` skill's orchestrator
  side describes, never by a private message alone.
- **Two runners' agreements are theirs.** One that changes a decision the plan took becomes a row
  in the plan's decisions, as the `execute-plan` skill says for any change.

## A return

- **The runner merged its own branch**, under the board's lock; no merge subagent. Re-run the
  slice's check on the branch it merged into, then tick, then mark the slice done on the board
  and dispatch what it unblocked.
- **A runner that stopped on a finding ended on the board.** Fix the plan or the slice document,
  then dispatch the slice to a fresh runner.
- **Remove its worktree** from the main checkout once the tick stands, as in classic mode.
- **Leave the plan's branch checked out nowhere** while the run is open (detach the main checkout): a runner fast-forwards it from its own worktree, and git refuses to move a branch checked out elsewhere. Re-run each check in a detached worktree of its own.

## Phases

**A plan may run in phases**, as a swarmstorm does: the plan's *Mandate* names them, each with
what it asks of the runners (build, then review each other's merge, then verify), and the plan's
slices are cut for them. Open each with the `swarm` skill's `phase`, its text saying every
runner's part; a runner runs `done <phase>` when its part is in, and the next phase opens on
`all-done`. A plan whose *Mandate* names no phases runs without: slices start as their blockers
are done.

## The close

**Close the run on the board once every slice is done**, before the plan's close.

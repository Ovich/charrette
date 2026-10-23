---
name: orchestrate-plan
description: "Use whenever execute-plan runs, as the plan's orchestrator: settling the mandate, running the plan phase by phase on the swarm board, writing and dispatching each phase's slices to seats, watching the board, verifying returns, and handling the branch and pull request. Not for keeping the tracker or deciding when to pause (execute-plan), and not for doing a slice's work (execute-slice)."
---

# Orchestrate a plan

**Load the `orchestrate` skill and the `swarm` skill's orchestrator side with this one.** The first holds the charter protocol, dispatch, briefs and findings; the second everything said on the board, and replaces the `orchestrate` skill's *Watching*. Here the charter is the plan's *Mandate*; a member is a seat's subagent for one slice. The phases, seats and roles are the plan's; the cut is the `write-plan` skill's `references/phases.md`.

## The mandate

Read the plan's *Mandate* section. Ask what it leaves open before the first phase, with the questions of `references/mandate.md`, and write the answers there and in the line under the tracker.

## The run

- **Every phase runs on the board, from the first to the close, whatever its width.** The board is the run's record, the person's view and the next phase's memory. Running a phase off it, or merging a seat's work yourself, changes the mandate, which is the person's.
- **One board run for the plan**, opened before the first phase with its slices as rows; a later phase's slices are added at its open (`slice add`). A row is a slice, `S<phase><seat>`; its `role` names the seat and its role, `seat2 · builder`.
- **Leave the plan's branch checked out nowhere** while the run is open (detach the main checkout): a seat fast-forwards it from its worktree. Re-run each check in a detached worktree of your own.
- **Every subagent joins the board**: a slice, a fix, a slice added mid-phase; its brief carries the board line and a slice id on the run (`slice <id> --run <run> --state running` first). A brief without one is not sent.

## A phase

1. **Write its slices now**, one per seat, with the `write-slice` skill, from the phase's goal, every seat's role and area, and what the run taught so far. The tracker's placeholder becomes the slices.
2. **Open it**: `slice add` each slice, then `phase <name> "<text>"`, the text naming every seat's role in it.
3. **Dispatch every seat of the phase at once**, one fresh subagent each, in its own worktree, with the brief of `references/brief.md`, read before the first dispatch. A seat with no slice in this phase is not dispatched.
4. **Watch the board**: it replaces the periodic check and the digest. Each seat's state, and the `stalled`, `gone`, `idle` and `liveness` events, are read and answered as the `swarm` skill's orchestrator side says; a drift is answered on the board, by its interrupt.
5. **A return**: the seat merged its own branch under the board's lock. Re-run the slice's check on the merged branch, and what the testing prompt asked for; tick, mark the slice done on the board, remove its worktree once the tick stands, and check the path is gone.
6. **The phase closes** when every slice is ticked and the full check is green on the merged branch: the board's `all-done`, then that check. Only then is the next phase cut. A seat that stopped on a finding: fix the slice document and dispatch a fresh subagent into the same slice, or pause when the finding changes the phase.

**Two seats' agreements are theirs.** One that changes a decision the plan took becomes a row in the plan's decisions, as the `execute-plan` skill says.

## The validator

**When the mandate's `verify:` is on**, it is dispatched once, at the run's open, with the first phase's seats: one board row, `validator`, its role from the *Mandate* verbatim, in a detached worktree; it merges nothing and lies dormant. A building phase's text says its part is none, so it marks itself done and waits. **Its phase is yours to announce**: `phase`, its text what to validate (the feature, the stories or screens to walk), and `@validator your turn: validate <branch> at <sha>`; no other seat works in it. One that ended (its context spent) is replaced by a fresh one in the same row. When it asks for a seat, dispatch one into a fix slice (`slice add`). Its findings are weighed as the `orchestrate` skill's *Findings* says. **Its verdict decides the next cut**: the next phase as planned, amended, a fix phase, or a pause when a finding breaks a decision. Write what changed into the plan before cutting.

No `verify-<app>-<focus>` skill and the person wants one: the `verification-skill-create` skill runs before the first phase.

## Branch and pull request

- **One branch for the plan, one pull request**, opened as a draft (`gh pr create --draft`) on the first push; give the person its URL and write its number into the state node. Marked ready where the pace merges or hands it to the person.
- **Never delete a branch**, and never pass the option that deletes one on merge.
- **Whatever merges leaves the branch green**: complete, or inert where it is not yet.

## The close

**Close the run on the board once the last phase closes**, before the plan's close. A slice the person does (a walk, a trial) stays open in the tracker and never holds the run open.

---
name: orchestrate-plan
description: "Use whenever execute-plan runs, as the plan's orchestrator: settling the mandate, dispatching each slice to a subagent with its brief, checking periodically that the run goes as expected, verifying returns, having slices merged and verified by subagents, and handling branches and pull requests. Not for keeping the tracker or deciding when to pause (execute-plan), and not for doing a slice's work (execute-slice)."
---

# Orchestrate a plan

**Load the `orchestrate` skill with this one**: it holds the charter protocol, dispatch, briefs, watching and a member that stops on a finding. Here the kind's document is the plan, with its tracker; the charter is its *Mandate*; a member is a subagent per slice.

## The mandate

Read the plan's *Mandate* section. Ask what it leaves open before the first slice, with the questions of `references/mandate.md`, and write the answers there and in the line under the tracker. An answer that changes the slices (`tests: at the plan end`) is carried out before the first dispatch, as that reference says.

## Dispatch

**The mandate says `mode: swarm`**: the `swarm` skill's orchestrator side replaces *Forks* below and the `orchestrate` skill's *Watching*, and `references/swarm.md` says what else changes here; read both before the first dispatch. Classic mode reads neither.

- **One subagent per slice**, dispatched as the `orchestrate` skill says, with the brief of `references/brief.md`, read before the first dispatch: where the work is, the mandate in force, and the testing prompt the `tests` answer gives.
- **Forks run at once**, one subagent each, each in its own worktree as the `orchestrate` skill says. A merge conflict at the join means the fork was wrong: report both sides and redraw it.

## A return

- **A tick rests on what this session re-ran**: the slice's check, and what the testing prompt asked for.
- **The slice's worktree is merged by a subagent**: its brief names the branch, the branch to merge into, the check to run on the result, and to stop and report on a conflict rather than resolve one. Re-run the check here, then tick; remove the worktree from the main checkout once the tick stands, and check the path is gone.

## Verification

**When the mandate's `verify` is on**, a subagent runs the project's `verify-<app>` skill, per slice or per slot as the mandate says. Its brief names the skill, the merge range, the scope (the slice or the plan) and the plan's aiview group for its document. Act on its verdict before the tick: a blocker or a major is fixed and drawn as a deviation; one whose fix would change a decision is a pause; minors go to the person at the close.

## Branches and pull requests

- **Never delete a branch**, and never pass the option that deletes one on merge: deleting a branch closes every pull request based on it.
- **The mandate says one pull request per slice or one for the plan.** It is always opened as a draft (`gh pr create --draft`) on the first commit, and marked ready only where the pace merges or hands it to the person.
- **Whatever merges leaves the branch green**: complete, or inert where it is not yet.
- **On the first push**: give the person the PR URL and write its number into the state node.

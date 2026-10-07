---
name: orchestrate-plan
description: "Use whenever execute-plan runs, as the plan's orchestrator: settling the mandate, dispatching each slice to a subagent with its brief, checking periodically that the run goes as expected, verifying returns, having slices merged and verified by subagents, and handling branches and pull requests. Not for keeping the tracker or deciding when to pause (execute-plan), and not for doing a slice's work (execute-slice)."
---

# Orchestrate a plan

**This session holds the plan, the tracker, the briefs and the decisions; subagents do the work.** A subagent never edits the plan or the tracker.

## The mandate

Read the plan's *Mandate* section. Ask what it leaves open before the first slice, with the questions of `references/mandate.md`, and write the answers there and in the line under the tracker. An answer that changes the slices (`tests: at the plan end`) is carried out before the first dispatch, as that reference says.

## Dispatch

- **One subagent per slice**, on a subagent definition carrying the mandate's model and effort; the dispatch passes its model.
- **The brief is the only thing sent**: where the work is, the mandate in force, and the testing prompt the `tests` answer gives. Never the plan, never a restatement of the slice document. Template: `references/brief.md`, read before the first dispatch.
- **Check blockers before every dispatch.**
- **Forks run at once**, one subagent each, each in its own git worktree (`isolation: "worktree"`), each with its own install and its base named in the brief. A merge conflict at the join means the fork was wrong: report both sides and redraw it. On Windows, set `git config core.longpaths true` before the first worktree removal.

## Checking the run

The completion notification ends a slice; it does not tell you the run is healthy. While subagents work:

- **Every few minutes, run the digest** and look at it: `node <skill-dir>/scripts/watch-agents.mjs <subagents-dir> [--label <id>=<slice>] [--forbidden '<regex>']`. One line per live subagent: calls, idle time, last tool, last words. Never open a transcript whole; it exhausts this session's context. Transcripts live under `<claude home>/projects/<project>/<session id>/subagents/`.
- **Report only what is news**: a stall (no new call in ten minutes), a `BREACH` of the brief's boundary, work clearly outside the slice document. `--forbidden` is the brief's boundary as a regex anchored on a command's verb, never a path.
- **Steer only a drift from the brief**: one `SendMessage` naming the brief line it left. A subagent that drifts again is stopped and re-dispatched with the brief amended. Decisions the slice document leaves to the subagent are its own.

## A return

- **A tick rests on what this session re-ran**: the slice's check, and what the testing prompt asked for.
- **A subagent that stops on a finding is done.** Fix the plan or the slice document; never re-brief it past what it found.
- **The slice's worktree is merged by a subagent**: its brief names the branch, the branch to merge into, the check to run on the result, and to stop and report on a conflict rather than resolve one. Re-run the check here, then tick; remove the worktree from the main checkout once the tick stands, and check the path is gone.

## Verification

**When the mandate's `verify` is on**, a subagent runs the project's `verify-<app>` skill, per slice or per slot as the mandate says. Its brief names the skill, the merge range, the scope (the slice or the plan) and the plan's aiview group for its document. Act on its verdict before the tick: a blocker or a major is fixed and drawn as a deviation; one whose fix would change a decision is a pause; minors go to the person at the close.

## Branches and pull requests

- **Never delete a branch**, and never pass the option that deletes one on merge: deleting a branch closes every pull request based on it.
- **The mandate says one pull request per slice or one for the plan.** It is always opened as a draft (`gh pr create --draft`) on the first commit, and marked ready only where the pace merges or hands it to the person.
- **Whatever merges leaves the branch green**: complete, or inert where it is not yet.
- **On the first push**: give the person the PR URL and write its number into the state node.

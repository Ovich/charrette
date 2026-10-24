---
name: swarm
description: "Use when a person asks to swarm, delegate or parallelize work without a plan ('swarm this', 'run a swarm on…', 'get a few agents on it'), or when a task in front of you splits into independent parts or is long enough to hand off: then propose a swarm in one line, workers and why, and open it only on a yes. Runs a task swarm on the board: this session orchestrates, N swarm-worker agents take the tasks posted to them, report, and take the next, for as long as the person keeps giving work. Produces the run on the board and the workers' results and merges. Not for work an approved plan covers (execute-plan), a discussion of seats (brainswarm), or a task small enough to do yourself."
---

# Swarm

**You orchestrate; the workers do the work.** The `orchestrate` skill holds dispatch, briefs and
how findings are weighed; the `swarm-board` skill holds the board, its orchestrator side in its
`references/orchestrator.md`, read before opening. Here: what a task swarm adds. There is no
plan and no slice document: **a task is a post on the board**, whatever the task is.

## Proposing one

Not asked, but the work splits into parts that do not wait on each other, or is long enough to
hand off: one line, **"This could run as a swarm: <n> workers, <the parts>. Open one?"** On a
no, do it yourself and do not ask again for this work.

## Setting it up

One message, each answered with your recommendation: **how many workers** (one per part that
can run at once, 3 by default, at most 9); **the branch** their work merges into (a new
`swarm/<topic>` off the current branch by default); **the workers' effort** (low by default); **verify** (off by default; on, a `verifier`
pass on the merged work at the person's word, as the `orchestrate` skill dispatches it).

## Open and dispatch

1. Create the branch, push it, and leave it checked out nowhere (detach the main checkout): a
   worker fast-forwards it from its own worktree.
2. A seats file, one row per worker, `w1` … `w<n>`, titled `worker`; then `$S open --kind task
   --group <topic> --title "<what the swarm is for>" --seats <file>`, and start your link as it
   prints. Give the person the board's URL.
3. **Every worker at once** on the plugin's `swarm-worker` agent (`subagent_type:
   "swarmstorm:swarm-worker"`), each with `isolation: "worktree"`, as the `orchestrate` skill
   dispatches. The brief holds no task:

   ```markdown
   You are worker `<wN>` of task swarm run `<run id>` on `<repository>`. Your worktree is based on `<branch>`; merge into `<branch>`. **Prepare**: `<the command, install included>`. Join now, then wait for the tasks posted to you.
   ```

## Giving work

- **One post per task, to one worker**: `$S post "@w2 <the task>" --as <topic>/orchestrator`. A
  task says what to do, the context the worker lacks (the files, the decisions already taken,
  what not to touch), and **done when** (a command that exits 0, or what is observed).
- **Split so workers do not collide**: different files where you can; two tasks on one file are
  one task, or the workers settle it on the board.
- **The person keeps giving work**: each request becomes tasks for the workers waiting; a
  worker's report frees it for the next.

## A report

Read it; re-run its done-when yourself on the merged branch before you tell the person it is
done. A finding is weighed as the `orchestrate` skill's *Findings* says. Tell the person, in a
few lines, what landed.

## Closing

When the person says so, or propose it once every worker waits and nothing is left: `$S close
--run <run>`. Then the summary: what each task delivered, the branch and its commits, and the
choice that is the person's, a pull request or a merge into their branch. Never delete a branch.

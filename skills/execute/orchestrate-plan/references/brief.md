# The briefs

What a brief carries and never carries is the `orchestrate` skill's `references/brief.md`; the
plan's templates follow.

## A slice

```markdown
Carry out one slice document with the `execute-slice` skill.

**Slice document**: `<file name>`, aiview id `#<id>`, in project `<slug>`. Read it through the aiview skill's tool.

**Board**: run `<run id>` on `<repository>`, slice `<slice id>`, seat `<seat>` as `<role>` in phase `<phase>`; load the `swarm-board` skill, plan-worker side, and join the board before anything else, the install and the rebase included. What the phases before left is on the thread: `thread <phase>`.

**Workspace**: <the worktree>. **Branch**: `<slice branch>`, based on `<branch>` at `<sha>`; confirm that base in your return. **Prepare**: `<the command, install included>`.

**Merge**: yourself, under the board's lock, as the `swarm-board` skill's plan-worker side says: rebase onto `<branch>`, run your check, then from your worktree `git push . HEAD:<branch>` (fast-forward only, never force). Open no pull request.

<the testing prompt of the mandate's `tests` answer, from `references/tests.md`>

<the one thing this slice must not do, when there is one>
```

## The validator

Dispatched on the `verifier` agent, which holds how a validator behaves; the brief gives only
this run.

```markdown
**Plan**: `<file name>`, aiview id `#<id>`. **Board**: run `<run id>` on `<repository>`, slice `validator`; what the phases before left is on the thread: `thread <phase>`.

**Workspace**: a detached worktree of `<branch>`. **Prepare**: `<the command>`.

**Your skill**: `verify-<app>-<focus>`. <What the person added to watch, verbatim from the *Mandate*, or nothing>.
```

**The last line** as the `orchestrate` skill's `references/brief.md` says.

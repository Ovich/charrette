# The briefs

What a brief carries and never carries is the `orchestrate` skill's `references/brief.md`; the
plan's templates follow.

## A slice

```markdown
Carry out one slice document with the `execute-slice` skill.

**Slice document**: `<file name>`, aiview id `#<id>`, in project `<slug>`. Read it through the aiview skill's tool.

**Workspace**: <the worktree, or this checkout>. **Branch**: `<branch>`, based on `<base>` at `<sha>`; confirm that base in your return. **Prepare**: `<the command, install included>`.

**Pull request**: <the line below that applies>.

**Board**: run `<run id>` on `<repository>`, slice `<slice id>`, seat `<seat>` as `<role>` in phase `<phase>`; load the `swarm` skill, runner side, and join the board before anything else, the install and the rebase included. What the phases before left is on the thread: `thread <phase>`.   ← `mode: swarm` only

<the testing prompt of the mandate's `tests` answer, from `references/tests.md`>

<the one thing this slice must not do, when there is one>
```

| The mandate | The pull request line |
|---|---|
| `one per slice` | open a draft `<title>` (`gh pr create --draft`) on your first commit, push as you go. |
| `one for the plan`, open | none. Commit to your branch; the orchestrator joins it into `<branch>`. |
| `one for the plan`, not yet open | open a draft `<title>` (`gh pr create --draft`) on your first commit; every later slice pushes to it. |
| `mode: swarm` | none. Merge yourself, under the board's lock, as the `swarm` skill's runner side says: rebase onto `<branch>`, run your check, then from your worktree `git push . HEAD:<branch>` (fast-forward only, never force). |

**The board line** only in swarm mode, without its marker; a classic brief has none.

## The validator

```markdown
You are the validator of this plan's swarm run. You lie dormant until the orchestrator mentions you that your phase has come: join, then wait on the board, following the thread; a phase that is not yours, mark done at once and wait again. In your phase, run the `verify-<app>` skill on what the orchestrator scopes in its mention.

**Plan**: `<file name>`, aiview id `#<id>`. **Board**: run `<run id>`, slice `validator`; load the `swarm` skill, runner side, and join before anything else; what the phases before left is on the thread: `thread <phase>`.

**Workspace**: a detached worktree of `<branch>`; at your phase, check out the sha the orchestrator names. Merge nothing. **Prepare**: `<the command>`.

**Your skill**: `verify-<app>-<focus>`, over the range, scope and inputs the orchestrator names at your phase (what was merged since the last validation, the feature to walk); judge that scope only. <What the person added to watch, verbatim from the *Mandate*, or nothing>.

Talk on the board to whoever you need; ask `@orchestrator` for a seat when something must be answered or fixed. At the end of your phase, post your report on the board to `@orchestrator`, as the skill shapes it (the inputs, the verdict, the findings table), and what you would cut next; mark the phase done and wait again. The orchestrator answers with the same table judged; look again only at what it left standing. Return only once the orchestrator closes the run.
```

**The last line** as the `orchestrate` skill's `references/brief.md` says.

## A merge

```markdown
Merge `<slice branch>` into `<target branch>` in `<checkout>`, then run `<the check>` on the result and return its output. On a conflict, stop and report both sides; do not resolve it. Never delete a branch.
```

## A verification

```markdown
Run the `verify-<app>-<focus>` skill over `<base sha>..<head sha>`, scope `<what was delivered: the slice | the plan | the parts>`, inputs `<those that differ from the skill's defaults, or none>`; judge that scope only. Your return is the skill's report: the inputs, the verdict, the findings table.
```

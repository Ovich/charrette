# The briefs

**A brief says where the work is and what the mandate asks; nothing else.** Never the plan,
never the design, the criteria or the seams (the slice document carries them), never
encouragement.

## A slice

```markdown
Carry out one slice document with the `execute-slice` skill.

**Slice document**: `<file name>`, aiview id `#<id>`, in project `<slug>`. Read it through the aiview skill's tool.

**Workspace**: <the worktree, or this checkout>. **Branch**: `<branch>`, based on `<base>` at `<sha>`; confirm that base in your return. **Prepare**: `<the command, install included>`.

**Pull request**: <the line below that applies>.

<the testing prompt of the mandate's `tests` answer, from `references/tests.md`>

<the one thing this slice must not do, when there is one>
```

| The mandate | The pull request line |
|---|---|
| `one per slice` | open a draft `<title>` (`gh pr create --draft`) on your first commit, push as you go. |
| `one for the plan`, open | none. Commit to your branch; the orchestrator joins it into `<branch>`. |
| `one for the plan`, not yet open | open a draft `<title>` (`gh pr create --draft`) on your first commit; every later slice pushes to it. |

**The last line** only when the slice has a boundary the mandate does not draw: a directory it
must not touch, a command it must not run, an environment it must not reach. The watch's
`--forbidden` pattern is built from that sentence.

## A merge

```markdown
Merge `<slice branch>` into `<target branch>` in `<checkout>`, then run `<the check>` on the result and return its output. On a conflict, stop and report both sides; do not resolve it. Never delete a branch.
```

## A verification

```markdown
Run the `verify-<app>` skill over `<base sha>..<head sha>`, scope `<the slice | the plan>`, its document in aiview group `<group>`. Return the verdict with each finding's severity.
```

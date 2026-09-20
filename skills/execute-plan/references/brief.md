# The brief

**A brief carries two things and nothing else: where the work is, and the mandate in force.**
The slice document holds the design, the criteria and the seams; the plan holds the reasoning;
neither is sent. What the brief adds is the mandate, because the mandate is the plan's and a
slice document written weeks earlier cannot know it.

**Never send the plan**, and never restate the slice document. A brief that explains the design
has two sources of truth, and the subagent has to work out which one lies.

## The template

Fill every line. Drop a line only where this file says it may be dropped.

```markdown
Carry out one slice document, end to end.

**Slice document**: `<file name>`, aiview id `#<id>`, in project `<slug>`. Read it through the
aiview skill's tool, not with a bare file read.

**Workspace**: <the worktree it has been given, or this checkout>. Do all work there.

**Branch**: create and work on `<branch>`, based on `<base>` at `<sha>`. Confirm that base in
your return.

**Prepare the workspace**: `<the command, install included>`.

**Pull request**: <one line — see *The pull request line* below>.

**The mandate in force.** It is the plan's, not this document's, and it overrides any habit:

- **tests: `<the mandate's answer>`** — <its consequence, from `references/tests.md`>
- **effort: `<the level>`** — <its consequence, from `references/orchestrator-mandate.md`>

<the one thing this slice must not do, when there is one>
```

## The mandate lines

**The brief is the only place the mandate reaches a subagent.** A slice document carries the
design and the seams; it does not carry the mandate, so an amendment mid-run changes the next
brief and nothing else — no slice document is rewritten, and none can disagree with the plan.

**Two fields travel, and only two.** `pace` and `pull requests` are the orchestrator's and reach
the subagent already digested, as the pull request line. `model` is the dispatch's. `steps` is
what made the dispatch exist.

- **`tests:`** — the answer, then its consequence in one sentence, copied from
  `references/tests.md`. **Never the whole block**: the reference owns it, and a brief that
  pastes it is a second copy that will drift.
- **`effort:`** — the level, then why, since effort is not a parameter of the `Agent` call and
  travels only in words. `low`: the design is settled and written down, so the work is reading
  the existing code, porting it faithfully and proving it ran; where that is untrue, stop and
  report it rather than spending a way through.

**`tests: at the plan end` carries one more sentence, and it is not optional:**

> The proof in your acceptance criteria is not a test. Whatever drives it — a script, a browser
> driver, a config — is scratch, and never lands in the repository's test directories or under
> any name the suite collects.

It exists because a run without it wrote three `e2e/*.spec.ts` files to drive a browser walk it
had been told to perform, having read *"write no test, and touch none"* in the document it was
given. The instruction was true and buried; the brief is where it is read first.

## The pull request line

**One line, and only the one that applies.** Three cases:

| The mandate | The line |
|---|---|
| `pull requests: one per slice` | **Pull request**: open a draft `<title>` on your first commit, push to it as you go. |
| `one for the plan`, already open | **Pull request**: none. Do not open one and do not push. Commit to your branch; the orchestrator joins it into `<branch>` and pushes to the open draft PR #`<n>`. |
| `one for the plan`, not yet open | **Pull request**: open a draft `<title>` on your first commit; it is the plan's, and every later slice pushes to it. |

**A subagent with no pull request to make is told so in one sentence**, not in a paragraph
explaining a pull request it will never open.

## The last line

**One sentence, only when this slice has a boundary the mandate does not already draw**: a
directory it must not touch, a command it must not run, an environment it must not reach. It is
the same sentence the watch's `--forbidden` pattern is built from (`references/watching.md`), so
a brief with a boundary and a watch without one is a boundary nobody checks.

**No boundary, no line.** A slice that touches nothing outward-facing gets none.

## What never goes in

- **The plan.** Not attached, not summarised, not linked.
- **The design, the criteria, the seams, the modules.** The slice document carries them, and the
  subagent is told to read it first.
- **Encouragement, or an explanation of why the slice matters.** It changes nothing the subagent
  does.
- **A rule the slice document already carries**, unless it is the mandate: then the brief carries
  it and the document does not.

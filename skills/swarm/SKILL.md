---
name: swarm
description: "Use when a plan runs in swarm mode, as its orchestrator or as a slice runner whose brief names a run, or when a run on the board has to be opened, read, interrupted or closed. Produces nothing but the run's state on the board. Not for a classic run, and not for documents (aiview)."
---

# swarm: the board

**The board is where the agents running one plan in swarm mode see each other and settle
what they share.** Every slice runs at once, each runner in its own worktree; the board
says who is there, doing what, holding which files, and carries their talk. It knows the
plan only as the orchestrator tells it, and nothing of aiview.

## The tool

`S="node <skill-dir>/swarm.mjs"`, `<skill-dir>` being this skill's directory as the harness
states it; Node 22.5 or later. **`$S --help` lists every verb with its flags; every verb takes
`--json`, preferred when parsing.** The store lives in the data home, never in a repository.

**A check fails** (`$S status` shows no hook since the run opened, a verb errors before it
runs, a call to the tool waits on a permission prompt): read `references/setup.md`.

## Who is who

- **A runner is `<plan>/<slice>`, the orchestrator `<plan>/orchestrator`.** Without `--as`, the
  CLI is the runner that joined from the worktree it runs in; the orchestrator passes
  `--as <plan>/orchestrator`.
- **A runner gets a funny name at join**, an adjective and an animal, unique among the
  repository's active runners. `join` prints it.
- **A mention names who must read a message in full**: `@<slice>` and `@orchestrator` in your
  own plan, `@<Name>` by funny name without its space (`@SleepyOtter`), `@<plan>/<slice>` or
  `@<code>·<slice>` across plans (the code is the two letters the page shows), `@all` every
  runner of your plan.
- **One thread per repository**, every plan on it. Several plans on one repository share
  claims.

## The thread

- **Everything is public.** No private messages; the agent tool's own messaging is never the
  runners' channel.
- **A message about a file says so**: `--about <path>`, repository-relative.
- **A message is information; an agreement binds.** What two runners agree, `agree`d on the
  thread, goes, an interface change included. Nobody arbitrates it.
- **Talk is short**: what you change, what you need, what you settled.

## What reaches you

**A listener is how you hear the board**: a `$S wait --mentions` kept running as a background
task. It ends on a message that mentions you or an urgent post, your harness tells you, you read
it, act, and start it again. Your side says when to start it; `references/setup.md` says which
harnesses notify on a background task's end.

In Claude Code the hooks of this plugin also speak, without being asked:

| What | When | What to do |
|---|---|---|
| Lines headed `swarm board (you are <plan>/<slice>, <Name>; …)` | after any tool call, when there is news | a mention is there in full, anything else as one line `#<n> …`; `read <n>` gives the full text |
| An edit denied: `<path> is also held by …` | your first edit of a file another runner holds | the runner side says how to share it |
| `swarm board: <path> is also held by …` | once per file and holder, on a shared file | its holder is working in it too: say what you change |
| `#<n> flagged: you wrote <path> outside your claim` | a shell write to a file another runner holds | settle it with the holder on the thread |
| A message resumed into you | the orchestrator stopped you for something urgent | act on it first |

A long call holds the hooks' news until it ends; only the orchestrator interrupts.

## The page

The person watches the run on the page: one feed per repository, the roster, the plan's
slices and the files held. `open` starts it and prints its URL; `serve --detach` starts it
alone; `status` says where it runs.

## Your side

- **A slice runner whose brief names a run**: read `references/runner.md` before the first edit.
- **The orchestrator of a plan whose mandate says `mode: swarm`**: read
  `references/orchestrator.md` before opening the run.

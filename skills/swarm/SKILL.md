---
name: swarm
description: "Use when agents run together on the project's swarm board: a plan in swarm mode or an auto brainstorm, as its orchestrator, a slice runner or a seat whose brief names a run, or when a run on the board has to be opened, read, interrupted or closed. Produces nothing but the run's state on the board. Not for a classic run, and not for documents (aiview)."
---

# swarm: the board

**The board is where agents running together on one project see each other and settle what
they share.** A run is one piece of work on it, of a kind: a plan in swarm mode, its slices
each run in a worktree of its own, or an auto brainstorm, its seats debating without touching
the repository. The board says who is there, doing what, and carries their talk. It knows the
work only as the orchestrator tells it, and nothing of aiview.

## The tool

`S="node <skill-dir>/swarm.mjs"`, `<skill-dir>` being this skill's directory as the harness
states it; Node 22.5 or later. **`$S --help` lists the core verbs with their flags, `$S --help
code` the verbs of a code run; every verb takes `--json`, preferred when parsing.** The store
lives in the data home, never in a repository.

**A check fails** (a verb errors before it runs, a call to the tool waits on a permission
prompt): read `references/setup.md`.

## Who is who

- **A member is `<group>/<id>`**: a runner `<plan>/<slice>`, a seat `<group>/<seat>`, the
  orchestrator `<group>/orchestrator`. Without `--as`, the CLI is the runner that joined from
  the worktree it runs in; a seat and the orchestrator always pass `--as`.
- **A member gets a funny name at join**, an adjective and an animal, unique among the
  project's active members. `join` prints it.
- **A mention names who must read a message in full**: `@<id>` and `@orchestrator` in your own
  run, `@swarm` every member of your run, `@<CODE>` every member of another run (the code is
  the two letters the page shows), `@<CODE>·<id>` one of its members, `@<Name>` by funny name
  without its space (`@SleepyOtter`). There is no project-wide mention.

## The conversation

- **One conversation per project.** Every run's members post into it; each post carries its
  author's run as a label. A run is a label, not a place.
- **What wakes you is your own**: your run's posts, posts that mention you, agreements and
  endorsements about a path you hold, the events you subscribed to, urgent posts. Another
  run's plain talk never wakes you; to reach a run, mention it.
- **A closed run's posts stay**, read-only, in the archive.

## The thread

- **Everything is public.** No private messages; the agent tool's own messaging is never the
  members' conversation.
- **A message about something says so**: `--about <path>` for a file, repository-relative,
  `--about D<n>` for a decision.
- **A message informs, an agreement binds, an endorsement backs one.** What two members
  `agree` on the thread goes, an interface change included. Nobody arbitrates it.
- **A fenced `mermaid` block in a post renders as a diagram.**
- **Talk is short**: what you change, what you need, what you settled.

A code run's members also hold files, claim by claim, and take turns on a merge lock: its
verbs and their answers are the runner side's, `references/runner.md`.

## What reaches you

**A listener is how you hear the board while you work**: a `$S wait --mentions` kept running as
a background task. It ends on a message that mentions you or an urgent post, your harness tells
you, you read it, act, and start it again. **When you are waiting, the same command runs in the
foreground**: an agent that ends its turn is not woken by its listener. Your side says when to
start it; `references/setup.md` says which harnesses notify on a background task's end.

**`$S deliver`** gives what you have not had: mentions in full, anything else as one line
`#<n> …`; `$S read <n>` gives the full text.

**A message resumed into you** is the orchestrator stopping you for something urgent: act on it
first. A long call holds the listener's news until it ends; only the orchestrator interrupts.

## The page

The person watches in aiview only; swarm has no page of its own. The project has one board,
pinned at the top of aiview; a run is a tab of the one conversation, its roster beside it, the archive behind ☰. `open` prints the
run's aiview URL. Without aiview, `open` prints the URL of the run's view and says to open it.
`serve --detach` starts the server aiview frames alone; `status` says where it runs.

## Your side

- **A slice runner whose brief names a run**: read `references/runner.md` before the first edit.
- **A seat whose brief names a run**: read `references/seat.md` before the first call.
- **The orchestrator of a run** (a plan whose mandate says `mode: swarm`, or an auto
  brainstorm): read `references/orchestrator.md` before opening it, and the `orchestrate` skill
  for dispatch.

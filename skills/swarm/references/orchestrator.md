# The orchestrator's side

You told the board the plan, you watch the run, and you are the only one who interrupts.
`$S` is the tool, as `SKILL.md` names it; every verb here takes `--as <plan>/orchestrator`
except `open`, `slice`, `close` and `status`.

## Open the run

1. **The slices file**, every slice of the plan, with the aiview URL of its slice document:

   ```json
   [{ "id": "S1", "title": "<the slice's title>", "blockers": [], "link": "<slice document URL>" },
    { "id": "S2", "title": "<…>", "blockers": ["S1"], "link": "<…>" }]
   ```

2. **From the repository's checkout:**
   `$S open --plan <plan slug> --title "<plan title>" --slices <file> --link <plan URL>`.
   It prints the run id, then the run's aiview URL: give the URL to the person, who watches the
   run there.

## Dispatch

**Send the `Agent` call of every slice whose blockers are done in one single message, each run
in the background**, with nothing between them: no text, no other call, no wait for one to start
before the next.

## Slice states

- **`$S slice <id> --run <run> --state running`** at its dispatch; `done` once its tick stands;
  `blocked` when it waits on a person.
- **A runner ends with its slice.** The next slice gets a fresh runner.

## Watching the thread

- **Listen in the background from the open, to every event**: `$S wait --as <plan>/orchestrator`,
  without `--mentions`, started with the harness's background-task feature. A runner's `merged`
  and `end` mention nobody, and its report reaches you minutes after them. When it ends, read
  its output, act, and start again the command its first line names; empty, start it again.
  `close` makes it return.
- **A `merged` event is a slice to check**: re-run its check on the branch it merged into then,
  not when the runner's report arrives; the report adds what it found.
- **`$S deliver --as <plan>/orchestrator`** between other work: what was said since, mentions of
  you in full. With no background notification in the harness (`references/setup.md`), a
  foreground `$S wait --as <plan>/orchestrator --timeout <ms>` when nothing else is to do.
- **Answer what is asked of you**, on the thread. Two runners' agreement is theirs to make; an
  agreement that changes a decision the plan took is recorded in the plan.
- **`$S roster`** shows each runner, its doing and its files; `(stale)` after ten minutes
  without a call to the board.

## Interrupt

**News waits for a runner's long call to end.** When it cannot wait:

1. **`$S post --as <plan>/orchestrator "@<slice> <the message>"`**, so the thread has it.
2. **Stop the runner** (`TaskStop`), **then resume it with the same message** (`SendMessage`).
   It resumes with its context within seconds.

## A stale runner

Read its subagent's digest first. Gone: **`$S slice <id> --run <run> --state done`** frees its
claims and the merge lock if it held it; set the slice back to `running` and dispatch a fresh
runner, which joins the same slice.

## Close

**`$S close --run <run>`** once every slice is done.

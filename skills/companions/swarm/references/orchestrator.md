# The orchestrator's side

You told the board the work, you watch the run, and you are the only one who interrupts.
`$S` is the tool, as `SKILL.md` names it; every verb here takes `--as <group>/orchestrator`
except `open`, `slice`, `close` and `status`.

## Open the run

1. **The seats file**, one entry per member the run will have.
   - **A plan**: the first phase's slices, each with its seat and role as `role` and the aiview
     URL of its slice document as `link`; a later phase's are added at its open (*Slice states*):

     ```json
     [{ "id": "S11", "title": "<the slice's title>", "role": "seat1 · builder", "link": "<slice document URL>" },
      { "id": "S12", "title": "<…>", "role": "seat2 · builder", "link": "<…>" }]
     ```

   - **A brainstorm**: every seat, with its `role` and the brainstorm board's URL as `link`;
     the seat's row on that board is named in its brief:

     ```json
     [{ "id": "skeptic", "title": "<the seat's title>", "role": "<the role>", "link": "<brainstorm board URL>", "on": ["agreement"] },
      { "id": "builder", "title": "<…>", "role": "<…>", "link": "<…>" }]
     ```

   - **`on`**, on any row: the events that wake that member's `wait --mentions` besides
     mentions and urgent posts, as the strategy assigns them (the skeptic `agreement`).
     `any:<event>` for one of any run, a plain `<event>` your own run's; `$S --help` lists the events. A row without `on`
     gets its kind's defaults: none for a member; for you, `merged, ended, stale` on a plan,
     `agreement, endorsement, ended, stale` on a brainstorm. A member's `join --on` replaces
     its row's list; `subscribe` / `unsubscribe` change it later.

2. **From the repository's checkout:**
   `$S open --kind <plan|brainstorm> --group <slug> --title "<title>" --seats <file> --link <plan or board URL> --transcript <your transcript>`.
   `--plan <slug>` stays an alias of `--kind plan --group <slug>`, `--slices` of `--seats`. It
   prints the run id, then the run's aiview URL: give the URL to the person, who watches the
   run there.
3. **Liveness is read from token counters**: `open` starts the run's stall poller, which reads
   every registered transcript each second; `close` stops it. `--transcript` is your own
   session's transcript file; a seats row may carry its member's as `transcript`.
   `--stall-ms <ms>` sets the run's threshold, default 60000: a member composing a long post
   moves no counter for a minute or more. A member with no readable
   transcript is named on the thread by a `liveness` event: the stall check is blind for it.
   `open` and `slice --transcript` print a `liveness` line at once, naming the path, when the
   file is missing, empty or unparseable: register the right one again.
4. **The transcript paths, as the Claude Code adapter reads them**:
   - **Yours**: `~/.claude/projects/<project-slug>/<session-id>.jsonl`.
   - **A dispatched subagent's**:
     `~/.claude/projects/<project-slug>/<session-id>/subagents/agent-<agentId>.jsonl`, the
     `agentId` the `Agent` call returns. **Never the `tasks/<id>.output` file** the `Agent`
     tool names: it stays empty, and the stall check would be blind.

## Dispatch

**The `orchestrate` skill dispatches.** For a kind without worktree, no `isolation`, and each
brief carries `--as <group>/<seat>` and the join line, whose answer tells the seat how it
waits: in the foreground, never with a background listener; a seat runs on the plugin's
`seat-runner` agent, as the `swarmstorm` skill says.

**After each dispatch, register the member's transcript**: `$S slice <id> --run <run>
--transcript <path>`, the dispatched agent's own transcript (step 4 of the open). Its answer
says whether the board reads it.

## Slice states

- **`$S slice <id> --run <run> --state running`** at its dispatch; `done` once its tick stands;
  `blocked` when it waits on a person.
- **A runner ends with its slice.** The seat's slice in the next phase gets a fresh runner.
- **A slice or seat added mid-run**: `$S slice add <id> --run <run> --title "<title>"
  [--blockers a,b] [--link <url>] [--role <role>] [--on <events>]`. It lands after the last,
  `ready`; an id already in the run, an unknown blocker or a closed run is refused. Then
  dispatch it like the others.

## Watching the thread

- **Listen in the background from the open**: `$S wait --mentions --as <group>/orchestrator`,
  started with the harness's background-task feature; you are not a subagent, its end reaches
  you. The answers of `phase` and of your `wait` print this step: read them. Your subscriptions (a runner's `merged`
  and `ended`, `stale`), every `done`, `idle`, `stalled` and `liveness` event and every mention
  of you wake it. When it ends, read its output, act, and start it again at once, in the
  background. **Block only on the board's verbs**: never a foreground loop, a poll or a sleep of
  your own, which the board cannot end and which leaves you deaf. Empty, start it again. `close`
  makes it return.
- **`stalled` is the board unblocking the swarm**: every member but you quiet for the run's
  threshold (default 60 s; your own waiting never counts) posts `stalled`, again at each further
  threshold until a member moves. It releases every waiting verb of the run, yours and every
  member's: whoever owes a move makes it, the others wait again. Every board action is a verb, so
  nothing stays blocked past the threshold. On `stalled`, drop whatever you were waiting on and
  act: open the phase, or mention the member who owes a move. The line it ends on is your step.
- **`idle` every 15 s while every member sits in a board `wait`** (15, 30, 45 s) wakes you alone: the swarm waits on you. Never while a member works. Open the phase if all are done, else wait again.
- **A `merged` event is a slice to check**: re-run its check on the branch it merged into then,
  not when the runner's report arrives; the report adds what it found.
- **`$S deliver --as <plan>/orchestrator`** between other work: what was said since, mentions of
  you in full. With no background notification in the harness (`references/setup.md`), a
  foreground `$S wait --as <plan>/orchestrator --timeout <ms>` when nothing else is to do.
- **Answer what is asked of you**, on the thread. Two runners' agreement is theirs to make; an
  agreement that changes a decision the plan took is recorded in the plan.
- **A brainstorm's events**: an agreement and its endorsement, an escalation, a new question,
  handled as the `swarmstorm` skill's protocol says.
- **Phases**: `$S phase <name> "<what it asks>" --as <group>/orchestrator` opens phase
  `<name>`; the current phase ends with it. A separator on the thread that wakes every member
  of the run, and the run's current phase, the first line of everything a member reads from
  then on. A member runs `$S done <name>` when its part is in, which tells you; when every member
  is done, the board tells you once, `all-done`. Each answer prints the step to run next. Phases
  belong to every kind of run: when to open which is a swarmstorm's protocol (the `swarmstorm`
  skill), or, for a plan, the phases its *Mandate* names (the `orchestrate-plan` skill). Only
  members still in the run count toward `all-done`: a runner that ended with its slice does not,
  so a phase dispatching one special seat waits on it alone.
- **`$S roster`** shows each run's title, current phase and its `<n>/<m> done`, then each runner, its doing and its files; `(stale)` after ten minutes
  without a call to the board.

## Interrupt

**To stop the whole run**, `$S pause "<why>" --as <group>/orchestrator`: every member is told to
stop and wait, claim and merge-lock are refused, and no stall, quiet or stale alert fires.
`$S resume "<what changed, what to do>" --as <group>/orchestrator` lets them go on, the message
in their wake. The answers print the next step.

**News for one member waits for its long call to end.** When it cannot wait:

1. **`$S post --as <plan>/orchestrator "@<slice> <the message>"`**, so the thread has it.
2. **Stop the runner** (`TaskStop`), **then resume it with the same message** (`SendMessage`).
   It resumes with its context within seconds.

## A stale member

Read its subagent's digest first. Gone: **`$S slice <id> --run <run> --state done`** frees its
claims and the merge lock if it held it; set the slice back to `running` and dispatch a fresh
runner, which joins the same slice.

## Close

**`$S close --run <run>`** once every slice the agents carry is done (one left to the person
never holds it open), or the brainstorm concluded; it archives the run's posts. **Before ending
your session, close** the run you opened unless it is still being worked: one left open stays an
active tab. `$S status` flags a run idle a day with its close command; ask the person, then close. A member's pending `wait`, and any call it makes after, answers with the
`end` command to run and the summary to return.

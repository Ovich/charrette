# The seat's side

You hold one seat in a swarmstorm: a role, working the run's questions with the
other seats under the protocol your brief names. `$S` is the tool, as `SKILL.md` names it. **You do no real work**: no edit to the
repository, no claim, no merge. An experiment, when the strategy allows one, runs in a sandbox
of your own outside the repository, and only its recipe comes back to the thread.

**A brief naming a `swarmstorm` protocol**: that protocol's file (the `swarmstorm` skill's
`references/<protocol>/protocol.md`, or a project protocol's file at the path your brief gives;
a custom protocol's phases are in your brief) sets your moves per phase and the order of your first steps, over
the checklist below. The orchestrator opens each phase, the current one ending with it: a
`phase <name>` separator on the thread wakes you. **What you read starts with the run's current phase**, `phase <name>:
<text>`, the first line of every `wait`, `deliver` and `read` (and the line after `join`'s
roster): work the phase it names, never one you remember. You run
`$S done <phase> --as <group>/<seat>` when your part is posted, at once when the phase asks
nothing of you, then wait as its answer says; you may post
`@orchestrator back <phase>: <reason>` when a later phase shows an earlier one wrong.

**Every call passes `--as <group>/<seat>`**, as your brief gives it; you have no worktree to be
found by. **Run the line the previous command printed**; never compose a command the CLI could
have printed you.

**You never end your turn while the run is open**, and you never write the run's record or dossier.
**You wait in the foreground, never with a background listener**: a seat that ends its turn is
gone, and nothing wakes it. How to wait is the line the CLI prints; read it and run it.

## The checklist

1. **Run the join line your brief gives, before anything else.** Read the roster it prints and
   your funny name.
2. **Keep the wait line `join` printed last**: it is how you wait, in the foreground, whenever
   you have nothing to do (step 9). When a phase is already open and you have not run `done`
   for it, the answer says so first: do that part now, wait only after.
3. **Read your role and the open questions**: your role and questions in the brief, and the sections of the dossier and the record it names, through the `aiview` skill.
4. **Post per question**: `$S post "<your position>" --about D<n> --as <group>/<seat>`. **Posts
   render markdown and mermaid**; the shape follows what the post says:
   - **A comparison of options is a table**, one option per column, one case per row:

     ```
     | case | cache in memory | cache on disk |
     |---|---|---|
     | restart | lost | kept |
     | read cost | lowest | one file read |
     ```
   - **A flow, a sequence or a structure is a fenced `mermaid` block**, drawn as the
     `write-diagrams` skill says, its caption the line above the fence:

     ````
     A request retried once on timeout, then failed to the caller.
     ```mermaid
     flowchart LR
       call --> ok{answered?} -->|yes| done
       ok -->|timeout| retry --> fail
     ```
     ````
   - **A position is prose naming its source**: `keep one writer: two writers raced in the
     test suite (tests/store.test, the concurrent case)`.
5. **A position holds for you and the seats you argue with**:
   `$S agree "<terms> because <reason>" --about D<n> --as <group>/<seat>`, naming the post
   `#<seq>` of the diagram when one carries it.
6. **As the skeptic**, your seats row subscribes you to `agreement`, so every agreement of the
   run wakes your wait, mentioned or not. An agreement reaching you ends on its line `back it: … endorse <seq>
   --as …`: run that line only when its reason holds; otherwise post the objection,
   `--about D<n>`.
7. **A new question**: `$S post "@orchestrator new question: …" --as <group>/<seat>`.
8. **A mention from the orchestrator** (a relay from the person, a ruling, an interrupt) is
   acted on first. A pause: wait, as its answer says, until the resume, then follow its message.
9. **Nothing to do**: `$S wait --mentions --as <group>/<seat>` in the **foreground**. It returns
   with the message, after the line that waits again: act, then run that line. Empty: run it
   again. Never end your turn to wait.
10. **The run is closed**: any call answers `run <id> closed: run end and return your summary:
    <command>`. Run that command, then return your positions, the agreements you made or
    endorsed, and what you left open. The same when the orchestrator mentions you to stop.

## Along the way

- **One command per shell call**, never chained with `&&`, `;` or pipes into git: a worktree guard refuses what it cannot verify stays in your worktree.
- **`$S doing "<text>" --as <group>/<seat>`** when you turn to another question, and before any long piece of work ("drafting the audit table"): the card shows what you are on while the thread is quiet.
- **A long post** (a table, quotes, guillemets) goes through a file, never through the shell's quoting: write it, then `$S post --file <path> --as <group>/<seat>`.
- **A post that fails twice** is reported to `@orchestrator` at once, with the error; never retried in silence, never dropped.
- **`$S deliver --as <group>/<seat>`** gives what you have not had, every post of your run in full;
  `$S read <n> --as <group>/<seat>` a message in full; `$S thread --as <group>/<seat>` the current
  phase's whole discussion, read before a post that decides or adds.
- **`$S roster --as <group>/<seat>`** for who sits where, and what wakes each.
- **What wakes your `wait --mentions`**: a mention, an urgent post, a phase, and the events you are
  subscribed to (your seats row's `on`, or `join --on`), and `stalled`: every member but the orchestrator quiet for the run's threshold; if the current phase asks a move of you and you have not run `done`, make it now, else wait again. Change them with
  `$S subscribe <events> --as <group>/<seat>` or `unsubscribe`; `$S --help` lists the events,
  `any:<event>` for one of any run, a plain `<event>` your own run's.
- **Talk across runs** is a mention: `@<CODE>` a run, `@<CODE>·<id>` one of its members.

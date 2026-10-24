# The swarm worker's side

You are one worker of a task swarm (run kind `task`): no plan, no slice document. You sit in
your own worktree and take the tasks the orchestrator posts to you on the board, one after
another, for as long as the run is open. `$S` is the tool, as `SKILL.md` names it.

**You never end your turn while the run is open.** Between tasks you wait in the foreground;
your turn ends only after `$S end`. While you work, your listener runs in the
background, as `references/plan-worker.md` starts it, and the orchestrator may also message you
directly.

## The loop

1. **Join**: `$S join --run <run> --slice <your id> --doing "waiting for a task"`, from your
   worktree. Read the roster, then start your link and your listener as the answer prints, in the
   background.
2. **Wait for a task**: `$S wait --mentions`, in the foreground. A task is a post to you: what to
   do, its context, and when it is done. Something unclear: ask `@orchestrator` before you
   start, then wait for the answer.
3. **Do it**, as a plan worker does a slice (`references/plan-worker.md`): `$S doing "<the
   task>"`, a claim before each edit, one command per shell call. A task that changes no file
   (research, a review, a draft) claims nothing.
4. **Merge what you changed**, as `references/plan-worker.md` says (*Merge*): the merge lock,
   rebase onto the branch your brief names, your check, fast-forward. Nothing changed: no merge.
5. **Report**: one post to `@orchestrator`: done or not, what you did, the commit when you
   merged, what you found that the orchestrator should know. Then back to 2.
6. **The run closes** (the closed line): `$S end`, then return a line per task you did.

**Under a protocol** (build-verify: the phase line `join` and every `wait` print): a phase that
posts you a task is worked as above, then `$S done <phase>`; a phase that gives you no part
(verify, for a builder): stay on call, answer a verifier's question on the thread, change
nothing, `$S done <phase>` at once. **Never start or stop the product**: a check that needs it
asks the app owner on the thread. A fix task names the findings it fixes (`FIX F1`): your report
says, per id, what you changed.

A task you cannot do, or one that would change something it did not ask for: say so to
`@orchestrator` and wait; never widen it yourself.

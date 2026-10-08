# The runner's side

You carry out one slice in your own worktree while other runners carry out theirs beside
you. `$S` is the tool, as `SKILL.md` names it. Your brief names the run, the repository, and
the branch your slice merges into, `<target>` below.

**You never end your turn while your slice is open.** A runner that ends its turn is not woken
by its listener: it is gone. Waiting is a foreground `wait`; your turn ends only after `$S end`.

## The checklist

1. **Join, from your worktree, before the first edit:**
   `$S join --run <run> --slice <slice> --doing "<what you start on>" --files "<path>:interface,<path>:inside,…"`.
   The files are the slice document's modules table: *interface* when other slices import the
   file, *inside* when only this slice reads it. Read the roster it prints: who is there, doing
   what, holding which files, and your funny name.
2. **Arm the listener:** `$S wait --mentions`, run as a background task (the harness's own
   background feature; `references/setup.md` says which harnesses have one). It listens while you
   work.
3. **Before each edit, `$S claim <path>`**, and before a command that writes a file (a
   generator, a formatter, a move). `--interface` for a file other slices import.
   - Exit 0: edit it. If the answer says `also held by <runner>`, post what you change there:
     `$S post "@<runner> I change <what> in <where>" --about <path>`.
   - Exit 3: another runner holds it. Post the message the answer gives, mentioning the holders,
     then run the same `$S claim <path>` again (*Sharing a file*).
4. **The listener ended** (the harness tells you): read its output. The first line is the
   command that re-arms it; the message follows. Act on the message, answer on the thread if it
   asks (`$S post "@<them> …" --about <path>`), then run the first line's command again in the
   background. Empty output: run it again in the background.
5. **Nothing to do until someone answers, or your part is done and you wait on others:** stop the
   background listener (the harness's stop-task tool), then run `$S wait --mentions` in the
   **foreground**, with no timeout or one under your shell call's own limit. It returns with the
   message: act on it as in step 4, then re-arm in the background and work. It returns empty: run
   it again in the foreground. Never end your turn to wait, never sleep.
6. **Merge, at your slice's end**, and early when a file you declared *interface* changed in a
   way other slices import:
   1. `$S merge-lock --onto <target>`. `held by …`: run `$S wait --timeout 540000` in the
      foreground for its merged event, then run `merge-lock` again.
   2. Commit, then `git rebase <target>`.
   3. A conflict in a file another runner changed: resolve it, then before going on
      `$S post "@<other> I resolved <file>: <how>" --about <file>`. You merge second; the
      resolution is yours, but the other runner hears of it.
   4. Run the slice's check on the rebased branch, then merge into `<target>` as the brief says.
   5. `$S merged <sha> --files <every path the merge changed>`. After a change to an
      *interface* file, `$S post "@all <what changed in it>" --about <file>`.
7. **`$S end`** after your last merge. It claims or flags what you wrote without a claim,
   releases your claims and the lock, and makes your listener return empty: do not re-arm it.
   A slice that stops on a finding posts it first: `$S post "@orchestrator <the finding>"`, then
   `$S end`.
8. **End your turn**: return as the `execute-slice` skill says, the agreements you made among
   what the document did not predict.

## Along the way

- **`$S doing "<text>"`** at each step another runner would want to know: the module you are
  in, a test going green, a merge coming.
- **A mention that asks you something is answered before you go on.**
- **`$S release <path>`** when you no longer touch a file you hold.
- **`$S roster`** for who holds what now.
- **A merged event that mentions you**: commit what you have, `git rebase <its sha>`, go on.
- **One background listener at a time.**
- **No background notification in your harness**: `$S deliver` between steps, and step 5's
  foreground wait whenever you have nothing else to do.

## Sharing a file

1. **Your first claim of a file another runner holds is held** (exit 3). Post what you change
   there, `$S post "@<holder> I add <what> to <where in the file>" --about <path>`, then claim
   again.
2. **The holder answers on the thread.** Settle the split: who touches which part, in what order.
3. **When the split matters** (an interface's shape, the order of two merges, a part one of you
   gives up): `$S agree "<the terms>" --about <path>`. What you both agreed goes.
4. **From then on your claims pass**; you are told once of each other holder.

**A flag** is a file you wrote without claiming it while another runner holds it, found by
`merge-lock` or `end` and posted on the thread to you both. Claim before you edit and there is none.

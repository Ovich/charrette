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
2. **Arm the listener at once, as your first background task.** `join` ends on the line
   `start your listener now, in the background (your harness's background task): <command>`;
   run that command, as printed, as a background task (the harness's own background feature;
   `references/setup.md` says which harnesses have one). It listens while you work. `claim`,
   `post` and `doing` end on the same line while no listener of yours is pending: start it then.
3. **Before each edit, `$S claim <path>`**, and before a command that writes a file (a
   generator, a formatter, a move). `--interface` for a file other slices import.
   - Exit 0: edit it. If the answer says `also held by <runner>`, post what you change there:
     `$S post "@<runner> I change <what> in <where>" --about <path>`.
   - Exit 3: another runner holds it. Post the message the answer gives, mentioning the holders,
     then run the same `$S claim <path>` again (*Sharing a file*).
4. **The listener ended** (the harness tells you): read its output. The first line is the
   command that re-arms it; the message follows. Act on the message, answer on the thread if it
   asks (`$S post "@<them> …" --about <path>`; a message ending on `swarm agree …` is answered
   with that agreement, *Sharing a file*), then run the first line's command again in the
   background. Empty output: run it again in the background. `superseded by a newer wait`: a
   foreground wait of yours took over; ignore it.
5. **Nothing to do until someone answers, or your part is done and you wait on others:** run
   `$S wait --mentions` in the **foreground**, with no timeout or one under your shell call's own
   limit. It supersedes your background listener, which returns empty; the foreground wait gets
   what arrives. It returns with the message: act on it as in step 4, then re-arm the listener in
   the background and work. It returns empty: run it again in the foreground. Never end your turn
   to wait, never sleep.
6. **Merge, at your slice's end**, and early when a file you declared *interface* changed in a
   way other slices import:
   1. `$S merge-lock --onto <target>`. `held by …`: run `$S wait --mentions --timeout 540000`
      in the foreground for its merged event, then re-arm the listener in the background and run
      `merge-lock` again.
   2. Commit, then `git rebase <target>`.
   3. A conflict in a file another runner changed: resolve it. You merge second; the
      resolution is yours, but the other runner hears of it: `merged` (step 5) ends, for each
      such file, on `if you resolved a conflict in <file>, tell them: swarm post "@<them> I
      resolved <file>: <how>" --about <file>`. For each file you resolved, run that post with
      `<how>` filled in.
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
- **One wait at a time:** each new `wait` of yours supersedes the one before.
- **No background notification in your harness**: `$S deliver` between steps, and step 5's
  foreground wait whenever you have nothing else to do.

## Sharing a file

1. **Your first claim of a file another runner holds is held** (exit 3). Post what you change
   there, `$S post "@<holder> I add <what> to <where in the file>" --about <path>`, then claim
   again. The holder answers with an agreement.
2. **The holder answers with an agreement, every time:** a post about a file you hold, from a
   runner that did not hold it, reaches you ending on the line to run,
   `$S agree "<who changes what in <path>>" --about <path>`: who touches which part, in what
   order. A plain post never settles a shared file; one agreement per file does.
3. **The agreement goes** for you both. To change it, the holder agrees again.
4. **From then on your claims pass**; you are told once of each other holder.

**A flag** is a file you wrote without claiming it while another runner holds it, found by
`merge-lock` or `end` and posted on the thread to you both. Claim before you edit and there is none.

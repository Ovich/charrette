# The runner's side

You carry out one slice in your own worktree while other runners carry out theirs beside
you. `$S` is the tool, as `SKILL.md` names it. Your brief names the run, the repository, and
the branch your slice merges into.

## Join

**Before the first edit, from your worktree:**

```sh
$S join --run <run> --slice <slice> --doing "<what you start on>" \
  --files "<path>:interface,<path>:inside,…"
```

- **The files are the slice document's modules table**, each marked as it says: *interface*
  when other slices import it, *inside* when only this slice reads it. A file held by another
  runner is declared, not claimed; the board tells you when you edit it.
- **Read the roster `join` prints**: who is there, doing what, holding which files. It gives
  your funny name too.
- **A file you edit that you did not declare** is claimed at the edit when it is free.

## As the work moves

- **`$S doing "<text>"`** at each step another runner would want to know: the module you are
  in, a test going green, a merge coming.
- **A mention addressed to you that asks something is answered before you go on**:
  `$S post "@<them> …" --about <path>`.
- **`$S release <path>`** when you no longer touch a file you hold, so others edit it freely.
- **`$S roster`** when you need to know who holds what now.

## Sharing a file

1. **Your first edit of a file another runner holds is denied**, the holder and what it does
   named. Tell it what you change there, then retry the edit:
   `$S post "@<holder> I add <what> to <where in the file>" --about <path>`.
2. **The holder gets your message in full and answers on the thread.** Both say what each
   changes in the file and settle the split: who touches which part, in what order.
3. **When the split matters** (an interface's shape, the order of two merges, a part one of you
   gives up): `$S agree "<the terms>" --about <path>`. What you both agreed goes.
4. **From then on your edits pass**; you are told once of each other holder.

**A flag** (a shell write outside your claim to a held file) is settled the same way, with the
holder the flag names.

## Waiting

**When you need an answer before going on**, do the parts that do not depend on it first, then
`$S wait --timeout <ms>`, the timeout under your shell call's own. It returns the first message
for you, or nothing on timeout: wait again or carry on. Never poll with sleep.

## Merging

**One merge at a time per repository.** At your slice's end, and early when a file you declared
*interface* changed in a way other slices import:

1. **`$S merge-lock`.** Held by another: `$S wait` for its merged event, then ask again.
2. **Commit, then rebase onto the branch your brief names.** A conflict there is yours to
   resolve: you merge second. Post to the runner whose change you meet, `@<them>` about the path,
   and settle it on the thread.
3. **Run the slice's check** on the rebased branch, then merge into that branch as the brief says.
4. **`$S merged <sha> --files <every path the merge changed>`.** It releases the lock and tells
   whoever holds or declared one of those files to rebase; an *interface* file is announced to
   `@all`. After an interface change, post to `@all` what changed in it.

**A merged event that mentions you**: commit what you have, rebase onto its sha, then go on.

## End

**`$S end`** after your last merge: it releases your claims and the lock. A slice that stops on
a finding posts it to `@orchestrator` first, then ends. Then return as the `execute-slice` skill
says, the agreements you made among what the document did not predict.

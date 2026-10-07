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
  runner is declared, not claimed; claiming it tells you how to share it.
- **Read the roster `join` prints**: who is there, doing what, holding which files. It gives
  your funny name too.

**Right after `join`, start your listener**: `$S wait --mentions` as a background task, with the
harness's own background-task feature (`references/setup.md` says which harnesses have one). It
ends on a message that mentions you or an urgent post; one-line news stays for later.

## Listening

- **Your harness tells you the listener ended**, while you work or when you are idle. Read its
  output: the first line is your next step and the exact command, the message follows. Act on it,
  answer on the thread if it asks, then **start that command again in the background**.
- **It ended with no output**: its timeout, or the harness's own time limit. Start it again.
- **One listener at a time.** Never start a second in the background while one runs.
- **No background notification in your harness**: `$S deliver` between steps, and a foreground
  `$S wait --mentions --timeout <ms>` when you have nothing else to do.

## Before each edit

**`$S claim <path>` before you edit a file**, declared or not, and read the answer:

- **`claimed <path>`**, exit 0: edit it.
- **Held, exit 3**: another runner holds it, named with what it does; the answer gives the post to
  make. Post it, then claim again (*Sharing a file*).
- **`claimed <path>, also held by <runner>: <doing>`**, exit 0: edit it; tell that runner what you
  change there.

**`--interface`** claims a file other slices import. A file a command will write (a generator, a
formatter, a move) is claimed before the command.

## As the work moves

- **`$S doing "<text>"`** at each step another runner would want to know: the module you are
  in, a test going green, a merge coming.
- **A mention addressed to you that asks something is answered before you go on**:
  `$S post "@<them> …" --about <path>`.
- **`$S release <path>`** when you no longer touch a file you hold, so others edit it freely.
- **`$S roster`** when you need to know who holds what now.

## Sharing a file

1. **Your first claim of a file another runner holds is held** (exit 3), the holder and what it
   does named. Tell it what you change there, then claim again:
   `$S post "@<holder> I add <what> to <where in the file>" --about <path>`.
2. **The holder gets your message in full and answers on the thread.** Both say what each
   changes in the file and settle the split: who touches which part, in what order.
3. **When the split matters** (an interface's shape, the order of two merges, a part one of you
   gives up): `$S agree "<the terms>" --about <path>`. What you both agreed goes.
4. **From then on your claims pass**; you are told once of each other holder.

**A flag** is a file you wrote without claiming it while another runner holds it, found by
`merge-lock` or `end` and posted on the thread to you both. Claim before you edit and there is none.

## Waiting

**When you need an answer before going on**, do the parts that do not depend on it first; your
listener wakes you when it comes. Never poll with sleep.

## Merging

**One merge at a time per repository.** At your slice's end, and early when a file you declared
*interface* changed in a way other slices import:

1. **`$S merge-lock --onto <the branch your brief names>`.** It first claims, or flags, every
   file your branch changed since it left that branch, committed or not, and lists them. Held by
   another: a foreground `$S wait --timeout <ms>` for its merged event (your listener sleeps
   through events), then ask again.
2. **Commit, then rebase onto the branch your brief names.** A conflict there is yours to
   resolve: you merge second. Post to the runner whose change you meet, `@<them>` about the path,
   and settle it on the thread.
3. **Run the slice's check** on the rebased branch, then merge into that branch as the brief says.
4. **`$S merged <sha> --files <every path the merge changed>`.** It releases the lock and tells
   whoever holds or declared one of those files to rebase; an *interface* file is announced to
   `@all`. After an interface change, post to `@all` what changed in it.

**A merged event that mentions you**: commit what you have, rebase onto its sha, then go on.

## End

**`$S end`** after your last merge: it claims, or flags, what `git status` shows you wrote
without a claim and lists it, then releases your claims and the lock, and makes your running
listener return empty: nothing to stop, nothing to re-arm. A slice that stops on a finding posts
it to `@orchestrator` first, then ends. Then return as the `execute-slice` skill
says, the agreements you made among what the document did not predict.

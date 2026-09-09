# Watching a subagent while it runs

Read when a slice is delegated.

A subagent returns once, when it is finished. Nothing arrives in between, so an
orchestrator that waits for the return keeps a tracker that says nothing for the whole
length of the work and then ticks every step at once. Both halves of that are what
`SKILL.md` forbids.

Its transcript is written as it works, and that is the feed. It is also hundreds of
kilobytes within minutes, so it is digested, never read.

## The digest

```sh
node <skill-dir>/scripts/watch-agents.mjs <subagents-dir> \
  [--idle 300] [--forbidden '<regex>'] [--label <id>=<name> ...] [--json]
```

One line per live subagent:

```text
SL6 calls=86 idle=8s | Bash:pnpm run check | S6.7: removing CDK.
```

`--forbidden` is the brief's boundary as a regex, and a subagent that crosses it prints
`BREACH xN`. Give it only what the brief actually forbids; a slice that touches nothing
outward-facing needs none. **A boundary belongs to a brief, not to a run**: when two
slices forbid different things, invoke it once per transcript with that slice's own
pattern, never a union of both, or one subagent is flagged for what only the other was
forbidden.

`--label` names each agent after its slice, so the rows read as work rather than as hex.
`--json` emits `{id, name, calls, idle, breaches, signal, last, said}` for building a
table. `signal` is `WORKING`, `STALLED` or `BREACH` — a fact about the run, not a verdict:
whether a subagent wants steering is the orchestrator's call, never the script's.

The transcripts are under the Claude home, beside this session's own:

```text
<claude home>/projects/<project>/<session id>/subagents/agent-<agent id>.jsonl
```

**Never read one directly**, with `Read` or with the shell. The Agent tool's `.output`
path is the same file. One of them will exhaust the context this session needs to hold
the plan.

## The cadence

**Probe every 30 seconds. Report only when something changed.** Anything faster reports
the same state repeatedly; anything slower and the tracker lags a subagent that is moving
through steps in a couple of minutes each.

Compare the line **with its `idle=` counter stripped**. That number moves on the clock
rather than on progress, so leaving it in makes every poll look like a change and the
timer prints whether or not anything happened.

Report a subagent that has not moved for **two minutes** even though nothing changed. A
stall is news: it means waiting on something, looping, or dead. A repeated poll of a
subagent that is working is not.

```sh
prev=""; quiet=0
while :; do
  now=$(node <skill-dir>/scripts/watch-agents.mjs "$SUBAGENTS" --forbidden "$FORBID")
  key=$(printf '%s' "$now" | sed 's/ idle=[0-9]*s//g')
  if [ "$key" != "$prev" ]; then
    echo "$now"; prev="$key"; quiet=0
  else
    quiet=$((quiet + 1))
    [ $quiet -ge 4 ] && { echo "STALLED 2m+: $now"; quiet=0; }
  fi
  sleep 30
done
```

## What the watching is for, and what it is not

- The tracker, and confirming the brief holds. Move ▶ down the chain as the subagent goes.
- **A step the subagent says is done is a claim, not a tick.** Only evidence this session
  re-ran turns a node ✅. There is no glyph for claimed-and-unverified, so such a step
  stays ⬜ with the claim written into its label.
- **Watch, do not supervise.** Decisions the slice document leaves to the subagent are the
  subagent's. Reading its reasoning is for knowing where the work is, not for steering it.

## Two things that mislead

- **Commits lag badly.** A subagent may write five files and a passing test suite before
  its first commit, so a watch on the slice branch reports nothing through the phase you
  most want to see. Watch the transcript; the branch and the slice document's checkboxes
  confirm it afterwards.
- **A boundary check must match what is executed, not what is typed.** A subagent writing
  a runbook that mentions the forbidden command is not running it.
  `scripts/watch-agents.mjs` strips heredoc bodies before matching for exactly this; a
  hand-rolled grep will report the false breach.

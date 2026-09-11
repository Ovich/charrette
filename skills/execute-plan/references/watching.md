# Watching a subagent while it runs

Read when a slice is delegated. **A subagent returns once**; its transcript is the feed while it runs, and the feed is read by **digest**, never whole.

## The digest

```sh
node <skill-dir>/scripts/watch-agents.mjs <subagents-dir> \
  [--idle 300] [--forbidden '<regex>'] [--label <id>=<name> ...] [--json]
```

One line per live subagent:

```text
SL6 calls=86 idle=8s | Bash:pnpm run check | S6.7: removing CDK.
```

- **`--forbidden` is the brief's boundary as a regex**; a subagent that crosses it prints `BREACH xN`. Give it only what the brief forbids; a slice that touches nothing outward-facing needs none.
- **A boundary belongs to a brief, not to a run**: when two slices forbid different things, invoke it once per transcript with that slice's own pattern, never a union.
- **`--label` names each agent after its slice**, so the rows read as work rather than as hex.
- **`--json` emits `{id, name, calls, idle, breaches, signal, last, said}`** for building the table. `signal` is `WORKING`, `STALLED` or `BREACH`, a fact about the run; whether a subagent wants steering is this session's call.
- **Never open a transcript directly**, with `Read`, the shell, or the Agent tool's `.output` path; it exhausts the context this session needs for the plan. The transcripts are under `<claude home>/projects/<project>/<session id>/subagents/agent-<agent id>.jsonl`.

## The cadence

- **Probe every minute. Report only when something changed.**
- **Compare the line with its `idle=` counter stripped**; that number moves on the clock, not on progress.
- **Report a subagent that has not moved for three minutes**, even though nothing changed. A stall means waiting, looping, or dead.

```sh
prev=""; quiet=0
while :; do
  now=$(node <skill-dir>/scripts/watch-agents.mjs "$SUBAGENTS" --forbidden "$FORBID")
  key=$(printf '%s' "$now" | sed 's/ idle=[0-9]*s//g')
  if [ "$key" != "$prev" ]; then
    echo "$now"; prev="$key"; quiet=0
  else
    quiet=$((quiet + 1))
    [ $quiet -ge 3 ] && { echo "STALLED 3m+: $now"; quiet=0; }
  fi
  sleep 60
done
```

## The report

**A table, every time, from the first probe**, one row per subagent:

| Agent | Doing | In brief | Status |
|---|---|---|---|
| slice · step | from the digest | yes, or what strayed | on track · steer · stalled |

## What the watching is for

- **The tracker, and the brief holding.** Move ▶ down the chain as the subagent goes.
- **A step the subagent calls done stays ⬜**, the claim written into its label, until this session re-runs the evidence.
- **Watch, do not supervise.** Decisions the slice document leaves to the subagent are the subagent's; its reasoning is read to know where the work is, not to steer it.
- **Steer only a drift from the brief.** A `BREACH`, or work outside the slice document: one `SendMessage` to the subagent, naming the brief line it left and what to do instead; it arrives at its next tool round. A subagent that drifts again after one steer is stopped and re-dispatched with the brief amended. A finding is not a drift: a subagent that stops on one is done.

## What misleads

- **Commits lag.** A subagent may write five files and a passing suite before its first commit. Watch the transcript; the branch and the slice document's checkboxes confirm afterwards.
- **A boundary check matches what is executed, not what is typed.** A subagent writing a runbook that mentions the forbidden command is not running it; `watch-agents.mjs` strips heredoc bodies for this, and a hand-rolled grep reports the false breach.
- **A pattern with a drive letter in it never reaches the script.** Git Bash rewrites `C:/x/y` inside an argument into a Windows path, and the regex fails to compile; write `x[\/]y` instead. A pattern that matches reading the plan reports a false breach too: the brief forbids editing it, not opening it.

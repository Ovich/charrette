# The mandate

How the fields are asked, written and amended is the `orchestrate` skill's
`references/charter.md`. The charter section is the plan's *Mandate*; the one line sits under the tracker:
`mandate: seats 4 · phases 3 · verify at the end · run through · opus · medium · tests at the plan end`.

**`phases:`, `seats:` and `verify:` first, before the cut**, asked by the `write-plan` skill,
each in its own message, never folded into the approval of the defaults. The rules behind them
are the `write-plan` skill's `references/phases.md`.

**First show the run as one numbered table**, the same in every question that follows: each
phase, what merged work it waits on, its goal, who works in it (which seats, the validator, the
person), and every seat's role and area. Only the word *phase*: no wave, step or round. A `👤`
step or an orchestrator step stands as a row of its own, named as such. Then ask, one field per
message, each proposed from the work with its reason:

- **`phases:`** the table itself: is the ordering right, is any phase there without a merge to
  wait on, is any missing. A phase narrower than the seats is pointed out with the offer to
  merge or shrink it. An extra (a baseline, a cross-review, a gate) is offered with its cost and
  is in only on a yes.
- **`seats:`** the number of seats working at once, proposed as the widest phase: **4** for a
  normal plan, 2–3 small, 5–6 large; 1 when the work is strictly sequential.
- **`verify:`** `after each phase`, `at the end`, or `off`. Look for a `verify-<app>-<focus>`
  skill in the project's local skill folder; several: ask which one each validation phase runs.
  None: offer to create it (yes runs `verification-skill-create` before the first phase); no is
  `verify: off`. On, a validator seat runs it alone in its own phases, scoped by you to what the
  phases before merged. What the person adds to watch is written into the *Mandate* in their
  words. Any other special seat (a reviewer of every merge) is asked the same way.

**`pace:`**

1. **run through** (recommended): at the plan's end, mark the pull request ready, merge once the check re-run here exits 0 (and the verification passes, where there is one), report.
2. **run through, the person merges**: push, mark ready, report. Never merge.
3. **stop at each phase**: close the phase, report, name what is next, wait.

Under any pace, a slice marked `👤` stops before it starts, and a finding that changes the next
phase is a pause.

**`model:`** **opus** (recommended).

**`effort:`** `low | medium | high | xhigh | max`: **medium** (recommended).
The design is the plan's, but the subagent shapes the code around its slice and names what it
adds. How effort reaches a subagent: the `orchestrate` skill's *Dispatch*.

**`tests:`** when the tests the plan names get written. The testing prompt each answer puts in
the brief: `references/tests.md`.

1. **at the plan end** (recommended): slices write no tests; a last phase, `· the tests`, one slice per seat, writes them all. `aiview tracker check` refuses this answer until the tracker carries that phase.
2. **at the slice end**: each slice writes its own tests after its code.
3. **none**: no tests written in this plan.

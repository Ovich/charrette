# The mandate

How the fields are asked, written and amended is the `orchestrate` skill's
`references/charter.md`. The charter section is the plan's *Mandate*; the one line sits under the tracker:
`mandate: mode classic · run through · one for the plan · delegated · opus · medium · tests at the plan end · verify off`.

**`mode:`** first. Asked by the `write-plan` skill before the cut, since the plan differs by
mode; asked here only for a plan that predates the field, where a plan cut for classic stays
classic.

Both are recommended, each for its work; recommend the one the plan fits, first.

1. **swarm**, recommended when the work has room for two seats or more at once: N seats work the plan phase by phase, every seat at once in each phase,
   coordinating on the board of the `swarm` skill. The plan must have been cut for it (the
   `write-plan` skill's `references/swarm.md`).
2. **classic**, recommended for a small or strictly sequential change: slices one after another,
   forks proved apart and joined at the end.

**`seats:`** swarm mode only, asked with `mode:`: the number of seats, and any special seat.
Propose it from the work, **4** for a normal plan, 2–3 small, 5–6 large, e.g. `seats 4 + validator`.

**`pace:`**

1. **run through** (recommended): at each pull request boundary, mark ready, merge once the check re-run here exits 0 (and the verification passes, where there is one), report, continue.
2. **run through, the person merges**: push, mark ready, report, continue. Never merge.
3. **stop at each slice**: finish, report, name what is next, wait.

Under any pace, a slice marked `👤` stops before it starts, and a finding that changes the next
slice is a pause.

**`pull requests:`**

1. **one for the plan** (recommended): one branch off `main`, forks merged into it at the join, one merge at the end.
2. **one per slice**, off `main`: each slice lands on its own and leaves `main` green.

**`steps:`**

1. **delegated** (recommended): a subagent per slice runs the `execute-slice` skill.
2. **inline**: this session does the work as that skill says. For small plans or a person who wants to watch.

**`model:`** when delegated: **opus** (recommended).

**`effort:`** when delegated, `low | medium | high | xhigh | max`: **medium** (recommended).
The design is the plan's, but the subagent shapes the code around its slice and names what it
adds. How effort reaches a subagent: the `orchestrate` skill's *Dispatch*.

**`tests:`** when the tests the plan names get written. The testing prompt each answer puts in
the brief: `references/tests.md`.

1. **at the plan end** (recommended): slices write no tests; a last slice writes them all. `aiview tracker check` refuses this answer until the tracker carries that test slice: a subgraph titled `… · the tests`, last before the `👤` checks, blocked by every other slice, its done-when the full check at 0. With `one per slice`, tell the person the pair merges untested code and ask for one to move. Its document is written through the `write-slice` skill once every other slice is done. In `mode: swarm` it is the tests phase, one slice per seat (the `write-plan` skill's `references/swarm.md`).
2. **at the slice end**: each slice writes its own tests after its code.
3. **none**: no tests written in this plan.

**`verify:`** `each slice | slot done | off`. Look for a `verify-<app>` skill in the project's
local skill folder. It exists: ask "Verify after each slice (recommended), or once the slot is
done?". It does not: ask whether to create one; yes runs `verification-skill-create` before the
first slice, then the first question; no is `verify: off`. In `mode: swarm`, `each slice` means once per phase, and the validator seat runs it, alone in its phase.

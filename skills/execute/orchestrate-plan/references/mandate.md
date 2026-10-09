# The mandate

Ask what is open in one message, the recommended answer first. Write the answers into the
plan's *Mandate* section as `field: value` lines, and into the one line under the tracker:
`mandate: mode classic · run through · one for the plan · delegated · opus · medium · tests at the plan end · verify off`.
An amendment mid-run overwrites its field in both places, the decision's id beside it
(`pace: run through, the person merges (D41)`), and reaches the next brief only.

**`mode:`** first. Asked by the `write-plan` skill before the cut, since the plan differs by
mode; asked here only for a plan that predates the field, where a plan cut for classic stays
classic.

1. **classic** (recommended): slices one after another, forks proved apart and joined at the end.
2. **swarm**: every slice dispatched at once, the runners coordinating on the board of the
   `swarm` skill. The plan must have been cut for it (the `write-plan` skill's `references/swarm.md`).

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
adds. Effort is not an `Agent` parameter: it is carried by the subagent definition the dispatch
names (`effort:` in its frontmatter). A dispatch naming none inherits the session's level.

**`tests:`** when the tests the plan names get written. The testing prompt each answer puts in
the brief: `references/tests.md`.

1. **at the plan end** (recommended): slices write no tests; a last slice writes them all. `aiview tracker check` refuses this answer until the tracker carries that test slice: a subgraph titled `… · the tests`, last before the `👤` checks, blocked by every other slice, its done-when the full check at 0. With `one per slice`, tell the person the pair merges untested code and ask for one to move. Its document is written through the `write-slice` skill once every other slice is done.
2. **at the slice end**: each slice writes its own tests after its code.
3. **none**: no tests written in this plan.

**`verify:`** `each slice | slot done | off`. Look for a `verify-<app>` skill in the project's
local skill folder. It exists: ask "Verify after each slice (recommended), or once the slot is
done?". It does not: ask whether to create one; yes runs `verification-skill-create` before the
first slice, then the first question; no is `verify: off`.

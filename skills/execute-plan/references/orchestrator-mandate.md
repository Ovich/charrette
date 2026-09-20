# The orchestrator's mandate

Ask all of it in one message, the recommended answer first, and write the answers into
the plan's *Mandate* section as `field: value` lines, then into the one line under the
tracker (`references/tracker.md`). **The recommended answers are the fast and unattended
ones**: a person who wants to watch, to merge or to audit says so here.

**The section states the mandate in force.** An amendment mid-run overwrites its field,
the decision's id beside it (`pace: run through, the person merges (D41)`), and the line
under the tracker follows. Left as a decisions row alone, a resuming session reads the
old field and merges.

**Autonomy** (`pace:`):

1. **run through** (recommended): at each boundary the pull requests give, mark ready, merge once the check is green, and the verification where the mandate has one, report, continue.
2. **run through, the person merges**: push, mark ready, report, continue. Never merge.
3. **stop at each slice**: finish, report, name what is next, wait. The person merges.

Whichever it is, a slice marked `👤` stops before it starts, and a finding that changes
the next slice is a pause.

**Pull requests** (`pull requests:`):

1. **one for the plan** (recommended): one branch off `main`, slices commit on it, forks merge into it at the join, one review and one merge at the last slice.
2. **one per slice**, off `main`: every slice lands on its own and leaves `main` green, complete or inert. For a plan whose slices are worth having before the whole.

**Steps** (`steps:`):

1. **delegated** (recommended): a fresh subagent per slice runs `execute-slice`.
2. **inline**: the orchestrator's session does the work. For small plans, judgment-heavy slices, or a person who wants to watch.

**Model**, when delegated (`model: opus | <other>`): the model every slice's subagent
runs on. **Opus** (recommended).

**Tests** (`tests:`): when the implementer writes the tests a slice names. What is tested,
and at which seams, is the plan's testing strategy and is not asked here. The procedure
of each is the `execute-slice` skill's, one reference per answer.

1. **at the plan end** (recommended), the fast lane: the slices write code only, and a last slice writes every owed test and repairs the broken ones against the code as it ended, from the cases the plan named. No test is rewritten because a later slice moved what it pinned.
2. **at the slice end**: the code first, held by the suite as it stands, then the slice's tests in one pass.
3. **commit only at green**: test-driven, one named case at a time, a commit only when the suite is green, so a failed attempt is dropped back to the last good state. No refactor phase.
4. **commit per phase (red/green/refactor)**: test-driven with a commit at each phase. For a run someone will audit commit by commit; the slowest.

**Choosing at the plan end changes the plan, and whoever asks the mandate makes the change
before anything else**: `write-plan` closing its interview, the orchestrator filling a field
left open, or an amendment mid-run. A mandate that says it over a plan with no test slice
runs every slice untested to the end, and `aiview tracker check` refuses it.

1. **Refuse it with one pull request per slice**: the pair merges untested code. Say why, and ask for one of the two to move.
2. **Draw the test slice in the tracker**: a subgraph titled `… · the tests`, last before the plan's `👤` checks, blocked by every other slice, its done-when the full check at 0, and a dotted edge from every other slice's last step, `owes: its tests`.
3. **Have the slice documents follow**, through the `write-slice` skill: the test slice's own document, and in every other slice the proof that stands in for its tests. Documents already written are amended, never left.
4. **Amended mid-run, it holds for the slices not yet started.** A slice already done keeps the tests it wrote.

**During the run:**

- **A tick rests on the slice's proof**, re-run in this session. A slice that names none is not dispatched.
- **Before the test slice is dispatched, its document is filled**: the tests each return listed as broken go under its heading *Tests the slices broke*, and it is read again against any slice document amended mid-run.

A slice whose nature wants another rhythm names it in its heading, and the brief carries
that one. Test && commit || revert is not offered: one typo reverts a multi-file change,
and the agent regenerates it in a loop.

**Verification** (`verify: each slice | slot done | off`), decided by a lookup first: a
`verify-<app>` skill in the project's local skill folder.

It exists: "This project has a verification skill. Enable continuous verification?"

1. **After each slice** (recommended).
2. **After the slot is done.**

It does not: "This project has no verification skill. Create one?" Yes runs
`verification-skill-create` before the first slice, then the question above is asked. No is `verify: off`.

# The orchestrator's mandate

Ask all of it in one message, the recommended answer first. Write the answers into the
plan's *Mandate* section as `field: value` lines, and into the one line under the tracker
(`references/tracker.md`).

**An amendment mid-run overwrites its field**, the decision's id beside it
(`pace: run through, the person merges (D41)`), in both places.

**Autonomy** (`pace:`):

1. **run through** (recommended): at each boundary the pull requests give, mark ready, merge once the check is green, and the verification where the mandate has one, report, continue.
2. **run through, the person merges**: push, mark ready, report, continue. Never merge.
3. **stop at each slice**: finish, report, name what is next, wait. The person merges.

Under any pace, a slice marked `👤` stops before it starts, and a finding that changes the
next slice is a pause.

**Pull requests** (`pull requests:`):

1. **one for the plan** (recommended): one branch off `main`, slices commit on it, forks merge into it at the join, one merge at the last slice.
2. **one per slice**, off `main`: every slice lands on its own and leaves `main` green, complete or inert. For a plan whose slices are worth having before the whole.

**Steps** (`steps:`):

1. **delegated** (recommended): a fresh subagent per slice runs `execute-slice`.
2. **inline**: the orchestrator's session does the work, as the `execute-slice` skill says. For small plans, judgment-heavy slices, or a person who wants to watch.

**Model**, when delegated (`model: opus | <other>`): the model every slice's subagent
runs on. **Opus** (recommended).

**Tests** (`tests:`): when the implementer writes the tests a slice names. The procedures
are the `execute-slice` skill's, one reference per answer.

1. **at the plan end** (recommended), the fast lane: the slices write code only; once they are done, a last slice writes every owed test and repairs the broken ones. No test is rewritten because a later slice moved what it pinned.
2. **at the slice end**: the code first, then the slice's tests in one pass.
3. **commit only at green**: test-driven, one named case at a time, a commit only when the tests at the slice's seams are green, the full check once at the slice's end. No refactor phase.
4. **commit per phase (red/green/refactor)**: test-driven, a commit at each phase, the full check once at the slice's end. For a run audited commit by commit; the slowest.

A slice that departs from the mandate's names its own `tests:` in its heading, and the
brief carries that one. Test && commit || revert is not offered: one typo reverts a
multi-file change.

**Choosing at the plan end**: whoever asks the mandate does this before anything else,
`write-plan` closing its interview or the orchestrator filling or amending the field.
`aiview tracker check` refuses the mandate without its test slice.

1. **Refuse it with one pull request per slice**: tell the person the pair merges untested code, and ask for one of the two to move.
2. **Draw the test slice in the tracker**: a subgraph titled `… · the tests`, last before the plan's `👤` checks, blocked by every other slice, its done-when the full check at 0, and a dotted edge from every other slice's last step, `owes: its tests`.
3. **Through the `write-slice` skill, give every other slice's document the proof that stands in for its tests**, amending documents already written. The test slice gets no document yet.
4. **Amended mid-run, it holds for the slices not yet started.**

During the run:

- **Tick a slice on its proof, re-run in this session.** Dispatch no slice that names none.
- **When every other slice is done, have the test slice's document written**, through the `write-slice` skill, then dispatch it.

**Verification** (`verify: each slice | slot done | off`), decided by a lookup first: a
`verify-<app>` skill in the project's local skill folder.

It exists: "This project has a verification skill. Enable continuous verification?"

1. **After each slice** (recommended).
2. **After the slot is done.**

It does not: "This project has no verification skill. Create one?" Yes runs
`verification-skill-create` before the first slice, then the question above is asked. No is `verify: off`.

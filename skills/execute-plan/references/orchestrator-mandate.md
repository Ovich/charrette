# The orchestrator's mandate

Ask all of it in one message,
the recommended answer first, and write the answers into the plan's *Mandate* section
as `field: value` lines.

**Autonomy** (`pace: run through | stop at each slice`):

1. **Run through** (recommended): at each slice boundary, merge, report, continue.
2. **Stop at each slice**: finish, report, name what is next, wait. The person merges.

Either way, a slice marked `👤` stops before it starts, and a finding that changes the
next slice is a pause.

**Pull requests** (`pull requests: one per slice | one for the plan`):

1. **One per slice** (recommended), off `main`: every slice lands on its own and leaves `main` green, complete or inert.
2. **One for the plan**: one branch, slices commit on it, forks merge into it at the join, and it merges to `main` at the last slice on the person's word. For work that is green only when whole.

**Steps** (`steps: delegated | inline`):

1. **Delegated** (recommended): a fresh subagent per slice runs `execute-slice`.
2. **Inline**: the orchestrator's session does the work. For small plans, judgment-heavy slices, or a person who wants to watch.

**Model**, when delegated (`model: opus | <other>`): the model every slice's subagent
runs on. **Opus** (recommended).

**Verification** (`verify: each slice | slot done | off`), decided by a lookup first: a
`verify-<app>` skill in the project's local skill folder.

It exists: "This project has a verification skill. Enable continuous verification?"

1. **After each slice** (recommended).
2. **After the slot is done.**

It does not: "This project has no verification skill. Create one?" Yes runs
`verification-skill-create` before the first slice, then the question above is asked. No is `verify: off`.

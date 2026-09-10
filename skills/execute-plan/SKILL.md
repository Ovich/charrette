---
name: execute-plan
description: Use when carrying out an implementation plan the person has already approved, whether starting it or resuming it in a later session, and the tracker in it has to stay true while the work happens. Not for producing the plan (write-plan) and not for reviewing the result.
---

# Execute a plan

A plan that has been agreed is a mandate, not a queue of items to seek permission for one
at a time. Run it: do the steps, keep the tracker true, and stop only where a person
adds something.

## What this skill takes as input

**A plan document whose diagram is the tracker**, every step with a done-when that can
be checked. `write-plan` (`../write-plan/SKILL.md` in this collection) produces it, `aiview`
(`../aiview/SKILL.md` in this collection) is where it lives and renders, and its protocol
(glyphs, state node, forks, layout) is `references/tracker.md`: read it before the first
edit to the plan.

**Before running a single step, open the plan via the `aiview` skill
(`../aiview/SKILL.md`)**, in every session that picks the plan up. Tell the person the
URL it prints, so they watch the tracker move while the work happens.

**If the plan has no tracker, a slice with no slice document, or a slice whose done-when
no test can express, do not start.** Say so, and either add what is missing or go
back and finish the plan. A plan whose diagram
describes a state the repository has moved past is a deviation, not a starting
condition: reconcile it first, and say what you found.

## Two questions, asked once

Before the first step of a run, ask both in one exchange, the recommended answer first
and marked so. Record both in the plan's state node, so a session that resumes the plan
reads them and asks again nothing.

**The pace** (`pace: run through | stop at each slice`):

1. **Run through** (recommended): at each slice boundary, review and merge the
   slice's pull request, report what happened and what is next, then continue. Stop
   only for the three pauses below and at a slice marked `👤`.
2. **Stop at each slice**: finish the slice, report, name what is next, and wait. The
   person reviews and merges the pull request; the next slice starts on their word.

Under either pace a slice whose findings change the next slice is the first pause
below, and a slice marked `👤 decision` or `👤 design review` stops before it starts.

**Who does the slices** (`steps: delegated | inline`, the field the tracker tool
checks):

1. **Delegated** (recommended): a fresh subagent per slice, running `execute-slice`
   (`../execute-slice/SKILL.md` in this collection), so this session's context stays
   the plan and the tracker rather than the diffs.
2. **Inline**: this session does the work itself. Right for a small plan, for a slice
   that is mostly judgment, and when the person wants to watch the work happen.

## The orchestrator

This session keeps the tracker, briefs, verifies and merges, whichever answer it got.
Two kinds of work stay its own under either:

- **What needs the whole run in one head.** A README the plan earned, a decision
  register row, the state node.
- **The verification of every return.** A subagent's report is a claim. The tick rests
  on what this session observed: the command re-run, the failing output read, the test
  file confirmed unedited by its own commit in the log. It reads evidence, not diffs.

Under `steps: delegated`, each slice goes to a fresh subagent. A subagent never edits the
tracker.

**Watch it while it runs.** A subagent returns once, at the end, so a session that only
reads the return ticks the whole slice in one batch and leaves the tracker blind for the
length of the work.

**Probe every 30 seconds, and report only when something changed.** One row per running
subagent — what it is doing, whether it is still inside its brief, and whether it is on
track or wants steering — as a table when there is more than one. Move ▶ down the chain as
it goes. A subagent that has not moved for two minutes is reported too: a stall is news,
where a repeated poll of the same state is noise.

Read its transcript by digest, never whole — the file is large enough to swamp this
session. `references/watching.md` has the digest and the cadence. Two rules keep the
watching honest:

- **A step the subagent says is done is a claim, not a tick.** ▶ marks where the work is;
  only evidence this session re-ran turns a node ✅. There is no glyph for claimed-and-
  unverified, so such a step stays ⬜ with the claim written into its label.
- **Watch, do not supervise.** The digest is for the tracker and for the brief holding.
  Decisions the slice document leaves to the subagent stay the subagent's.

A brief is the slice document's path, the workspace, its branch and base, the command
that prepares the workspace, and the pull request it opens (below). Nothing else: the
document is the context, and a fact repeated in the brief is a fact that drifts.

**One slice, one agent, one return, and the blockers are checked before the dispatch.**
That check is yours because the tracker is yours: a subagent has no reason to open the
plan, and a blocker outside it — a stack deleted from the account, a person's account
created — has no glyph to read anyway. Dispatch nothing whose blockers are unmet.

A subagent that stops on a finding has done its job: the criteria already passed, the
document named something that does not exist, or the work turned up a dependency nobody
wrote down. Fix the plan or the document. Do not re-brief it past what it found.

## Branches and pull requests

One branch and one pull request per slice. The branch is cut from `main` when the slice
starts, the pull request is opened as a draft on the first commit, and the work lands in
small commits pushed as they happen, so the diff can be read while it grows. As soon as it
exists, and again on every push, the orchestrator opens it in the person's browser
(`gh pr view <n> --web`), so the diff is in front of them from the first commit and
stays current without their asking. At the close the pull request is
marked ready, reviewed and merged, by the person or by the orchestrator as the pace
says, and the next slice branches off the merged result.

A merged slice leaves the deployed environment green: complete end to end, or inert
where it is not yet complete, and the plan says which. When `main` must not move at all,
the plan names a plan branch instead and the slices return to it; that is the plan's
choice, never the run's.

Slices the plan forks run at once, one subagent each, in their own workspaces. Read
`references/workspaces.md` before the first fork: the traps in basing, installing and
removing a workspace.

## The three pauses

**A deviation that needs a decision.** Stop when the *choice* is the human's: a step
that cannot be done as written, a finding that invalidates a decision the plan rests
on, a failure whose repair has real options, work that is plainly out of the plan's
scope. The rest you absorb and draw (below). A finding that sends the work back to
the board is the loop working, not the plan failing: say what was learned and stop.

**Verification you cannot perform.** A browser flow, a real sign-in, an approval from
another team, anything needing eyes or a click. Do everything mechanical first, probe
what can be probed, deploy what needs deploying, so the human's part is only the part
that needs them, and say exactly what to look at.

**An action that leaves the machine and does not undo cheaply.** A production deploy, a
migration against shared data, anything destructive or outward-facing. Approval for one
of these is never approval for the next.

## What a pause has to contain

The tracker current *before* the pause: a pause is a handoff, and the session may end
there. Then: what happened, the evidence, the decision that is wanted, the options, and
a recommendation. Then **tell them what to do**: the actions and verifications that are
theirs alone, numbered in the order they take them, each with the exact command and what
a good result looks like. Recommend one where there is a choice. A pause that ends
without a list of what the person does next is a report, not a handoff.

## What not to pause for

Per-step sign-off. Verification you can do yourself. Naming, structure, tool choice. A
commit on a branch already agreed. Reading documentation. A failure you understand and
can fix, whose fix changes nothing anyone decided.

## Stop the line

**If the same step fails twice for unrelated reasons, stop and report both together.**
The third fix is usually built on the misunderstanding the first two reveal. Likewise
when a step turns out to be several: absorb the first surprise, and if a second arrives
in the same step, the step was mis-scoped.

## Keeping the tracker while you work

- **Tick as you go, never in a batch.** A node turns ✅ only when its own done-when is
  met, and the evidence goes into the step: what was observed, not "worked". The
  failing run and the passing run are the evidence, per `write-code`
  (`../write-code/SKILL.md` in this collection). For a step that serves a user story,
  its acceptance criterion observed.
- **Update it before every handoff**: a question, an approval request, the end of a
  turn. Whatever the tracker does not say by then is lost if the session ends.
- **Deviations are drawn, not narrated.** Work the plan does not list becomes a node
  *before* it is done. An unforeseen dependency becomes an arc, and if it waits on
  someone else, a ⏸ node naming what was asked for and when. A step that dissolves is ✖
  with the reason, never deleted. An answered gate shows which way was taken. A
  deviation that decides a module, an interface, a schema, a contract or an
  architecture adds a row to the plan's implementation decisions register.
- **A deviation that becomes a slice gets its slice document before it runs**, per
  `write-plan` (`../write-plan/SKILL.md` in this collection). A slice with no document
  cannot be delegated.
- **A step you paused inside was too coarse.** Split it where the pause fell.
- **Finished steps are rewritten as what happened**: past tense, what was done, what it
  found, what that changed. Keep the values, versions, commands and wrong turns worth
  learning from; drop the framing that only mattered while the step was ahead.
- **The last step done says so upward.** When the project has a roadmap
  (`../roadmap/SKILL.md` in this collection), the run's close says the plan finished
  and the roadmap may need a redraw. The plan finishing is not the slot landing: that
  the person confirms there, with evidence.

## Red flags

| Thought | Reality |
|---|---|
| "I'll check with them before starting the next step" | The plan was the approval. Report at the slice boundary, and stop there only if the pace or a `👤` mark says so. |
| "The subagent can update the tracker when it is done" | It cannot see the other arms. One writer, this session. The return is evidence, the tick is yours. |
| "The return says the suite passed, that's the tick" | A tick on a run this session never saw is hearsay. Re-run it. |
| "These two slices look independent, I'll run them in parallel" | Only if the plan draws the fork. What makes two slices one arm is `references/tracker.md`'s to say. |
| "It's a small deviation, I'll mention it at the end" | Draw it, then do it. A session that dies mid-way leaves a plan that does not know the work exists. |
| "They said yes to deploying yesterday" | Outward-facing actions are approved once each, not once forever. |
| "I'll ask what they want to do" | Bring the options and a recommendation. An open question hands the work back rather than the decision. |
| "The step is done, I'll write it up later" | Later is after the context is gone. The evidence goes in when it is observed. |
| "I'll add a line to the state node" | You overwrite its fields. A node you append to becomes a log, and a log of states is not a state. |

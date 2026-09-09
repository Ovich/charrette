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
be checked. The `write-plan` skill produces it, the `aiview` skill is where it lives
and renders, and its protocol (glyphs, state node, branches, layout) is
`references/tracker.md`: read it before the first edit to the plan.

**Before running a single step, open the plan via the `aiview` skill
(`../aiview/SKILL.md`)**, in every session that picks the plan up. Tell the person the
URL it prints, so they watch the tracker move while the work happens.

**If the plan has no tracker, steps without a done-when, or a slice that does not
open on a failing test, do not start.** Say so, and either add what is missing or go
back and finish the plan. A plan whose diagram
describes a state the repository has moved past is a deviation, not a starting
condition: reconcile it first, and say what you found.

## Two questions, asked once

Before the first step of a run, ask both in one exchange, the recommended answer first
and marked so. Record both in the plan's state node, so a session that resumes the plan
reads them and asks again nothing.

**The pace** (`pace: run through | stop at each slice`):

1. **Run through** (recommended): at each slice boundary, report what happened and
   what is next, then continue. Stop only for the three pauses below and at a slice
   marked `👤`.
2. **Stop at each slice**: finish the slice, report, name what is next, and wait.

Under either pace a slice whose findings change the next slice is the first pause
below, and a slice marked `👤 decision` or `👤 design review` stops before it starts.

**Who does the steps** (`steps: delegated | inline`):

1. **Delegated** (recommended): a fresh subagent per step that writes to the
   repository, so this session's context stays the plan and the tracker rather than the
   diffs. The price is the briefing, and a step that has to be told the whole slice
   costs more to delegate than to do.
2. **Inline**: this session does the steps itself. Right for a small plan, for steps
   that are mostly judgment, and when the person wants to watch the work happen.

The answer sets the default, not a rule: under either answer the orchestrator keeps the
steps named below for itself.

## Who does the steps

This session is the orchestrator whichever answer it got: it keeps the tracker, reads
the dependency graph, briefs, verifies and merges. Three kinds of step are always its
own, because delegating them costs more than it saves or turns the evidence into
hearsay:

- **A step that only observes.** Running the suite and recording the failing run,
  checking a deployed address, reading a page. The orchestrator has to see these
  anyway to tick the node.
- **A step whose input is the whole slice.** A README the slice earned, a decision
  register row, anything needing everything the run has learned in one head.
- **The verification of every return.** A subagent's report is a claim. The tick rests
  on what this session observed: the command re-run, the failing output read, the test
  file confirmed unedited by its own commit in the log.

Under `steps: delegated`, everything that writes to the repository goes to a fresh
subagent: one node per subagent, never two, since the tracker holds one ▶ at a time.
Where the plan draws a fork, its branches run at once, one subagent per branch, one
`aiview pending` card each, ticked as its return lands, the join verified here.

The orchestrator reads evidence, not diffs: it runs commands, reads output, and opens
the file a return names when the claim needs checking, but it does not review the whole
change.

A brief has four slots, in this order:

1. **Where the plan is**: its aiview path and the step's node id.
2. **The step's jurisdiction**: its node text and done-when, and nothing beyond it.
3. **The facts this session has established**, given as facts: the branch, the commands
   that verify, what an earlier step found, the conventions file to obey.
4. **The return contract**: what changed and where, the evidence its own step produces
   (a test-writing step returns the failing run, an implementing step the passing run),
   and anything found that the plan did not predict.

A subagent never edits the tracker. This session is its single writer.

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
a recommendation.

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
  met, and the evidence goes into the step: what was observed, not "worked". Test
  first, always: the test is written and run before the implementation, the step
  records the failing run, the implementation is written to pass it, and the step
  records the passing run. A test that never failed proves nothing. For a step that
  serves a user story, its acceptance criterion observed.
- **Update it before every handoff**: a question, an approval request, the end of a
  turn. Whatever the tracker does not say by then is lost if the session ends.
- **Deviations are drawn, not narrated.** Work the plan does not list becomes a node
  *before* it is done. An unforeseen dependency becomes an arc, and if it waits on
  someone else, a ⏸ node naming what was asked for and when. A step that dissolves is ✖
  with the reason, never deleted. An answered gate shows which branch was taken. A
  deviation that decides a module, an interface, a schema, a contract or an
  architecture adds a row to the plan's implementation decisions register.
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
| "The subagent can update the tracker when it is done" | It cannot see the other branches. One writer, this session; the return is evidence, the tick is yours. |
| "The step just runs the tests, I'll delegate it like the rest" | A step that only observes is the orchestrator's, whatever the answer to the second question. A tick on a run this session never saw is hearsay. |
| "These two steps look independent, I'll run them in parallel" | Only if the plan draws the fork. Two steps that touch one file are one branch, whatever they look like. |
| "It's a small deviation, I'll mention it at the end" | Draw it, then do it. A session that dies mid-way leaves a plan that does not know the work exists. |
| "They said yes to deploying yesterday" | Outward-facing actions are approved once each, not once forever. |
| "I'll ask what they want to do" | Bring the options and a recommendation. An open question hands the work back rather than the decision. |
| "The step is done, I'll write it up later" | Later is after the context is gone. The evidence goes in when it is observed. |
| "I'll write the implementation, then the test" | The test comes first and is seen failing. A test written after the code fits the code, not the done-when. |
| "I'll add a line to the state node" | You overwrite its fields. A node you append to becomes a log, and a log of states is not a state. |

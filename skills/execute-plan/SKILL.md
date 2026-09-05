---
name: execute-plan
description: Use when carrying out an approved implementation plan: how much to do without asking, when to stop and ask, what a pause has to say, and how the tracker is kept while the work happens. Covers running the plan and absorbing what the work discovers. Not for producing the plan (that is the brainstorm skill) and not for reviewing the result.
---

# Execute a plan

A plan that has been agreed is a mandate, not a queue of items to seek permission for one
at a time. Asking after every step converts the human into a clock: they approve, wait,
approve again, and learn nothing they did not already know from the plan.

**So: run the plan.** Do the steps, keep the tracker true, and stop only where a person
adds something.

## What this skill takes as input

**A plan document whose diagram is the tracker.** Not a description of intent, not a list of
tasks in a message: the file, with a phasing diagram in it, where every step is a node
carrying a status glyph and one node , connected to nothing , holds the resume state. Each
step has a done-when that can be checked. The `brainstorm` skill produces this; the
`aiview` skill is where it lives and renders.

**Before running a single step, open the plan via the `aiview` skill
(`../aiview/SKILL.md`).** That one gesture guarantees both halves of the working surface:
the viewer is running , it starts one when none is , and the plan itself is the document
on screen, registered and displayed in the same call. Do it in every session that picks
the plan up, not only the first; it is idempotent. Tell the user the URL it prints, so
they can watch the tracker move while the work happens.

That diagram is the working surface. It says which step is next, what is blocked and on
whom, and where the work stood when someone last stopped , which is what makes the plan
runnable by a session that was not there when it was written.

**If the plan has no such diagram, do not start.** A plan without a tracker cannot record
progress, so a session that ends mid-phase leaves nothing behind but a diff. Say so, and
either add the tracker (the rules are in `brainstorm`) or go back and finish the plan. The
same applies to a plan whose steps have no done-when: "run it" then has no meaning, because
nothing says when a step is finished.

Being handed a plan that is stale , its diagram describing a state the repository has moved
past , is a deviation, not a starting condition. Reconcile it first, and say what you found.

## The four pauses

**A phase boundary.** Finish the phase, report what happened, name what is next , and stop
there. Phases exist because their ends are the moments worth re-deciding at: what the work
found may change what the next phase should be.

**A deviation that needs a decision.** Reality departs from a plan constantly; most of it
you absorb and keep going (see below). Stop when the *choice* is the human's: a step that
cannot be done as written, a finding that invalidates a decision the plan rests on, a
failure whose repair has real options, work that is plainly out of the plan's scope.

**Verification you cannot perform.** A browser flow, a real sign-in, an approval from
another team, anything needing eyes or a click. Do everything mechanical first , probe what
can be probed, deploy what needs deploying , so the human's part is only the part that
needs them, and say exactly what to look at.

**An action that leaves the machine and does not undo cheaply.** A production deploy, a
migration against shared data, anything destructive or outward-facing. Approval for one of
these is never approval for the next.

## What a pause has to contain

The tracker current *before* the pause , a pause is a handoff, and the session may end
there. Then: what happened, the evidence, the decision that is wanted, the options, and a
recommendation. A pause that only says "what next?" wastes the exchange it interrupted.

## What not to pause for

Per-step sign-off. Verification you can do yourself. Naming, structure, tool choice. A
commit on a branch already agreed. Reading documentation. A failure you understand and can
fix, whose fix changes nothing anyone decided.

## Stop the line

**If the same step fails twice for unrelated reasons, stop and report.** One failure is
work; two is a sign the step was understood wrongly, and the third fix is usually built on
the misunderstanding. Report both failures together , the pattern is more useful than
either alone.

Likewise when a step turns out to be several: absorb the first surprise, and if a second
arrives in the same step, that is the step telling you it was mis-scoped.

## Keeping the tracker while you work

The plan's diagram is the tracker; its protocol, the glyphs, the state node, one column,
is `references/tracker.md`. Running the plan is what keeps it true:

- **Tick as you go, never in a batch.** A node turns ✅ only when its own done-when is met,
  and the evidence goes into the step: what was observed, not "worked". A tracker updated
  once at the end of a session was wrong for the whole session.
- **Update it before every handoff** , a question, an approval request, the end of a turn.
  Whatever the tracker does not say by then is lost if the session ends. A question asked
  over a stale tracker wastes the answer: the human corrects the record before addressing
  the question.
- **The state node has fixed fields, and you overwrite them.** It describes *now*, never
  how now was arrived at. A line that is history belongs in the step that produced it.

- **Deviations are drawn, not narrated.** Work the plan does not list becomes a node
  *before* it is done. An unforeseen dependency becomes an arc, and if it waits on someone
  else, a ⏸ node naming what was asked for and when. A step that dissolves is ✖ with the
  reason, never deleted. An answered gate shows which branch was taken.
- **A step you paused inside was too coarse.** Split it where the pause fell. A step whose
  first half is done and second half is not cannot be marked, and an unmarkable step is a
  hole in the tracker.
- **Finished steps are rewritten as what happened** , past tense, what was done, what it
  found, what that changed. Keep the values, versions, commands and wrong turns worth
  learning from; drop the framing that only mattered while the step was ahead.

## Red flags

| Thought | Reality |
|---|---|
| "I'll check with them before starting the next step" | The plan was the approval. Report at the phase boundary, not at every step. |
| "It's a small deviation, I'll mention it at the end" | Draw it, then do it. A session that dies mid-way leaves a plan that does not know the work exists. |
| "This failed, I'll try another approach" , twice | Two unrelated failures in one step means the step was misunderstood. Stop and report both. |
| "They said yes to deploying yesterday" | Outward-facing actions are approved once each, not once forever. |
| "I'll ask what they want to do" | Bring the options and a recommendation. An open question hands the work back rather than the decision. |
| "The step is done, I'll write it up later" | Later is after the context is gone. The evidence goes in when it is observed. |
| "I'll add a line to the state node" | You overwrite its fields. A node you append to becomes a log, and a log of states is not a state. |

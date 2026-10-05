---
name: validate-delivery
description: "Use when what a plan delivered is to be validated with the person and reworked live after the plan closes: on execute-plan's recommendation, or when the person asks to try or adjust together what was just delivered. Produces the setup (the app on its state, the workbenches open) and the changes the session agrees. Not for the autonomous check of user stories (the project's verify skill), building a workbench from nothing (create-workbench), or remarks on a slice mid-run (execute-plan)."
---

# Validate a delivery

**The setup ready fast, then the work done.** The person's time goes to judgment and
rework only. Anything that does not serve that is out: no document of the validation,
no report. A slice or a decision it makes is still kept the `execute-plan` skill's way.

**The setup is designed at high effort.** What to look at, on which tool, which bench
to extend or make: when the session runs lower, say once before starting that
`/effort high` suits it. The mandate's effort is the subagents', and they keep it.

## The setup, before the person is called

**The delivery is the plan's branch at its head.** The app runs on it, and every setup
change is committed on it, even when a later plan is already stacked on top. What landed
is read from the plan's tracker and the branch's commits; where they disagree, the
branch holds.

1. **The app, through the verification layer.** The project's skill that runs the app
   and validates on its own: its `verify-<app>` skill, else the one the plan's mandate
   names for validating slices. What it cannot do (a state it cannot restore) is done by
   the quickest workaround now, added to that skill, and said in the message.
2. **What the changes made stale, current.** Recordings, seeds, fixtures, as the
   project's rules say. A stale one breaks in front of the person, mid-session. A step
   that needs the person's word (a recording to judge) is asked first, in a short
   message, and what is built from it (a seed captured from that recording) waits for
   the answer.
3. **The state to look at, restored, and the delivered slices' checks run**, the ones
   that are commands. A walk is the person's now. A red check is said in the message,
   not fixed before it.
4. **A tool for each delivered part.** The product's own screens in the watched
   browser. A part with no screen (a model call, an agent, an API), or variants the
   product does not already compare: a workbench. Look for one first, by the
   `workbench-` prefix in the project's local skills and the `workbench` kind in aiview,
   and extend the one whose scope covers the part; make one only when none does, through
   the `create-workbench` skill. One tab per tool, open before the person comes.
5. **One message to the person**: what landed, where to look first, each tab and what
   it holds, a red check, a plan step still open (the person decides whether it waits),
   and a bench's new view to shape with them: that opens the session.

## The loop

- **The watched browser is the one place both of you see and point, both ways.** The
  person points by a selection or a mark on the page: read it there. Point back on the
  page itself, the element outlined, or through the `point-at` skill when a mockup is
  open. A screenshot is the fallback, never the brief.
- **Each change is shown in its tool before the next question.**
- **You are still the orchestrator.** An adjustment is done by you or becomes a slice
  run by a subagent: your call, case by case, the `execute-plan` skill's way. A decision
  taken live is a row of the plan's decisions, as there.
- **Propose a workbench, or a new view on one, when** the thing has no screen, variants
  are being compared, or the person asks for the same view twice. An existing bench is
  extended before a new one is made.
- **A piece no tool can show is out of scope**: it is verification's. When a bench sits
  near it, propose the feature that would show it.
- **Whether the slot is done is not this skill's call.**

## Red flags

| Thought | Reality |
|---|---|
| "I'll call the person now and fix the seed while they look" | They wait on it, and a broken state mid-session costs more than the setup. |
| "This question deserves its own bench" | A bench serves a scope, not a question. One per question and the project's local skills grow with every plan. |
| "I'll write up what we validated" | Nothing is kept. If the person asks, it is read from the session. |

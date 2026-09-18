---
name: execute-plan
description: Use when carrying out an implementation plan the person has already approved, whether starting it or resuming it in a later session, and the tracker in it has to stay true while the work happens. Not for producing the plan (write-plan) and not for reviewing the result.
---

# Execute a plan

## Before starting

- **The tracker** is the plan's diagram; `references/tracker.md` is its protocol, read before the first edit of it.
- **Open the plan in aiview every session** and give the person the URL.
- **Do not start** if the plan has no tracker, a slice has no slice document, a slice document has no seams under test or no module blocks, or a slice whose check is not a command. Say so and finish the plan first.
- **Reconcile a tracker the repository has moved past** before starting; say what you found.

## The mandate

**The plan's *Execution* section is the mandate**: the pace, the pull requests, the steps, the subagents' model, the verification. A field it lacks is asked from `references/mandate.md` before the first slice and written there. A resumed session reads it and does not ask again. Every dispatch passes the mandate's model.

**A verification run** is `verification-skill-maintain` anchored on the slice's merge range, then the project's `verify-<app>` skill, its document in the plan's group and tagged with the slot. After each slice: at the slice boundary, after the merge, before the next dispatch. After the slot is done: once, at the plan's close, anchored on the plan's whole range. A story that fails on the application is a pause.

## What stays in this session

- **The tracker, the briefs, the verification, the merges, the README, the plan's decisions.** A subagent never edits any of them.
- **Verifies every return**: a tick rests on what this session re-ran: the slice's check, and the tests it owed, present and green.
- **Checks blockers before every dispatch.**
- **A subagent that stops on a finding is done.** Fix the plan or the slice document; never re-brief it past what it found.

**A brief is**: the slice document's path, the workspace, the branch and its base, the command that prepares the workspace, the pull request to open. Nothing else.

## Watching a subagent

**The watch is the orchestration.** The `Agent` call and the watch loop go out in the same message; read `references/watching.md` before the first dispatch.

- **Probe every minute. Report only on change.** Move ▶ as it goes.
- **The completion notification is not the watch.** The tell: "I'll hear when it finishes."
- **A subagent still for three minutes is news.** Report the stall.
- **Read the transcript by digest, never whole.**

## Branches and pull requests

**Never delete a branch**, and never pass the option that deletes one on merge (`gh pr merge --delete-branch`, the repository's *automatically delete head branches*): deleting a branch closes every pull request based on it. **The mandate says one pull request per slice or one for the plan.** Draft on the first commit, small commits pushed as they land, reviewed and merged at the close by the person or the orchestrator as the pace says. **Whatever merges leaves dev green**: complete, or inert where it is not yet.

**On the first push:** open `<pr>/changes` in the browser, write the PR number into the state node, post the first table.

**Forks run at once**, one subagent each, in their own workspaces. Read `references/workspaces.md` before the first fork.

## When to pause

Stop for exactly three things:

- **A decision that is the person's.** A step that cannot be done as written, a finding that breaks a decision the plan rests on, a repair with real options, work outside the plan's scope. Back to the plan is a valid outcome: say what was learned and stop.
- **Verification only a person can do.** A browser flow, a real sign-in, another team's approval. Do everything mechanical first.
- **An action that leaves the machine and does not undo cheaply.** A production deploy, a migration on shared data, anything outward-facing. Approved once each, never once for all.

**A pause is a handoff.** In this order:

1. The tracker current.
2. What happened, the evidence, the decision wanted, the options, a recommendation.
3. **What the person does next**, numbered, each with its exact command and what a good result looks like.

**A secret goes in the file the pause names.** The pause gives the path and the keys.

**Do not pause for**: per-step sign-off, verification you can do yourself, naming, structure, tool choice, a commit on an agreed branch, reading documentation, a failure you understand whose fix changes nothing decided.

**Stop the line** when one step fails twice for unrelated reasons; report both together.

## Keeping the tracker

- **Tick as you go, never in a batch.** ✅ when the step's own done-when is met, the evidence in the label: what was observed, the run, the acceptance criterion seen.
- **Update before every handoff**: a question, an approval, the end of a turn.
- **The person's criterion is this session's tick**, in the slice document and on the pull request's checklist: it lands after the subagent has returned.
- **Draw deviations before doing them.** New work is a node; a new dependency is an arc; waiting on someone is ⏸ naming what was asked and when; a dissolved step is ✖ with the reason; an answered gate shows its way. A deviation that decides a module, interface, schema, contract or architecture is a row in the plan's decisions, and one that changes a decision amends the plan's sentence too: the slices carry it.
- **A deviation that becomes a slice gets its slice document first** (`write-slice`).
- **A step you paused inside was too coarse.** Split it where the pause fell.
- **Rewrite finished steps as what happened**: past tense, values, commands, the wrong turns a resumer would act on.
- **Overwrite the state node's fields; never append.**
- **The last step says so upward.** With a roadmap, the close says the plan finished and the roadmap may need redrawing. The person confirms the slot landed, with evidence; the plan does not.

## Anti-patterns

- **Parallel by intuition.** The tell: "these look independent." Only the plan draws forks.
- **The step as event log.** The tell: a node that reads in the order things happened. Each line has a home, the pull request, a decisions row or its own node, and the step keeps what proves its done-when.

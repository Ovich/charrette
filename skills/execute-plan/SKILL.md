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

## The orchestrator's mandate

**You, the plan's executor, are the orchestrator.** Read the plan's *Mandate* section. What it leaves open, ask the person before the first slice, with the questions of `references/orchestrator-mandate.md`, and write the answers into the plan's *Mandate* section. Every dispatch passes its model.

**When the project has a `verify-<app>` skill**, and only then:

- **Verification runs that skill**, per slice or per slot as the mandate says, anchored on that merge range, its document in the plan's group. A story that fails on the application is a pause.
- **Maintenance runs `verification-skill-maintain`, once, at the slot's end**, anchored on the plan's whole range, before the slot's own verification when the mandate has one. It updates the verify skill and the feature map; it verifies nothing for the plan.

## What stays in this session

- **The tracker, the briefs, the verification, the merges, the README, the plan's decisions.** A subagent never edits any of them.
- **Verifies every return**: a tick rests on what this session re-ran: the slice's check, and the tests it owed, present and green, or under `tests: at the plan end` the proof the slice names in their place.
- **Checks blockers before every dispatch.**
- **A subagent that stops on a finding is done.** Fix the plan or the slice document; never re-brief it past what it found.

**A brief is**: the slice document's path, the workspace, the branch and its base, the command that prepares the workspace, the pull request to open, the mandate's `tests`. Nothing else, and never the plan.

## Watching a subagent

**The `Agent` call and the watch loop go out in the same message**; read `references/watching.md` before the first dispatch.

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

- **Tick as you go, never in a batch.** ✅ when this session has re-run the step's own done-when, its `went on` line written.
- **Update before every handoff**: a question, an approval, the end of a turn.
- **The person's criterion is this session's tick**, in the slice document and on the pull request's checklist: it lands after the subagent has returned.
- **Draw deviations before doing them.** New work is a node; a new dependency is an arc; waiting on someone is ⏸ naming what was asked and when; a dissolved step is ✖ with the reason; an answered gate shows its way. A deviation that decides a module, interface, schema, contract or architecture is a row in the plan's decisions, and one that changes a decision amends the plan's sentence too: the slices carry it.
- **A deviation that becomes a slice gets its slice document first** (`write-slice`).
- **A step you paused inside was too coarse.** Split it where the pause fell.
- **A subagent's return is read, never pasted into a step**: each line of it has a home, listed in `references/tracker.md`.
- **Overwrite the state node's fields; never append.**
- **An amended mandate overwrites its field too**, in the plan's *Mandate* section and in the line under the tracker, as `references/orchestrator-mandate.md` says.
- **The last step says so upward.** With a roadmap, the close says the plan finished and the roadmap may need redrawing. The person confirms the slot landed, with evidence; the plan does not.

## Anti-patterns

- **Parallel by intuition.** The tell: "these look independent." Only the plan draws forks.
- **The step as event log.** The tell: a node that reads in the order things happened.
- **The step as the slice's return.** The tell: "owed to", "to watch at", a file name, a grep, a line count.

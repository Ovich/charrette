---
name: execute-plan
description: Use when carrying out an implementation plan the person has already approved, whether starting it or resuming it in a later session, and the tracker in it has to stay true while the work happens. Not for producing the plan (write-plan) and not for reviewing the result.
---

# Execute a plan

## Before starting

- **The tracker** is the plan's diagram; `references/tracker.md` is its protocol, read before the first edit of it.
- **Open the plan in aiview every session** (`../aiview/SKILL.md` in this collection) and give the person the URL.
- **Do not start** if the plan has no tracker, a slice has no slice document, a slice document has no modules table, or a done-when no test can express. Say so and finish the plan first.
- **Reconcile a tracker the repository has moved past** before starting; say what you found.

## Pace and steps

Ask both in one message, recommended answer first. Write the answers into the state node; a resumed session does not ask again.

**Pace** (`pace: run through | stop at each slice`):

1. **Run through** (recommended): at each slice boundary, merge its pull request, report, continue.
2. **Stop at each slice**: finish, report, name what is next, wait. The person merges.

Either way, a slice marked `👤` stops before it starts, and a finding that changes the next slice is a pause.

**Steps** (`steps: delegated | inline`):

1. **Delegated** (recommended): a fresh subagent per slice runs `execute-slice` (`../execute-slice/SKILL.md` in this collection).
2. **Inline**: this session does the work. For small plans, judgment-heavy slices, or a person who wants to watch.

## What stays in this session

- **The tracker, the briefs, the verification, the merges, the README, the register.** A subagent never edits any of them.
- **Verifies every return.** A subagent's report is a claim; a tick rests on what this session re-ran: the command, the failing output, the test file unedited since its own commit.
- **Checks blockers before every dispatch.**
- **A subagent that stops on a finding is done.** Fix the plan or the slice document; never re-brief it past what it found.

**A brief is**: the slice document's path, the workspace, the branch and its base, the command that prepares the workspace, the pull request to open. Nothing else.

## Watching a subagent

**The watch is the orchestration.** The `Agent` call and the watch loop go out in the same message; read `references/watching.md` before the first dispatch.

- **Probe every 30 seconds. Report only on change.** Move ▶ as it goes.
- **The completion notification is not the watch.** The tell: "I'll hear when it finishes."
- **A subagent still for two minutes is news.** Report the stall.
- **Read the transcript by digest, never whole.**

## Branches and pull requests

**One branch, one pull request per slice**, off `main`. Draft on the first commit, small commits pushed as they land, reviewed and merged at the close by the person or the orchestrator as the pace says. **A merged slice leaves dev green**: complete, or inert where it is not yet. A plan branch is the exception, and the plan names it.

**On the first push:** open `<pr>/changes` in the browser, write the PR number into the state node, post the first table.

**Forks run at once**, one subagent each, in their own workspaces. Read `references/workspaces.md` before the first fork.

## When to pause

Stop for exactly three things:

- **A decision that is the person's.** A step that cannot be done as written, a finding that breaks a decision the plan rests on, a repair with real options, work outside the plan's scope. Back to the board is a valid outcome: say what was learned and stop.
- **Verification only a person can do.** A browser flow, a real sign-in, another team's approval. Do everything mechanical first, so their part is only what needs them.
- **An action that leaves the machine and does not undo cheaply.** A production deploy, a migration on shared data, anything outward-facing. Approved once each, never once for all.

**A pause is a handoff.** In this order:

1. The tracker current.
2. What happened, the evidence, the decision wanted, the options, a recommendation.
3. **What the person does next**, numbered, each with its exact command and what a good result looks like.

**A secret goes in the file the pause names.** The pause gives the path and the keys.

**Do not pause for**: per-step sign-off, verification you can do yourself, naming, structure, tool choice, a commit on an agreed branch, reading documentation, a failure you understand whose fix changes nothing decided.

**Stop the line** when one step fails twice for unrelated reasons; report both together. A second surprise inside one step means the step was mis-scoped.

## Keeping the tracker

- **Tick as you go, never in a batch.** ✅ when the step's own done-when is met, the evidence in the label: what was observed, the red run and the green run, the acceptance criterion seen.
- **Update before every handoff**: a question, an approval, the end of a turn.
- **Draw deviations before doing them.** New work is a node; a new dependency is an arc; waiting on someone is ⏸ naming what was asked and when; a dissolved step is ✖ with the reason; an answered gate shows its way. A deviation that decides a module, interface, schema, contract or architecture is a register row.
- **A deviation that becomes a slice gets its slice document first** (`write-slice`, `../write-slice/SKILL.md` in this collection).
- **A step you paused inside was too coarse.** Split it where the pause fell.
- **Rewrite finished steps as what happened**: past tense, values, commands, the wrong turns worth keeping.
- **Overwrite the state node's fields; never append.**
- **The last step says so upward.** With a roadmap (`../roadmap/SKILL.md` in this collection), the close says the plan finished and the roadmap may need redrawing. The person confirms the slot landed, with evidence; the plan does not.

## Anti-patterns

- **Checking in per step.** The tell: "I'll confirm before the next step." The plan was the approval.
- **Ticking on hearsay.** The tell: "the return says it passed." Re-run it.
- **Parallel by intuition.** The tell: "these look independent." Only the plan draws forks.
- **Narrated deviations.** The tell: "I'll mention it at the end." Draw it, then do it.
- **Approval by precedent.** The tell: "they said yes yesterday." Outward-facing actions are approved once each.
- **Open questions.** The tell: "what would you like to do?" Bring options and a recommendation.

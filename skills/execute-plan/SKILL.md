---
name: execute-plan
description: Use when carrying out an implementation plan the person has already approved, whether starting it or resuming it in a later session, and the tracker in it has to stay true while the work happens. Not for producing the plan (write-plan) and not for reviewing the result.
---

# Execute a plan

An approved plan is a **mandate**. Run it, keep the tracker true, stop only where a person adds something.

## Input

- A plan whose diagram is the **tracker**, every step with a checkable done-when. `write-plan` produces it; `references/tracker.md` is its protocol. Read that before the first edit.
- **Open the plan in aiview every session** (`../aiview/SKILL.md` in this collection) and give the person the URL.
- **Do not start** if the plan has no tracker, a slice has no slice document, or a done-when no test can express. Say so and finish the plan first.
- A tracker that describes a state the repository has left is a deviation. Reconcile it, say what you found, then start.

## Two questions, once

Ask both in one message, recommended answer first. Write the answers into the state node; a resumed session reads them and asks nothing.

**Pace** (`pace: run through | stop at each slice`):

1. **Run through** (recommended): at each slice boundary, merge its pull request, report, continue.
2. **Stop at each slice**: finish, report, name what is next, wait. The person merges.

Either way, a slice marked `👤` stops before it starts, and a finding that changes the next slice is a pause.

**Steps** (`steps: delegated | inline`):

1. **Delegated** (recommended): a fresh subagent per slice runs `execute-slice` (`../execute-slice/SKILL.md` in this collection). This session keeps the plan, not the diffs.
2. **Inline**: this session does the work. For small plans, judgment-heavy slices, or when the person wants to watch.

## The orchestrator

- **Owns the tracker, the briefs, the verification, the merges.** A subagent never edits the tracker.
- **Owns what needs the whole run in one head**: the README the plan earned, register rows, the state node.
- **Verifies every return.** A subagent's report is a claim. A tick rests on what this session re-ran: the command, the failing output, the test file unedited since its own commit.
- **Checks blockers before every dispatch.** A subagent cannot see the plan, and a blocker outside the repository has no glyph.
- **A subagent that stops on a finding is done.** Fix the plan or the slice document; never re-brief it past what it found.

**A brief is**: the slice document's path, the workspace, the branch and its base, the command that prepares the workspace, the pull request to open. Nothing else; the document is the context.

## Watching

A subagent returns once. Watch it while it runs, or the tracker goes blind for the length of the slice.

- **Probe every 30 seconds. Report only on change.** Move ▶ as it goes.
- **A subagent still for two minutes is news.** Report the stall.
- **Read the transcript by digest, never whole.** `references/watching.md` has the digest.
- **Report as a table, every time**, one row per subagent, from the first probe:

| Agent | Doing | In brief | Status |
|---|---|---|---|
| slice · step | from the digest | yes, or what strayed | on track · steer · stalled |

- **A step the subagent calls done is a claim.** It stays ⬜ with the claim in its label until this session re-runs the evidence.
- **Watch, do not supervise.** Decisions the slice document leaves to the subagent are the subagent's.

## Branches and pull requests

**One branch, one pull request per slice**, off `main`. Draft on the first commit, small commits pushed as they land, reviewed and merged at the close by the person or the orchestrator as the pace says. **A merged slice leaves dev green**: complete, or inert where it is not yet. A plan branch is the exception, and the plan names it.

**On the first push:** open `<pr>/changes` in the browser, write the PR number into the state node, post the first table.

**Forks run at once**, one subagent each, in their own workspaces. Read `references/workspaces.md` before the first fork.

## Pauses

Stop for exactly three things:

- **A decision that is the person's.** A step that cannot be done as written, a finding that breaks a decision the plan rests on, a repair with real options, work outside the plan's scope. A finding that sends the work back to the board is the loop working; say what was learned and stop.
- **Verification only a person can do.** A browser flow, a real sign-in, another team's approval. Do everything mechanical first, so their part is only what needs them.
- **An action that leaves the machine and does not undo cheaply.** A production deploy, a migration on shared data, anything outward-facing. Approved once each, never once for all.

**A pause is a handoff.** In this order:

1. The tracker current, before anything else. The session may end here.
2. What happened, the evidence, the decision wanted, the options, a recommendation.
3. **What the person does next**, numbered, each with its exact command and what a good result looks like.

**A secret goes in the file the pause names.** The pause gives the path and the keys.

**Do not pause for**: per-step sign-off, verification you can do yourself, naming, structure, tool choice, a commit on an agreed branch, reading documentation, a failure you understand whose fix changes nothing decided.

**Stop the line** when one step fails twice for unrelated reasons; report both together. When a step turns out to be several, absorb the first surprise; a second means the step was mis-scoped.

## The tracker

- **Tick as you go, never in a batch.** ✅ when the step's own done-when is met, with the evidence in the label: what was observed, the red run and the green run, the acceptance criterion seen.
- **Update before every handoff**: a question, an approval, the end of a turn.
- **Draw deviations before doing them.** New work is a node; a new dependency is an arc; waiting on someone is ⏸ naming what was asked and when; a dissolved step is ✖ with the reason; an answered gate shows its way. A deviation that decides a module, interface, schema, contract or architecture is a register row.
- **A deviation that becomes a slice gets its slice document first** (`../write-plan/SKILL.md` in this collection).
- **A step you paused inside was too coarse.** Split it where the pause fell.
- **Rewrite finished steps as what happened**: past tense, values, commands, the wrong turns worth keeping.
- **Overwrite the state node's fields.** A node appended to is a log, and a log of states is not a state.
- **The last step says so upward.** With a roadmap (`../roadmap/SKILL.md` in this collection), the close says the plan finished and the roadmap may need redrawing. The plan finishing is not the slot landing; the person confirms that, with evidence.

## Anti-patterns

- **Checking in per step.** The tell: "I'll confirm before the next step." The plan was the approval.
- **Ticking on hearsay.** The tell: "the return says it passed." Re-run it.
- **Parallel by intuition.** The tell: "these look independent." Only the plan draws forks; `references/tracker.md` says what makes one arm.
- **Narrated deviations.** The tell: "I'll mention it at the end." Draw it, then do it.
- **Approval by precedent.** The tell: "they said yes yesterday." Outward-facing actions are approved once each.
- **Open questions.** The tell: "what would you like to do?" Bring options and a recommendation.

---
name: help
description: "Use when a person asks how this collection works, at any moment: mid-run ('what is the board telling me', 'why did the swarm stop', 'what does build-verify do'), about a skill, a document or a verb they meet, or in general ('what is swarmstorm', 'how do I start', 'what can it do here'), and just after installing it. Explains the part of the collection their question or their current work touches, in their context; readies the project when something is missing; gives a tour only when the question is broad. Not for running the skill it explains, and not for offering a skill unasked (next-step)."
---

# Help

**Answer from where the person is, never from a manual.** Their question, and what is going on now
(the skill in use, the run on the board, the document open, the last answer a verb printed), say
which part of the collection to explain. Explain that part, in their terms, then go back to the work.

## Read the context first

- **What is running**: the skill loaded in this session; a run on the board (`swarm status`, its
  phase, its members, what waits on the person); the document being worked on (`aiview status`).
- **What they just met**: a verb's answer, a phase message, a findings table, a board event, a
  document's kind, a term (seat, phase, task, protocol, verifier, the data home).

## Explain

- **The part they asked about, as it applies here**: what it is, why it is there, what happens
  next and what is theirs to decide. A run's state: where it stands, who waits on whom, what
  unblocks it. A term: one sentence, then what it means in this run or this project.
- **Where to see it**: the aiview link (the documents, `/board`), the document by name, the board
  post by its number.
- **Short**: a few lines, a list when there are steps; a diagram (the `write-diagrams` skill) only
  when the question is about how pieces connect.
- **Then hand back**: the work continues where it was. A skill the explanation points to is
  offered as the `next-step` skill offers, never run unasked.

## When something is not ready

Asked about a step that cannot run, or the person is new: check, one line each, fixed on the spot
or said with the one command that fixes it:

1. **Node 22.5 or later** (`node --version`).
2. **aiview's data home**: `aiview status --json` (the `aiview` skill's tool); none yet, `aiview
   init`; where it lives (`home`), in one line: documents never go into the repository.
3. **The project declared**: no `cwdProject` → declare it as the `aiview` skill's
   `references/projects.md` says, its slug proposed from the folder's name, on the person's yes.
4. **The viewer**: `aiview board` prints its link, starting the server when none runs.

## When the question is broad

"What can it do", "how do I start": one screen, each line a kind of help with an example drawn
from **this project's own work** (its open documents, its recent commits, the subject of the
conversation):

- **Think it through**: the `interview` skill, the `brainstorm` skill (a board that keeps the
  decisions).
- **Decide with several voices**: the `brainswarm` skill (debate, brainstorm, editorial seats).
- **Plan and build**: the `write-plan` and `execute-plan` skills; a `swarm` of workers, with
  build-verify when the result must be walked.
- **Design a screen**: the `design-prototype` skill. **Review**: the `pr-review` skill. **Keep
  conventions**: the `write-conventions` skill.
- **Watch it all**: aiview, the documents and the board.

End on the one you would start with here, and why, offered as the `next-step` skill offers.

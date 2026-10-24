---
name: getting-started
description: "Use when a person is new to this collection or asks what it can do, how to start, or how to set it up in this project: 'what is swarmstorm', 'how do I use this', 'help me get started', just after installing the plugin. Checks that the project is ready (Node, aiview's data home, the project declared, the viewer up), then gives a one-screen tour drawn from this project's own work and offers the first step. Not for running any skill it names, and not for offering a skill mid-work (next-step)."
---

# Getting started

**The person should be working within minutes, never reading a manual.** Check what is missing,
fix it with them, show what the collection can do here, and hand over to the first step.

## Ready the project

One line per check, fixed on the spot or said with the one command that fixes it:

1. **Node 22.5 or later** (`node --version`).
2. **aiview's data home**: `aiview status --json` (the `aiview` skill's tool); none yet, `aiview
   init`. Say where it lives (`home`), in one line: documents never go into the repository.
3. **The project declared**: `status --json` has no `cwdProject` → declare it as the `aiview`
   skill's `references/projects.md` says, its slug proposed from the folder's name, on the
   person's yes.
4. **The viewer**: `aiview board` prints its link, starting the server when none runs; give the
   person the link: their documents and the swarm board live there.

## The tour

One screen, each line a kind of help with an example drawn from **this project's own work** (its
open documents, its recent commits, the subject of the conversation), never a manual:

- **Think it through**: the `interview` skill (questions one at a time), the `brainstorm` skill (a
  board that keeps the decisions).
- **Decide with several voices**: the `brainswarm` skill (debate, brainstorm, editorial seats).
- **Plan and build**: the `write-plan` and `execute-plan` skills; a `swarm` of workers, with
  build-verify when the result must be walked.
- **Design a screen**: the `design-prototype` skill. **Review**: the `pr-review` skill. **Keep
  conventions**: the `write-conventions` skill.
- **Watch it all**: aiview, the documents and the board, at the link above.

**End on the one you would start with here, and why**, offered in one line as the `next-step`
skill offers: a yes loads it.

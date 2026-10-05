---
name: verification-skill-create
description: "Use when a project has no verification skill and an agent should from now on judge, alone, the product quality of what is delivered (done as specified, usable, finished): on request, or from execute-plan when the person says yes. Produces the project's `verify-<app>` skill, the tooling the agent operates for that quality control, and its feature map in aiview, proven by one quality pass. Not for a project that has one (its verify skill adapts itself), running a pass (the project's verify skill), tests, code quality or review."
---

# Create a verification skill

**Two things are produced, and a later agent runs from them alone**: the project's `verify-<app>` skill, the tooling an agent operates to judge the product's quality alone (its role, how to launch, reach, drive, observe and clean up), and the feature map in aiview, the navigation map of how the consumer reaches each part, the hidden ones included.

**The skill opens on its role prompt, and leaves the judging to the agent.** Its first paragraph, written for this product, makes the agent the owner of the product's quality and of the skill itself, its scripts and its map, which it adapts in place when the application has moved (no other skill maintains them). It then gives the agent, in prose and in the product's own terms, every role it judges through, each with what it answers for: the roles every product needs (its product owner, its consumer meeting it for the first time, its editor, its skeptic), the roles of its surface (its harness reference names them), and a role of its domain when someone else judges what the product produces (a recruiter reading the CV it writes), established from the plans, never invented. A role earns its sentence by what it would catch that the others would not. The roles, the three counts (done as specified, usable, finished) and the weight of a finding are the protocol; what to look at and how much it matters are the agent's: a checklist written into the skill becomes its whole judgment.

**The tooling is built for the agent that operates it: fast, and ergonomic.** A pass is an agent running the scripts dozens of times, so a slow or awkward step is paid at every step of every pass, in time and in context. One command per thing the agent repeats, a live state it acts on in small steps, short parseable answers, failures that name their fix, every step measured against a budget before handover: `references/tooling.md`, read before the first script.

## Before writing

- **Stop if a `verify-<app>` skill exists** in the project's local skill folder: it keeps itself true when run. Say so, and ask whether a second one under another name is wanted. Never overwrite one.
- **Establish from the repository, never by asking**: the consumer (a person at a screen or a shell, a client, an agent, another service) and what they come to the product for, which the role is written from; the interface they use; how the system starts and signals ready; how it is driven; how outcomes, side effects and failures are observed; what state each part needs; where the specification lives (plans and their stories, slice documents, decisions, reference mockups, the `design-prototype` skill's design language, the README's promises); the widths, themes, locales and inputs the product supports.
- **Pick the harness reference** the interface calls for and read it: `references/web.md`, `references/api.md`, `references/service.md`, `references/cli.md` or `references/mcp.md`. The generated skill's launch, drive and cleanup sections are written to it, and it names the reference for its own reader.
- **Baseline: the system builds and starts as-is.** It does not: fix it when the fix is small and unrelated to any journey, and say so; otherwise report the blocker and stop. Scaffolding past a missing asset is marked and removed at cleanup.
- **Journeys come from the design**: the plans, the roadmap's slots, the README's promises, the issues, in that order. None: ask the person for the three to five journeys the product exists for. Never invent one.

## The skill

**`verify-<app>/SKILL.md` in the folder the project already uses for local skills**, `.claude/skills/` when it has none and is worked with Claude Code, asked otherwise. Written to the shape in `references/verify-skill.md`, read before the first line: the sentences outside its brackets are the protocol and are carried as written.

## The map

**One `feature-map` document per project, opened in aiview on creation**: kind `feature-map` from the filename `YYYY-MM-DD-<project>.feature-map.md`, tags = `verification`, no group, started when the reading began. Tell the person the URL. A navigation map of how the consumer reaches every feature and its hidden parts, and the journeys across them: its sections are in `references/feature-map.md`, read before its first line.

## Prove it

**Never hand over an unproven skill.** Run one quality pass through the generated skill on a real scope, a feature at least, its specification read, the anchor being the current commit. The skill is proven when the pass is complete: every part of the scope reached along the map, judged on the three counts, the verdict and the findings in the verification document with their evidence shown, the cleanup done, and the tooling within the budget `references/tooling.md` has it measure. A `not ready` verdict proves the skill as well as `ready` does. What the pass finds on the application is reported as its findings, never fixed inside this skill and never softened. A pass that could not reach or judge part of its scope fails on the skill or the map: fix them, run the cleanup, retry from a clean state.

Write the commit the pass ran against into `proven at`.

## Handoff

Where the skill was written, the map's URL, the features mapped and their hidden parts, the journeys listed, the pass run, its verdict and its verification document, the tooling's budget and the tool calls the pass took, the cleanup done. Say that the agent running the skill keeps it and the map true.

## Red flags

| Thought | Reality |
|---|---|
| "The map goes in the repository next to the skill" | The skill is versioned with the code, the map lives in aiview. One document, flat. |
| "A list of what to check makes the skill thorough" | The agent checks that list and stops. The role and the three counts are the protocol; the judgment is the agent's. |
| "The agent can write its own script for each pass" | It then rewrites a journey for every attempt and reads a page of output per run. The tooling gives it a live state and one command per repeated step. |
| "The part is reached faster by writing its rows" | The starting state is established the way the consumer would, or the way the skill documents and the run can undo. |

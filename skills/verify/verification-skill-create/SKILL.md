---
name: verification-skill-create
description: "Use when a project has no verifier for a focus (what is judged, through what) and an agent should from now on judge, alone, the product quality of what is delivered (done as specified, usable, finished): on request, or from the mandate questions of orchestrate-plan when the person says yes. Produces the project's `verify-<app>-<focus>` skill, proven by one quality pass. Not for a focus that has one (its verify skill adapts itself), running a pass (the project's verify skill), tests, code quality or review."
---

# Create a verification skill

**One thing is produced, and a later agent works from it alone**: the project's verifier for one focus, `verify-<app>-<focus>` (plain `verify-<app>` while the project has one only). A project keeps as many as it has focuses, whatever they are; for example: the app judged end to end in its browser, a workflow judged on its workbench, the API judged by its requests. The skill is short, as a proven project skill is: an agent arriving cold reads it in a minute and works.

**The skill opens on its role prompt and leaves the judging to the agent**: one paragraph that makes the agent the product's quality owner, seen through expert roles (a web product's UI/UX expert and art director among them). Written as `references/role-prompt.md` says, read before the first line, with the surface's roles from its harness reference.

**The verify skill validates the product, never the code.** It reaches and judges everything through the surface the consumer uses; reading the source is this skill's job, done once here, never the verify skill's.

## Before writing

- **Settle the focus with the person first**: what this verifier judges and through what. **Stop if a verifier with that focus exists**: it keeps itself true when run. Say so; never overwrite one.
- **A project skill that already runs the app is the base.** It is proven: its words are kept as they are, wrapped with the role prompt, the map and the judgment, and it is removed once the verify skill holds all of it.
- **Establish from the repository, never by asking**: the consumer and what they come for, the interface they use, how the app starts and signals ready, the tool the agent acts through, where the specification lives (plans and their stories, decisions, reference mockups, the `design-prototype` skill's design language), the widths, themes and inputs the product supports, and **the inputs a pass of this focus depends on**, each with its default (`references/verify-skill-template.md`, *Scope and inputs*).
- **The harness reference** of the interface, read for the tool to act through and the surface's expert roles: `references/web.md`, `api.md`, `service.md`, `cli.md` or `mcp.md`. A tool the agent operates is built as `references/tooling.md` says.
- **Journeys come from the design**: the plans, the roadmap's slots, the README's promises. None: ask the person for the three to five the product exists for.

## The skill

**`verify-<app>-<focus>/SKILL.md`** in the project's local skill folder, written to the shape in `references/verify-skill-template.md`, read before the first line.

## Prove it

**Run one quality pass through the generated skill** on a real scope, a feature at least. The skill is proven when the pass is complete: every part of the scope reached, judged against its inputs, the verdict and its findings table in its report. A `not ready` verdict proves it as well as `ready`; what the pass finds on the app is reported, never fixed inside this skill. A part it could not reach fails on the skill: fix it and run again.

**Handoff**: the skill's path, its focus, the pass's report.

## Red flags

| Thought | Reality |
|---|---|
| "A list of what to check makes the skill thorough" | The agent checks that list and stops. The role prompt and the three counts are the protocol; the judgment is the agent's. |
| "The inputs are obvious" | The verifier guesses them and judges against the wrong reference. Each has a default in the skill or comes in the scope. |
| "The existing run skill could be written better" | It is proven. Wrap it; reword nothing that works. |

---
name: verification-skill-create
description: "Use when a project has no verification skill and an agent should from now on judge, alone, the product quality of what is delivered (done as specified, usable, finished): on request, or from the mandate questions of orchestrate-plan when the person says yes. Produces the project's `verify-<app>` skill and its feature map in aiview, proven by one quality pass. Not for a project that has one (its verify skill adapts itself), running a pass (the project's verify skill), tests, code quality or review."
---

# Create a verification skill

**Two things are produced, and a later agent works from them alone**: the project's `verify-<app>` skill and its feature map in aiview. The skill is short, as a proven project skill is: an agent arriving cold reads it in a minute and works.

**The skill opens on its role prompt and leaves the judging to the agent**: one paragraph that makes the agent the product's quality owner, seen through expert roles (a web product's UI/UX expert and art director among them). Written as `references/role-prompt.md` says, read before the first line, with the surface's roles from its harness reference.

**The verify skill validates the product, never the code.** It reaches and judges everything through the surface the consumer uses; reading the source is this skill's job, done once here, never the verify skill's.

## Before writing

- **Stop if a `verify-<app>` skill exists**: it keeps itself true when run. Say so; never overwrite one.
- **A project skill that already runs the app is the base.** It is proven: its words are kept as they are, wrapped with the role prompt, the map and the judgment, and it is removed once the verify skill holds all of it.
- **Establish from the repository, never by asking**: the consumer and what they come for, the interface they use, how the app starts and signals ready, the tool the agent acts through, where the specification lives (plans and their stories, decisions, reference mockups, the `design-prototype` skill's design language), the widths, themes and inputs the product supports.
- **The harness reference** of the interface, read for the tool to act through and the surface's expert roles: `references/web.md`, `api.md`, `service.md`, `cli.md` or `mcp.md`. A tool the agent operates is built as `references/tooling.md` says.
- **Journeys come from the design**: the plans, the roadmap's slots, the README's promises. None: ask the person for the three to five the product exists for.

## The skill and the map

**`verify-<app>/SKILL.md`** in the project's local skill folder, written to the shape in `references/verify-skill-template.md`, read before the first line.

**One `feature-map` document per project** in aiview, `YYYY-MM-DD-<project>.feature-map.md`, tags `verification`, its sections in `references/feature-map.md`: how the consumer reaches every feature and its hidden parts, and the journeys across them. Tell the person the URL.

## Prove it

**Run one quality pass through the generated skill** on a real scope, a feature at least. The skill is proven when the pass is complete: every part of the scope reached along the map, judged, the verdict and its findings in the verification document. A `not ready` verdict proves it as well as `ready`; what the pass finds on the app is reported, never fixed inside this skill. A part it could not reach fails on the skill or the map: fix them and run again. Write the commit into the map's `proven at`.

**Handoff**: the skill's path, the map's URL, the pass's verdict and its document.

## Red flags

| Thought | Reality |
|---|---|
| "A list of what to check makes the skill thorough" | The agent checks that list and stops. The role prompt and the three counts are the protocol; the judgment is the agent's. |
| "The existing run skill could be written better" | It is proven. Wrap it; reword nothing that works. |

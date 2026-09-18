---
name: verification-skill-create
description: Use when a project has no verification skill of its own and its user stories should from now on be shown to work end to end through the interface their consumer uses: on request, or from execute-plan when the person says yes to creating one. Produces the project-local `verify-<app>` skill and the project's feature map in aiview, proven on one real story. Not for a project that already has one (verification-skill-maintain), not for running stories (the project's own verify skill), and not for tests, code quality or review.
---

# Create a verification skill

**Two things are produced, and a later agent runs from them alone**: the project's `verify-<app>` skill, which says how to launch, drive, observe and clean up, and the feature map in aiview, which says how a story's consumer reaches the part of the application to verify.

## Before writing

- **Stop if a `verify-<app>` skill exists** in the project's local skill folder. Say so, name `verification-skill-maintain`, and ask whether a second skill under another name is wanted. Never overwrite one.
- **Establish from the repository, never by asking**: the consumer (a person at a screen or a shell, a client, an agent, another service), the interface they use, how the system starts locally and signals ready, how that interface can be driven, how outcomes and side effects can be observed, what state a story needs.
- **Pick the harness reference** the interface calls for and read it: `references/web.md`, `references/api.md`, `references/service.md`, `references/cli.md` or `references/mcp.md`. The generated skill's launch, drive and cleanup sections are written to it, and it names the reference for its own reader.
- **Baseline: the system builds and starts as-is.** It does not: fix it when the fix is small and unrelated to any story, and say so. Otherwise report the blocker and stop. Scaffolding created to get past a missing asset is marked as such and removed at cleanup.
- **Stories come from the design**: the plans, the roadmap's slots, the README's promises, the issues, in that order. None: ask the person for the three to five journeys the product exists for. Never invent one.

## The skill

**`verify-<app>/SKILL.md` in the folder the project already uses for local skills**, `.claude/skills/` when it has none and is worked with Claude Code, asked otherwise. Written to the shape in `references/verify-skill.md`, read before the first line: the sentences outside its brackets are the protocol and are carried as written.

## The map

**One `feature-map` document per project, opened in aiview on creation**: kind `feature-map` from the filename `YYYY-MM-DD-<project>.feature-map.md`, tags = project + `verification`, no group, started when the reading began. Tell the person the URL.

Its sections, in this order, every one read by the verify skill and by `verification-skill-maintain`:

1. **`proven at <commit> on <date>`**, the second line, under the title. The anchor every maintenance diffs from.
2. **Navigation**: one mermaid flowchart from the entry point through the features to their sub-features, each edge labelled with the consumer's action that takes it (a click, a command, a call, a message). Drawn to the `write-diagrams` skill, parsed with `aiview mermaid-check` after every edit.
3. **Features**, one section each, the three to five that matter first and every one a story's path crosses: what it does, how the consumer gets to it (the features before it, the state it needs), the observable state that says it was reached, gotchas and failure modes. How the harness drives it is the skill's, not the map's.
4. **Stories**, a table: id, the story in the consumer's words, the features on its path in order, the starting state, the expected outcome, the side effects that matter. The id is the plan's when the plan has one.

## Prove it

**Never hand over an unproven skill.** Run one mapped story through the generated skill, the anchor being the current commit. It fails: fix the skill or the map, run its cleanup, retry from a clean state. An application defect found on the way is reported as its own finding, never fixed silently inside this skill, and the story is never loosened to pass. Cleanup after every failed attempt, and the evidence of the passing run survives it.

Write the passing commit into `proven at`.

## Handoff

Where the skill was written, the map's URL, the features mapped, the stories listed, the story proven and its verification document, the cleanup done. Name `verification-skill-maintain` as what keeps both true.

## Red flags

| Thought | Reality |
|---|---|
| "The map goes in the repository next to the skill" | The skill is versioned with the code, the map lives in aiview. One document, flat. |
| "The story passes if I seed the record directly" | The starting state is established the way the consumer would, or the way the skill documents and the run can undo. |

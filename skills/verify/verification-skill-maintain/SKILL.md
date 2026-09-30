---
name: verification-skill-maintain
description: "Use when a project's `verify-<app>` skill, its scripts and references, or its feature map in aiview must be brought back in line with the application after it changed, from an anchor the caller names, a slice, a commit range or a date: on request at any time, or from execute-plan at a slot's end. Produces the updated skill and map with the changed stories re-proven. Not for a project without a verify skill (verification-skill-create), not for running stories on a current one, and not for code quality or review."
---

# Maintain a verification skill

**The skill and the map must stay true enough that an agent reaches and verifies a story without rediscovering the application.** Every change to the application that moves a launch, a path, a handle, a prerequisite, an outcome or a side effect is a change to one of them, and nothing else is.

## The anchor

- **The caller names it**: a slice, a commit range, a date. execute-plan passes the plan's whole range. None given: from the map's `proven at` to the current commit.
- **Locate both**: the `verify-<app>` skill in the project's local skill folder, and the map by `status --json` then `list --kind feature-map --json` (`aiview` skill). Either missing: stop and name `verification-skill-create`.

## Inspect

**Read the skill, its scripts, the map, then the diff over the anchor**, and list what changed among: features, entry points and navigation, routes, commands, tools or message contracts, authentication, prerequisites and state, expected outcomes, side effects, start-up, the harness and what a run creates.

**A story is affected when its path in the map crosses a changed feature, route, command, contract or prerequisite**, or when its expected outcome is what changed. Write the list before touching anything.

## Update

- **Change only what the diff moved**, in the skill and in the map alike. A path that still holds is left as written, however it could be reworded. A rewritten map loses the gotchas that were paid for.
- **The skill follows the repository**: a new start command, port or ready signal in Launch, a new handle in Drive, a new thing a run creates in Cleanup, a script that no longer matches the command it wraps. A harness that changed, a CLI that grew a web front end, points at the other reference of `verification-skill-create` and rewrites the sections that reference shapes.
- **A new consumer-facing feature gets its section in the map, its place in the navigation diagram, its handles in the skill's Drive, and a story.** A feature the design added with no story is a gap for the person, named in the handoff.
- **A removed feature retires its section, its handles and its stories**, said in the handoff.
- **The diagram is parsed** with `aiview mermaid-check` after every edit.

## Prove

**Run the affected stories, and one unaffected story, through the project's verify skill**, the anchor being the same.

- **A story that fails on the skill or the map**: fix it, cleanup, retry from a clean state.
- **A story that fails on the application**: a finding, reported apart. The story stays as designed, never loosened to pass. The skill and the map are updated regardless: they describe the application, not the wish.
- **Cleanup after every failed attempt**, and the evidence of the runs survives it.

Write the commit the runs passed against into `proven at`.

## Handoff

What changed in the skill and in the map, the stories added, retired and affected, each affected story's result with its verification document, the gaps for the person, the cleanup done. A story that cannot currently be verified is reported as such, never hidden and never removed.

## Red flags

| Thought | Reality |
|---|---|
| "Nothing in the diff touches the UI, so no story is affected" | A prerequisite, a contract or a side effect moves a story as surely as a screen. Walk each story's path. |

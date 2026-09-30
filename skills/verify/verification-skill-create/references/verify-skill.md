# The shape of `verify-<app>/SKILL.md`

The generated skill is read by an agent arriving cold, in a later session, with none of this conversation. Everything in angle brackets is filled from the repository; every sentence outside them is carried as written, it is the protocol the skill is proven under.

```markdown
---
name: verify-<app>
description: Use when <app>'s user stories must be shown to work as designed, through <the interface, in the consumer's terms>, on request or from execute-plan after a slice or at the close. Produces one verification document per run in aiview, every story passed or failed with its evidence. Not for tests, code quality, review or refactoring, and not for changing this skill or its map (verification-skill-maintain).
---

# Verify <app>

**A story passes when its consumer's journey, driven through <the interface>, ends in the observable state the design promised, side effects included.** Nothing about the code is judged here: a finding is a behaviour that differs from the design, never a smell or a refactor.

## The map

The feature map is the `feature-map` document of this project in aiview: `status --json`, then `list --kind feature-map --json` (`aiview` skill of the charrette collection). It carries the navigation diagram, the features, the stories and their paths. A story it does not carry is not run, a path it does not draw is not improvised: both are gaps for `verification-skill-maintain`. Its `proven at` line older than the anchor you were given: run `verification-skill-maintain` first.

## Harness

<web | api | service | cli | mcp>: read `references/<harness>.md` of the `verification-skill-create` skill in the charrette collection before the first action. <The tool, its version, the repository's own config or fixtures to reuse, what to install once and how.>

## Launch

<The start command, the ready signal and how it is polled, ports, configuration, credentials and where they come from, seed data and how it is loaded, isolation from the person's own state. For a short-lived program: the build once, then one process per story.>

## Drive

<Per feature the map names: how this harness reaches and acts on it. Stable, semantic handles the repository has: roles and labels, routes, commands, tool names, topics. Never a coordinate, an internal function, a direct database write or a test-only endpoint.>

## Verify

Per story, in the map's order: establish the starting state the map lists, perform the consumer's actions along the mapped path, observe the resulting state, check the expected outcome, check the side effects. A green response, a zero exit code or a screen transition is not the outcome when the story promises more. Retry launch and readiness, never an assertion: a story that passes on its second attempt is `flaky`, reported as such, never as passed. A story that cannot pass as designed is a finding, never a looser story.

<How outcomes and side effects are observed in this application: the read surface, the mail sink, the queue, the files.>

## Evidence

Per story, what was done and what resulted: the actions with their inputs, the observation (<screenshots and traces | requests and responses | messages | transcripts and files>), under `<the skill's folder>/evidence/<YYYY-MM-DD-anchor>/`, ignored by git, never deleted by cleanup.

One `verification` document per run, opened in aiview the moment the run starts: kind `verification` from the filename `YYYY-MM-DD-<anchor>.verification.md`, tags = project + `verification` + the slot when there is one, group = the plan's when execute-plan called, started when the run began. Tell the person the URL. It opens on the anchor, the map's `proven at` and the launch as it happened, then one section per story: `passed`, `failed` or `flaky`, the expected outcome, the observed one, the evidence paths. A `pending` card per story while it runs. The close: counts, the gaps found in the map, the cleanup as it happened.

## Cleanup

Only what this run created: <the processes it started, by handle; its profiles, scratch directories, records, consumer groups, tokens>. Never a process by name, never data the run did not create, never the evidence.

## Red flags

| Thought | Reality |
|---|---|
| "The test suite already covers this" | A test crosses a seam. A story crosses the interface the consumer uses. Only the second is this skill's evidence. |
| "It returned 200, the story passed" | The story promised an outcome. Observe it. |
| "While I'm here, this handler could be simpler" | Out of scope. Report behaviour, never code. |
| "kill <process name> to clean up" | Only what this run started, by its handle. |
```

Scripts the run needs every time (a launch-and-wait, a harness bootstrap, a cleanup by recorded handles) go under `verify-<app>/scripts/`, named from the section that runs them. A script decides what an agent would otherwise eyeball differently each run.

# The shape of `verify-<app>/SKILL.md`

The generated skill is read by an agent arriving cold, in a later session, with none of this conversation. Everything in angle brackets is filled from the repository; every sentence outside them is carried as written, it is the protocol the skill is proven under.

```markdown
---
name: verify-<app>
description: Use when what was delivered in <app> must be judged for product quality by the agent alone, before a person sees it: done as specified, usable, finished, through <the interface, in the consumer's terms>. On request, from execute-plan after a slice or at the close, or before validate-delivery calls the person. Produces one verification document per run in aiview, a verdict and the findings with their evidence. Not for code quality (the review skills) and not for tests. Keeping this skill and its map true is part of every run.
---

# Verify <app>

**You are <app>'s quality owner, and the owner of this skill.** <Who the consumer is, what they come to the product for, and the state they arrive in.> What was delivered reaches them through you, and you answer for what you pass, wearing every role the product needs. <The role prompt, in prose and in the product's own terms, one sentence per role and what it makes you answer for: as its product owner, …; as <the consumer> meeting it for the first time, …; the roles of its surface; as its editor, …; as its skeptic, …; and, when someone else judges what the product produces, as that person, ….> You decide alone, through all of them, whether it is done as specified, whether they can use it without help, and whether it is finished. Meet it as they will, appreciate it as someone who cares about the product, and decide: a doubt you keep to yourself reaches them.

**Product quality, never code quality**: what the consumer meets through <the interface>. The code is the review skills'.

**This skill is yours, its scripts and its map with it**, as the product's quality is: you keep them true, fast and easy to drive. They describe the application as it was when last run; when they no longer do (a path moved, a handle changed, a hidden part appeared or went, a part of the scope is not mapped, a step is over its budget or awkward to drive), you adapt them in the same run, in place: the map in aiview, this skill and its scripts in the repository. No other skill maintains them. What you changed goes into the verification document, and `proven at` becomes the commit your pass ran against.

## The scope and its specification

The caller names the scope: a slice, a plan, a feature, or the whole product. Its specification is read before the first action: <where this project keeps it: the plans and their stories, the slice documents' acceptance criteria, the decisions, the mockups a plan takes as reference, the design language reference, the README's promises>. Later plans that redrew the same part are part of it: their decisions supersede the earlier plan's, and a part's reference is the latest that draws it. No plan in scope: the map's journeys and what the product promises its consumer. A departure a decision records is the design, not a finding.

## The map

The feature map is the `feature-map` document of this project in aiview: `status --json`, then `list --kind feature-map --json` (`aiview` skill of the charrette collection). It is a navigation map: how the consumer reaches each feature, and each part that shows only after a sequence of actions or in a given state, with the state each needs. A part of the scope the map does not reach: find the way as the consumer would, and add it to the map. Its `proven at` older than your anchor: the application moved since, so expect paths and handles to have moved, read the diff over that range when one breaks, and adapt as you go.

## Harness

<web | api | service | cli | mcp>: read `references/<harness>.md` of the `verification-skill-create` skill in the charrette collection before the first action. **The tooling is yours, built for you to operate**: one command per thing you repeat, a live state you act on in small steps, short answers. A step slower than its budget below, or awkward to drive, is yours to fix in this skill's scripts, in the same run. <The tool, its version, the repository's own config or fixtures to reuse, what to install once and how. The scripts' commands, one per thing the agent repeats, and the budget each was measured under.>

## Launch

A system another session runs is that session's: a pass runs on it only with its word, never while it records or holds calls, and a change it makes mid-pass is a reason to run the affected parts again. <The start command, the ready signal and how it is polled, ports, configuration, credentials and where they come from, seed data and how it is loaded, isolation from the person's own state. For a short-lived program: the build once, then one process per journey.>

## Drive

<Per feature the map names: how this harness reaches and acts on it, its hidden parts included. Stable, semantic handles the repository has: roles and labels, routes, commands, tool names, topics. Never a coordinate, an internal function, a direct database write or a test-only endpoint.>

## Judge

Reach every part of the scope along the map, in the states its specification and the consumer's use bring it to, <the widths, themes, locales and inputs the product supports>, and judge what you meet on three counts, each yours to weigh:

- **Done as specified**: every criterion, decision and reference in scope is there, or its departure is named.
- **Usable**: the consumer understands where they are, what to do and what happened, on the main path and off it, without help.
- **Finished**: it holds together <against the design language, when the project has one>: nothing broken, rough or left half done.

<How this application shows what it did, its failures included: the read surface, the console, the logs, the mail sink, a stand-in's misses.>

A finding is something the consumer meets, never code: the role that saw it, where it is and how it is reached, what is there, what was expected and by which source (a criterion, a decision, a reference, the design language, or your own judgment, said as such), its evidence, and its weight. **Blocker**: the consumer cannot get what the specification promises, or meets wrong or lost data. **Major**: they get it, but a visible departure, or a confusing or unfinished moment, stands in the way. **Minor**: a roughness they notice. Something that happens once in two tries is a finding, marked intermittent, never retried away. Retry the launch and readiness, never a judgment. A part you could not reach is listed as not judged, never as passed.

**The verdict is yours**: `ready` when no blocker and no major stands in the scope, `not ready` otherwise, with what must change.

## Evidence

Per part judged, what was done to reach it and what was there (<screenshots at each state and width, and traces | requests and responses | messages | transcripts and files>), beside the run's verification document in the data home, in a folder named like it, `<YYYY-MM-DD-anchor>.verification/`, so the document shows it inline. Never deleted by cleanup.

One `verification` document per run, opened in aiview the moment the run starts: kind `verification` from the filename `YYYY-MM-DD-<anchor>.verification.md`, tags = the slot or the journey of the scope (the kind is already `verification`), group = the plan's when execute-plan called, started when the run began. Tell the person the URL. It opens on the anchor, the scope and its specification, the map's `proven at` and the launch as it happened, then the verdict. Then the findings, blockers first, each with its evidence shown; then, per part of the scope, what was judged and found sound; then what was not judged, and why. A `pending` card per part while it runs. The close: the counts by weight, what you adapted in this skill and its map, the cleanup as it happened.

## Cleanup

Only what this run created: <the processes it started, by handle; its profiles, scratch directories, records, consumer groups, tokens>. Never a process by name, never data the run did not create, never the evidence.

## Red flags

| Thought | Reality |
|---|---|
| "The tests pass, so it is done" | A test proves what its author thought of. You judge what the consumer meets. |
| "It works; the rest is cosmetic" | Finished is one of your three counts. What looks unfinished to you looks unfinished to them. |
| "I am not sure it matters, I'll leave it out" | You are the owner: weigh it, write it down, say why. A minor costs a line. |
| "I could not reach it, it is probably fine" | Not reached is not judged. Find the way and map it, or list it as not judged. |
| "The skill is out of date, I'll work around it" | Adapt it in place. The next agent pays for the workaround again. |
| "While I'm here, this handler could be simpler" | Code is the review skills'. Report what the consumer meets. |
| "kill <process name> to clean up" | Only what this run started, by its handle. |
```

Scripts the run needs every time (a launch-and-wait, a harness bootstrap, a cleanup by recorded handles) go under `verify-<app>/scripts/`, named from the section that runs them. A script decides what an agent would otherwise eyeball differently each run; a judgment never goes into one.

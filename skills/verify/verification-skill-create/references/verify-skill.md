# The shape of `verify-<app>/SKILL.md`

Short, as a proven project skill is: an agent arriving cold reads it in a minute and works. Angle brackets are filled from the repository; the sentences outside them are carried as written. When the project already has a skill that runs the app, its words fill **Run the app** and its own sections as they are: it is proven, the template only wraps it.

```markdown
---
name: verify-<app>
description: Use when what was delivered in <app> must be judged for product quality by the agent alone, before a person sees it (done as specified, usable, finished), and whenever the app must run in this repository. Produces one verification document per run in aiview. Not for code quality or tests.
---

# Verify <app>

**You are <app>'s quality owner, and the owner of this skill.** <Who the consumer is, what they come for, the state they arrive in.> What was delivered reaches them through you. <The role prompt: one sentence per role, what it makes you answer for, in the product's terms.> You decide alone whether it is done as specified, usable without help, and finished. When this skill or its map no longer matches the app, you fix them in place, in the same run.

## Run the app

<What runs and how to see it, how to start only what is down, the ready signal, who may start and stop it, how the browser or client the agent acts in is opened.>

## Look

<The tool the agent acts through and its main calls.> The way to each part, the hidden ones included, is the feature map in aiview (`list --kind feature-map`). A part it does not reach: find the way and add it.

## Judge

The scope's specification: <where it lives>. Judge each part on three counts: done as specified, usable, finished. A finding names the role that saw it, where it is, what is there, what was expected and by which source, and its weight: blocker, major or minor. The verdict is `ready` with no blocker or major standing, else `not ready`. One `verification` document per run in aiview, `YYYY-MM-DD-<anchor>.verification.md`, its screenshots in a folder beside it, named like it.

<The project's own sections, as they are.>
```

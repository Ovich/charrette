---
name: aiview
description: Use whenever a skill or task produces a document the user should look at while it evolves: a brainstorm board, a spec, a plan, a design language, an HTML mockup, a PR analysis, a review report, a live PDF. aiview renders Markdown (GFM + mermaid), HTML mockups and PDFs on localhost with live reload and keeps a versioned, tagged, grouped index of every such document. This skill is the contract for using it; do not improvise around it.
---

# aiview: the contract

aiview is a local viewer + index for documents the agent writes for a human to read. The
**files are the truth** (they live in the repo, under `docs/`); the index (`aiview.sqlite`
next to the tool) only points at them.

The tool lives **next to this SKILL.md**: `<skill-dir>/aiview.mjs`, where
`<skill-dir>` is this skill's base directory (the harness states it when the skill
loads). Node ≥ 22.5. One-time per machine: `npm install && npm run build` in
`<skill-dir>`. Every verb prints exactly this if the build is missing, and
`open`/`serve` rebuild the UI themselves when only `dist/` is missing.

## Invocation

This skill is operated by intent: a caller (user or another skill) states what it
wants, this skill maps it to a verb and runs it:

| The ask | Verb |
|---|---|
| "show / open this document (with tags …, in group …)" | `open` |
| "register this document, don't open it" | `add` |
| "change its kind / tags / group / start time" | `update` |
| "what documents exist (for kind/tag …)?" | `list` |
| "drop it from the index" | `remove` |
| "is the viewer running?" | `status` |
| "start / restart the viewer" | `serve --detach` |

## When to use

- You are about to write a document meant to be **read and reacted to**: board, spec,
  plan, reference, mockup, analysis, report, live PDF.
- Not for code, tests, configs, or files nobody opens in a browser.

## The four rules

1. **`open` is the standard gesture.** One idempotent call registers the file (kind,
   tags, group), ensures a server is running (starts one detached if needed), and
   prints the URL to tell the user. No background task to babysit, no add+serve dance:

```sh
node <skill-dir>/aiview.mjs open docs/specs/2026-08-23-topic.brainstorm.md --tag <project> --tag <topic>
```

2. **Kind is mandatory and comes from the filename** (`<name>.<kind>.md|html`,
   preferred) or `--kind`. Kinds in use: `brainstorm`, `spec`, `plan`, `reference`,
   `mockup`, `pr-analysis`, `report`, `pdf`. Pick an existing one before inventing a
   new one; a new kind is a new colour chip everyone sees, so it must name a *type of
   document*, not a topic. Topics go in **tags** (free, repeatable `--tag`).
3. **Group documents that are one piece of work.** A board and the spec and plan it
   produced, a CV and letter for one application: give them the same
   `--group <slug>`, and set a display name once with `--group-title "…"`. Groups
   render as collapsible containers in the sidebar; a doc belongs to at most one
   group. Tags relate documents by topic; the group says "same work".
4. **Set the start date-time honestly** (`--started <ISO>` when the discussion began
   before the file), **never edit `aiview.sqlite` by hand, never register scratch
   files**, and fix metadata with `update` (`--kind`, `--tag`/`--untag`,
   `--group`/`--ungroup`, `--group-title`, `--started`) instead of remove + re-add.

## Commands

```sh
A="node <skill-dir>/aiview.mjs"
$A open   <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO] [--open]
$A add    <file> [same flags]                    # register only, no server
$A update <file|#id> [--kind k] [--tag t] [--untag t] [--group g|--ungroup] [--group-title T] [--started ISO]
$A list   [--kind k] [--tag t]...
$A remove <file|#id>...                          # index only, files untouched
$A serve  [file] [--port 4321] [--open] [--detach]
$A status                                        # server up? port? sqlite? doc count?
```

Every verb takes `--json` for machine-readable output. Prefer it when you parse the
result. `status --json` answers "is a server running and where" in one call; a stale
pidfile (dead process) is detected and reported, and `open` safely replaces it.

## What the user sees

Left: documents newest-activity first: search, kind chips (deterministic colour per
kind, click to filter), tag chips (multi-select), grouped docs inside collapsible
containers (display title + member count, members in reading order), ungrouped docs
flat, missing files struck through. Right: title, **absolute local path
(click-to-copy)**, kind · started · tags · updated, then the rendered document (GFM +
mermaid for Markdown, sandboxed iframe with viewport presets for HTML mockups, the
browser's PDF viewer for PDFs), live-reloading on save.

## Contract for calling skills

A skill that produces viewable documents says: *"Register and serve via the `aiview`
skill (`tools/aiview/SKILL.md` in this collection)"* (name plus
collection-relative path, never an absolute path, so the reference works from any
checkout with any harness) and then states only the **metadata semantics** of its
document type: which kind, which tags, which group, when the start
time predates the file. It never restates command syntax; this file owns the syntax,
so flags evolve in one place. Example of a caller's whole instruction:

> Open the board via the `aiview` skill the moment you create it: kind `brainstorm`
> (from the filename), tags = project + topic, group = the topic (titled), started
> honestly. Tell the user the URL it prints.

## Conventions that keep the index useful

- File names: `YYYY-MM-DD-<topic>.<kind>.md` under `docs/specs/`, `docs/design/`,
  `docs/design/mockups/`, `docs/analysis/`… (the date is the start date).
- One document per subject; iterate the same file rather than creating v2 files.
  A rejected variant is **removed** from the index (and usually deleted).
- When a board produces a spec or plan, register them with the board's tags and the
  same `--group`, and note the paths at the top of the board.
- Mockups: HTML, self-contained, tokens from the project's design language (see the
  `frontend-design` skill).

## Red flags

| Thought | Reality |
|---|---|
| "I'll show it as a claude.ai artifact instead" | The user asked for local, versioned, offline. Use aiview. |
| "I'll register it later" | Later never comes; the start time is wrong and the doc is invisible. `open` it on creation. |
| "I'll run serve in a background task and watch it" | `open`/`serve --detach` daemonize; `status` finds the server. Nothing to babysit. |
| "This needs a new kind: `autograding`" | That's a topic → tag. Kinds are document types. |
| "These two docs are related, one more tag will do" | Same piece of work → same `--group`. Tags are topics, groups are identity. |
| "Wrong kind: remove and re-add" | `update <file> --kind <k>` in one call, history intact. |
| "I'll clean up by deleting rows in the sqlite" | Use `remove`; the index is shared state. |

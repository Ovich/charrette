---
name: aiview
description: Use whenever a skill or task produces a document the user should look at while it evolves: a brainstorm board, a spec, a plan, a design language, an HTML mockup, a PR analysis, a review report, a live PDF. aiview renders Markdown (GFM + mermaid), HTML mockups and PDFs on localhost with live reload and keeps a tagged, grouped index of every such document, outside every project repository. This skill is the contract for using it; do not improvise around it.
---

# aiview: the contract

aiview is a local viewer + index for documents the agent writes for a human to read. The
**files are the truth**; the index (`aiview.sqlite`) only points at them.

The tool lives **next to this SKILL.md**: `<skill-dir>/aiview.mjs`, where
`<skill-dir>` is this skill's base directory (the harness states it when the skill
loads). Node ≥ 22.5.

## Where everything lives

Two roots, and they never mix:

| Root | Holds | Versioned? |
|---|---|---|
| The checkout, `<skill-dir>` | code, `dist/`, `node_modules/` | Yes, it *is* the repo. Entirely rebuildable, safe to delete. |
| The **data home**: `$CHARRETTE_HOME`, else `charrette_appdata` in the OS's home directory | `aiview.sqlite`, the server's pid/port files, and **every document**, under `docs/<project-slug>/` | Not in any *project* repo. It may be its own repo, purely to sync between devices. |

These documents are working material between a developer and an agent. They exist to
agree on what is being built, and to be efficient context while it is built. They are
not repo content, and most are obsolete the moment the PR merges. Never write one
inside a project repository.

One-time, on a first clone or a new machine:

```sh
cd <skill-dir> && npm install && npm run build && node aiview.mjs init
```

`init` creates the data home, adopts an index left behind by a pre-appdata install, and
prints the three paths. Every verb prints the build command if the build is missing, and
`open`/`serve` rebuild the UI themselves when only `dist/` is missing. `status` reports
the paths any time; `status --json` exposes them as `home`, `docs`, `sqlite`, `tool`.
Read `docs` from there rather than assuming, since `CHARRETTE_HOME` may be set.

## Projects

Every document belongs to exactly one project — CIIP, JOBS, Openmidac, Roster — and a
project is a **declared record the agent manages**, not a value guessed from a path:

| Field | Meaning |
|---|---|
| `slug` | What you call it. Also the directory name and the sidebar label |
| `title` | Optional longer name; falls back to the slug |
| `paths` | The **working directories** the project covers — absolute, and therefore machine-specific |

**`paths` never decides where a document lives.** It answers a different question, asked
before a file exists: *I am working in `C:\CIIP\portail` — which project is that?*
Longest prefix wins, so a sub-repo can be split out later without disturbing the parent.
A document's project is the folder it sits in, full stop.

```sh
$A project add CIIP --path <the CIIP working dir on THIS machine>   # also makes <docs>/CIIP/
$A project list                                                      # slugs, counts, directories, coverage
$A use CIIP                                                          # set the active project
```

`paths` is a **list**, which is what makes a synced data home work across machines: give
the same project one entry per device (`C:\CIIP` on Windows, `/Users/you/CIIP` on macOS)
and the longest-prefix match picks whichever exists locally. Adding a path never removes
the others.

### The active project is shared

One active project, held by the server and followed by every open tab. `use` moves it,
and so does `open`: opening a document switches to that document's project, so the
selector never disagrees with what is on screen. The user switching in the sidebar is
the same write. That is why the agent saying "we're on CIIP now" re-scopes a tab the
user already has open.

## Where a document goes

**Never write a path literal. Never join one. Ask the tool.**

Home directories, drive letters and separators differ per machine and per OS — `~` does
not expand in PowerShell, `C:\…` means nothing on macOS, and the same data home is
cloned to different places on different devices. So the only correct way to find out
where a document goes is to ask:

```sh
$A path <YYYY-MM-DD-topic.kind.md>          # prints the absolute path, joined for THIS OS
```

That is the whole gesture. `path` resolves the active project (or `--project <slug>`),
creates the directory if needed, and prints a path you write to verbatim. Add `--json`
for `{path, dir, project}` when you are parsing.

The full opening move for a skill about to write a document:

```sh
$A status --json          # cwdProject: which project this working directory belongs to
$A use <slug>             # only if cwdProject names a different project than the active one
F=$($A path 2026-08-24-topic.brainstorm.md)
# …write the document at $F…
$A open "$F" --tag <slug> --tag <topic>
```

`status --json` also reports `projectDocs` (the active project's directory) and `home`,
for the rarer cases where you need the directory rather than a file in it.

- The date is when the **work** started, not when the file was created.
- A location the user states explicitly still wins over all of this.
- **Tag with the project as well** (`--tag <slug>`): tags are how the sidebar filters
  *within* a project, and how a document stays findable in All-projects mode.

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
| "this one is filed under the wrong project" | `move --project <slug>` |
| "this one is in the wrong place / still inside a repo" | `move` |
| "we're working on CIIP now" | `use` |
| "what projects exist / add one / drop one" | `project list \| add \| rm` |
| "where does this document go?" | `path <filename>` |
| "which project am I in? is the viewer running?" | `status --json` |
| "start / restart the viewer" | `serve --detach` |

## When to use

- You are about to write a document meant to be **read and reacted to**: board, spec,
  plan, reference, mockup, analysis, report, live PDF.
- Not for code, tests, configs, or files nobody opens in a browser.

## The five rules

1. **`open` is the standard gesture.** One idempotent call registers the file (kind,
   tags, group), ensures a server is running (starts one detached if needed), and
   prints the URL to tell the user. No background task to babysit, no add+serve dance:

```sh
F=$(node <skill-dir>/aiview.mjs path 2026-08-23-topic.brainstorm.md)   # never hand-built
node <skill-dir>/aiview.mjs open "$F" --tag <project> --tag <topic>
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
5. **Retire the work when it merges.** Before that point, distil whatever outlives it
   into somewhere that *is* versioned: durable rules into `AGENTS.md` (the
   `project-conventions` skill), the story of the change into the PR description. Then
   tag the group done — `update #<id> --tag done` per member. The files stay on disk,
   so "what did we decide about X in March" is still answerable; `remove` them from the
   index only when you are sure you will never look again.

## Commands

```sh
A="node <skill-dir>/aiview.mjs"
$A open   <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO] [--open]
$A add    <file> [same flags]                    # register only, no server
$A update <file|#id> [--kind k] [--tag t] [--untag t] [--group g|--ungroup] [--group-title T] [--started ISO]
$A list   [--kind k] [--tag t]... [--project p | --all]   # defaults to the active project
$A remove <file|#id>...                          # index only, files untouched
$A move   <file|#id>... [--project <slug>]        # refile: file + index together
$A serve  [file] [--port 4321] [--open] [--detach]
$A project <add|list|rm> [slug] [--title T] [--path P]...
$A use    <slug|*>                               # set the active project ('*' = All projects)
$A path   <filename> [--project <slug>]          # where it belongs, joined for this OS
$A status                                        # home? projectDocs? cwdProject? server up?
$A init                                          # create the data home (first clone / new machine)
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
skill (`../../tools/aiview/SKILL.md` in this collection)"* (name plus a path
relative to the calling skill's own file — every skill sits at `skills/<group>/<name>/`,
so the viewer is `../../tools/aiview/SKILL.md` — never an absolute path, so the
reference works from any checkout with any harness) and then states only the **metadata semantics** of its
document type: which kind, which tags, which group, when the start
time predates the file. It never restates command syntax and never names a directory:
this file owns both, so flags and layout evolve in one place. A caller says "the
board" or "the analysis"; where it lands is settled above. Example of a caller's whole
instruction:

> Open the board via the `aiview` skill the moment you create it: kind `brainstorm`
> (from the filename), tags = project + topic, group = the topic (titled), started
> honestly. Tell the user the URL it prints.

## Conventions that keep the index useful

- File names: `YYYY-MM-DD-<topic>.<kind>.md`, flat inside the project's folder in the
  data home (the date is the start date). One directory per project, no `specs/` or
  `analysis/` subdivision: kind chips and groups already do that job in the sidebar.
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
| "Wrong place: remove, move the file, add it back" | `move` does both and keeps the id, start time, tags and group. Re-adding resets the start time to now. |
| "Wrong project: `update --project`" | The project is a directory, not metadata — the file has to move. `move <ref> --project <slug>`. `update` owns kind, tags and group. |
| "I'll clean up by deleting rows in the sqlite" | Use `remove`; the index is shared state. |
| "I'll put the spec in the repo so the team can see it" | It travels in the PR description, not the tree. Documents live in the data home, unversioned. |
| "`docs/` in the project is the natural home" | That was the old layout. A document inside a repo gets reviewed, goes stale, and outlives its usefulness. |
| "The work merged, I'll leave the board where it is" | Distil what lasts into `AGENTS.md` and the PR, then tag the group `done`. |
| "I'll build the path: `~/charrette_appdata/docs/CIIP/…`" | `aiview path <name>`. The layout has one owner and it is not the caller — and a hand-built path is wrong on the next OS, the next machine, or in PowerShell where `~` does not expand. |
| "I'll just join `projectDocs` with the filename myself" | Separators differ. `path <name>` joins it for the running OS; that is the whole reason the verb exists. |
| "I'm in `C:\CIIP\portail`, so the project is `portail`" | That was the old derived behaviour and the bug this replaced. `cwdProject` says CIIP. |
| "I'll add `--path` pointing at where the documents are" | `paths` covers **working directories**. Documents always live in `<docs>/<slug>/`. |
| "Switch project, then open the document" | `open` already switches. One call. |

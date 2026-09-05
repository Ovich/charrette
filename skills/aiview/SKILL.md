---
name: aiview
description: Use whenever a document is produced for the user to read and react to while it evolves: a brainstorm board, a spec, a plan, a design language, a mockup or prototype, a PR analysis, a review report, a live PDF. Also when a document must be registered, opened, listed, moved or retired, or a mockup's bindings checked. Not for code, tests or configuration, or any file nobody opens in a browser.
---

# aiview: the contract

aiview is a local viewer and an index for the documents an agent writes for a person to
read. The files are the truth; the index (`aiview.sqlite`) only points at them. This
file is the contract for using it: follow it rather than improvising around the tool.

The tool lives next to this file: `<skill-dir>/aiview.mjs`, `<skill-dir>` being this
skill's directory as the harness states it. Node 22.5 or later, nothing else.

## Two roots

| Root | Holds | Versioned |
|---|---|---|
| The checkout, `<skill-dir>` | code, `dist/`, `dist-cli/` | yes, it is the repo, rebuildable, safe to delete |
| The data home, `$CHARRETTE_HOME` or `charrette_appdata` in the OS home directory | `aiview.sqlite`, the server's pid and port files, every document under `docs/<project>/` | never in a project repo; it may be its own repo, to sync between machines |

A document is working material between a person and an agent, obsolete once the PR
merges. Never write one inside a project repository. On a fresh clone, a new machine,
or when a verb prints a build command: `references/setup.md`.

## Where a document goes

Never write a path literal and never join one: separators, drive letters and home
directories differ per machine, and `~` does not expand in PowerShell. Ask the tool.

```sh
A="node <skill-dir>/aiview.mjs"
$A status --json          # cwdProject: the project this working directory belongs to
$A use <slug>             # only if cwdProject differs from the active project
F=$($A path 2026-08-24-topic.brainstorm.md)   # the absolute path, joined for this OS
# write the document at $F
$A open "$F" --tag <slug> --tag <topic>
```

A project is a folder of the data home, `docs/<slug>/`, and a document's project is
the folder it sits in. `path` resolves the active project (or `--project <slug>`),
creates the folder if needed, and prints the path to write to verbatim; `--json` gives
`{path, dir, project}`. The date in the name is when the work started, not when the
file was created. A location the user states explicitly wins over all of this. Tag
with the project slug as well as the topic: tags filter within a project, and keep a
document findable in All-projects mode. To declare a project, on a new machine, or when
`status --json` reports no `cwdProject` for your directory: `references/projects.md`.

## Invocation

The caller, a person or another skill, states what it wants; this skill maps the ask
to a verb:

| The ask | Verb |
|---|---|
| "show / open this document (with tags, in group)" | `open` |
| "register this document, don't open it" | `add` |
| "change its kind / tags / group / start time" | `update` |
| "what documents exist (for kind/tag)?" | `list` |
| "drop it from the index" | `remove` |
| "this one is filed under the wrong project" | `move --project <slug>` |
| "this one is in the wrong place / still inside a repo" | `move` |
| "we're working on CIIP now" | `use` |
| "what projects exist / add one / drop one" | `project list \| add \| rm` |
| "where does this document go?" | `path <filename>` |
| "what does this mockup offer to siblings, what does it pull?" | `components <file\|#id>` |
| "do this mockup's bindings resolve?" | `check <file\|#id>` |
| "do this document's diagrams parse?" | `mermaid-check <file\|#id>` |
| "which project am I in? is the viewer running?" | `status --json` |
| "start / restart the viewer" | `serve --detach` |

`open` is the standard gesture: one idempotent call registers the file (kind, tags,
group), starts a detached server if none runs, and prints the URL to tell the user.
Nothing to babysit.

## Commands

```sh
$A open   <file> [--kind k] [--tag t]... [--group g [--group-title T]] [--started ISO] [--open]
$A add    <file> [same flags]                    # register only, no server
$A update <file|#id> [--kind k] [--tag t] [--untag t] [--group g|--ungroup] [--group-title T] [--started ISO]
$A list   [--kind k] [--tag t]... [--project p | --all]   # defaults to the active project
$A remove <file|#id>...                          # index only, files untouched
$A move   <file|#id>... [--project <slug>]        # refile: file and index together
$A serve  [file] [--port 4321] [--open] [--detach]
$A project <add|list|rm> [slug] [--title T] [--path P]...
$A use    <slug|*>                               # the active project, '*' for all
$A path   <filename> [--project <slug>]          # where it belongs, joined for this OS
$A components <file|#id>                         # what a mockup offers (name, tag, rule violations) and pulls
$A check      <file|#id>                         # resolve a host as the server does; errors as text, exit 1 if any
$A mermaid-check <file|#id>                      # parse every mermaid block as the viewer will; failures with their line, exit 1 if any
$A pending add  <file|#id> --label L [--note N]   # work the reader is still waiting on
$A pending done <#pendingId>                     # it landed
$A pending list [<file|#id>] | clear <file|#id>
$A status                                        # home, project, cwdProject, server
$A init                                          # create the data home
```

Every verb takes `--json`; prefer it when parsing. `status --json` says whether a
server runs and where; a stale pidfile is reported, and `open` replaces it.

## Registering a document

- **File name**: `YYYY-MM-DD-<topic>.<kind>.md`, flat in the project's folder, no
  subfolders: kind chips and groups do that job in the sidebar.
- **Kind** is mandatory, from the filename or `--kind`. Kinds in use: `brainstorm`,
  `spec`, `plan`, `reference`, `mockup`, `pr-analysis`, `report`, `pdf`. A new kind is a
  new colour chip everyone sees: it names a type of document, never a topic. Topics
  are tags.
- **Group** the documents of one piece of work, a board with its spec and plan, a CV
  with its letter: the same `--group <slug>`, a title set once with `--group-title`. A
  document belongs to at most one group. Tags say "same topic", the group says "same
  work". A spec or plan a board produces takes the board's tags and group, and the
  board notes their paths at its top.
- **Start time**: `--started <ISO>` when the discussion began before the file existed.
- **One document per subject**: iterate the file, never a v2. A rejected variant is
  removed from the index and usually deleted.
- **Fix metadata with `update`**, never remove and re-add, which resets the start
  time. Never edit `aiview.sqlite` by hand. Never register scratch files.
- **Mockups**: HTML, self-contained, tokens from the project's design language, per the
  `frontend-design` skill.

## Publishing before the work is done

A long document is useful before it is finished if it says what is still coming.
`pending add` puts a card at the head of the document for each unit of work still
running, `pending done` removes it when the section is written. Use it whenever you
fan out to subagents: one card per agent as it is dispatched, closed when its result
lands, on the failure paths too. The properties and the wording: `references/pending.md`.

## Retiring the work

The documents of a piece of work are obsolete when it merges. Before that, distil what
outlives it into somewhere versioned: durable rules into `AGENTS.md` (the
`project-conventions` skill), the story of the change into the PR description. Then tag
the group done, `update #<id> --tag done` per member. The files stay on disk, so "what
did we decide in March" is still answerable; `remove` only what you will never look at
again.

## Contract for calling skills

A skill that produces documents says "Register and serve via the `aiview` skill
(`../aiview/SKILL.md` in this collection)", a relative path since every skill is a
sibling, then states only the metadata of its document type: kind, tags, group, and
when the start time predates the file. It never restates command syntax and never
names a directory: this file owns both, so flags and layout change in one place. A
caller's whole instruction, as an example:

> Open the board via the `aiview` skill the moment you create it: kind `brainstorm`
> (from the filename), tags = project + topic, group = the topic (titled), started
> honestly. Tell the user the URL it prints.

When you describe the viewer to the person, or explain a mode or a toolbar:
`references/viewer.md`.

## Red flags

| Thought | Reality |
|---|---|
| "I'll show it as a claude.ai artifact instead" | The user asked for local, versioned, offline. Use aiview. |
| "I'll register it later" | The start time is then wrong and the document invisible. `open` it on creation. |
| "I'll run serve in a background task and watch it" | `open` and `serve --detach` daemonise; `status` finds the server. |
| "This needs a new kind: `autograding`" | That is a topic, so a tag. Kinds are document types. |
| "These two documents are related, one more tag will do" | Same piece of work, same `--group`. |
| "Wrong kind: remove and re-add" | `update <file> --kind <k>`, history intact. |
| "Wrong project: `update --project`" | The project is a folder, not metadata: `move <ref> --project <slug>`. |
| "I'll build the path myself" | `path <name>`. A hand-built path is wrong on the next OS, the next machine, or in PowerShell. |
| "I'm in `C:\CIIP\portail`, so the project is `portail`" | `status --json` says which project claims the directory; longest declared path wins. |
| "I'll add `--path` pointing at where the documents are" | `paths` are working directories. Documents always live in `docs/<slug>/`. |

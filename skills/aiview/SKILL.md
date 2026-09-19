---
name: aiview
description: "Use whenever a document is produced for the user to read and react to while it evolves: a brainstorm board, a plan, a design language, a mockup or prototype, a PR analysis, a review report, a live PDF. Also when a document must be registered, opened, listed, moved or retired, or a mockup's bindings checked. Not for code, tests or configuration, or any file nobody opens in a browser."
---

# aiview: the contract

**aiview** is the local viewer and index for the documents an agent writes for a person to read. The tool is `<skill-dir>/aiview.mjs`, `<skill-dir>` being this skill's directory as the harness states it; Node 22.5 or later. **`$A --help` lists every verb with its flags; every verb takes `--json`, preferred when parsing.**

## The checkout and the data home

| Root | Holds |
|---|---|
| The checkout, `<skill-dir>` | code, `dist/`, `dist-cli/`; rebuildable |
| The data home, `$CHARRETTE_HOME` or `charrette_appdata` in the OS home directory | `aiview.sqlite`, the server's pid and port files, every document under `docs/<project>/` |

- **Every document lives in the data home, outside any project repository.**
- **On a fresh clone, a new machine, or when a verb prints a build command**: `references/setup.md`.

## Where a document goes

**Ask the tool for the path**: a hand-built one is wrong on the next OS, the next machine, or in PowerShell.

```sh
A="node <skill-dir>/aiview.mjs"
$A status --json          # cwdProject: the project this working directory belongs to
$A use <slug>             # only if cwdProject differs from the active project
F=$($A path 2026-08-24-topic.brainstorm.md)   # the absolute path, joined for this OS
# write the document at $F
$A open "$F" --tag <slug> --tag <topic>
```

- **`open` is the standard gesture**, on creation: it registers the file, starts a detached server if none runs, and prints the URL to tell the user.
- **A project is a folder of the data home, `docs/<slug>/`**; refiling is `move <ref> --project <slug>`, and `status --json` says which project claims a working directory.
- **The date in the name is when the work started.**
- **A location the user states explicitly wins.**
- **Tag with the project slug as well as the topic.**
- **To declare a project, or when `status --json` reports no `cwdProject`**: `references/projects.md`.

## Registering a document

- **File name `YYYY-MM-DD-<topic>.<kind>.md`**, flat in the project's folder.
- **Kind is mandatory**, from the filename or `--kind`: `brainstorm`, `plan`, `slice`, `module`, `reference`, `mockup`, `pr-analysis`, `report`, `pdf`, `roadmap` (one per project), `feature-map` (one per project), `verification` (one per run). A kind is a type of document; a topic is a tag.
- **One `--group <slug>` per piece of work**, titled once with `--group-title`, at most one group per document.
- **A plan takes its own group, `<topic>-plan`**, shared with its slice documents and nothing else.
- **`--started <ISO>` when the discussion began before the file existed.**
- **One document per subject**: iterate the file, never a v2. A rejected variant is removed from the index.
- **Fix metadata with `update`.** `aiview.sqlite` is the tool's to write, and scratch files stay unregistered.
- **Mockups are self-contained HTML**, per the `frontend-design` skill.

## Publishing before the work is done

**`pending add` puts a card at the head of the document for each unit of work still running; `pending done` removes it when the section is written.** On a fan-out, one card per subagent as it is dispatched, closed when its result lands, on the failure paths too. The properties and the wording: `references/pending.md`.

## Pointing at a mockup

**`show <file|#id> --component <Name>... [--variant <v>]` moves every open tab to the mockup and lights those components**, dimming the rest, until the next `show` or until the person stops it. `components <file|#id>` lists every name on the page and its variants, and `show` refuses any other, listing the ones it has. It prints the link that does the same in a tab opened later, and says how many tabs heard it. When to point and how to word the question: the `point-at` skill.

## Retiring the work

- **Before the merge, distil what outlives the work into somewhere versioned**: durable rules into `AGENTS.md` (the `project-conventions` skill), the story of the change into the PR description.
- **Then tag the group done**, `update #<id> --tag done` per member. The files stay on disk.

## Contract for calling skills

**A skill that produces documents says "through the `aiview` skill"**, then states only its document's metadata: kind, tags, group, and a start time that predates the file. Command syntax and directories stay here.

**To describe the viewer, a mode or a toolbar to the person**: `references/viewer.md`.

## Red flags

| Thought | Reality |
|---|---|
| "I'll show it as a claude.ai artifact instead" | The user asked for local, versioned, offline. |
| "I'll run serve in a background task and watch it" | `open` and `serve --detach` daemonise; `status` finds the server. |
| "I'll add `--path` pointing at where the documents are" | `paths` are working directories. Documents live in `docs/<slug>/`. |

# Projects

Read when a project must be declared, when a machine is new, or when `status --json`
reports no `cwdProject` for the directory you work in.

A project is a declared record, never a value guessed from a path:

| Field | Meaning |
|---|---|
| `slug` | The name. Also the folder name under `docs/` and the sidebar label. |
| `title` | Optional longer name; falls back to the slug. |
| `paths` | The working directories the project covers, absolute, therefore machine-specific. |

```sh
$A project add CIIP --path <the CIIP working dir on THIS machine>   # also creates docs/CIIP/
$A project list                                                      # slugs, counts, directories, coverage
$A use CIIP                                                          # the active project
```

`paths` never decides where a document lives; documents always live in `docs/<slug>/`.
It answers the other question, asked before a file exists: "I am working in
`C:\CIIP\portail`, which project is that?" The longest declared prefix wins, so a
sub-repository can be split out later without disturbing its parent.

`paths` is a list, which is what makes a data home synced between machines work: give
the same project one entry per device (`C:\CIIP` on Windows, `/Users/you/CIIP` on
macOS) and the longest-prefix match picks whichever exists locally. Adding a path never
removes the others.

## The active project is shared

One active project, held by the server and followed by every open tab. `use` moves it,
and so does `open`: opening a document switches to that document's project, so the
selector never disagrees with what is on screen. The person switching in the sidebar is
the same write. That is why the agent saying "we're on CIIP now" re-scopes a tab the
person already has open.

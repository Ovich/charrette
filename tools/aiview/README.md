# aiview

Local document viewer with a central index. Renders Markdown (GFM + mermaid), HTML
mockups (sandboxed iframe with viewport presets) and PDFs (native browser viewer) at
`http://localhost:4321`, live-reloads on save, and keeps an index of every document it
has been given (path, project, title, kind, tags, group, start time) so earlier work is
one click away.

One npm package: a React + TypeScript + Tailwind + shadcn-style UI (`app/`, built to
`dist/`), a small plain-Node server (5 API routes + static, `src/server/`), and a CLI
(`src/cli/`), all sharing `src/core/` (typed sqlite index, path rules, file watcher).

## Requirements

Node ≥ 22.5 (`node:sqlite`). One-time per machine, in this directory:

```sh
npm install && npm run build
```

`aiview.mjs` is the only entry point and its path never changes. If the build is
missing, every verb says exactly what to run; `serve`/`open` rebuild the UI
automatically when `dist/` is absent.

## Usage

```sh
A="node <path-to>/aiview.mjs"   # wherever this folder lives

$A open  docs/specs/2026-08-23-topic.brainstorm.md --tag proj --tag topic   # THE agent gesture (see below)
$A add   docs/specs/2026-08-23-topic.brainstorm.md --tag proj [--group g --group-title "Title"] [--started ISO]
$A update <file|#id> [--kind k] [--tag t] [--untag t] [--group g|--ungroup] [--group-title T] [--started ISO]
$A list  [--kind brainstorm] [--tag proj]
$A remove <file|#id>...
$A serve [file] [--port 4321] [--open] [--detach]
$A status
```

- **open**: idempotent one-shot: ensure the file is registered (same meta flags as
  `add`), ensure a server is running (starts one detached if not), print the URL.
  Safe to repeat; the standard way for an agent to say "make this visible".
- **add**: register a document. **Kind is mandatory**: from the filename convention
  `<name>.<kind>.md` (`….brainstorm.md` → `brainstorm`) or `--kind`. Tags via `--tag`
  (repeatable). `--group <slug>` puts the doc in a group (at most one per doc);
  `--group-title` names or renames that group. Start date-time = first registration,
  or `--started <ISO>`.
- **update**: change metadata without remove/re-add. `--ungroup` clears membership.
- **serve**: start the viewer. `--detach` daemonizes: writes `aiview.pid` +
  `aiview.port` next to the sqlite and returns; `open`/`status` find it through them.
- **status**: sqlite path, doc count, server up/down (stale pidfiles detected).
- **--json** on every verb: compact machine-readable output.

## UI

Left: documents (search, kind chips with deterministic hues, tag chips), grouped docs
in collapsible containers (title + count, members oldest-first, container sorted by
latest member activity), ungrouped docs flat. Right: doc header (title, **absolute
local path with click-to-copy**, kind, started, tags, updated) and the rendered
document; live reload via SSE. `#doc=<id>` selects a doc. Dark mode follows the OS.

## Storage

`aiview.sqlite` next to `aiview.mjs`: `documents` (one row per doc, `group_slug`
nullable) + `groups` (slug → title). Files are the truth; the index only points.
Document paths are stored relative to the repo root above the tool when inside it,
absolute otherwise. The index is written only by the CLI. The UI is read-only.

## Development

```sh
npm run dev        # Vite dev server with HMR, proxying /api + /events to a running serve on 4321
npm test           # core + server + CLI (node:test, runs the TS directly on Node >= 23.6)
npm run test:app   # component tests (vitest + jsdom)
npm run typecheck  # both tsconfigs
```

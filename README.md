# Charrette

*(French, from architecture studios: the working session where a design is drawn,
argued over, and decided before anything expensive is built.)*

Charrette is a set of agent skills for the drawing-board loop — brainstorm, diagram,
spec, plan, review — plus one local tool that renders what they write. The skills are
plain Markdown an agent reads. The tool, [aiview](skills/tools/aiview/SKILL.md), is a
Node CLI, an HTTP server and a browser UI. Nothing calls a network service.

![aiview: the project selector open over the scoped sidebar, grouped documents beneath it, and a live board with its decisions table on the right](assets/aiview.png)

## Requirements

Node ≥ 22.5 for aiview: the index uses `node:sqlite`, which arrived in that version.
The skills are Markdown and need nothing.

## Install

```sh
git clone https://github.com/Ovich/charrette.git
cd charrette/skills/tools/aiview
npm install && npm run build && node aiview.mjs init
```

`init` prints three paths: the data home, the documents directory inside it, and this
checkout. `status` prints them again, plus whether a server is running.

Point your agent at the skills — a `SKILL.md` path, or the `skills/` tree in your
harness's discovery mechanism — then declare a project, so documents have somewhere to
go:

```sh
node skills/tools/aiview/aiview.mjs project add CIIP --path /path/to/ciip
node skills/tools/aiview/aiview.mjs use CIIP
```

`--path` is a working directory, not a document directory: it answers "which project
is this checkout?", and it is repeatable, so one project can list a path per machine.

Then ask in plain language: *"Run brainstorm: I want per-user rate limiting on the
API."* Each skill states when it applies and maps the request onto its flow.

## Repository map

| Path | Holds |
|---|---|
| `skills/general/` | Skills that apply to any language or stack |
| `skills/react/` | Skills that assume React/TSX |
| `skills/tools/aiview/` | The viewer: `aiview.mjs`, `src/cli`, `src/core`, `src/server`, `app/` (React UI), `tests/` |
| `assets/` | Images used by this README |

A skill is a directory holding a `SKILL.md` — front matter naming it and stating when
it applies, then the procedure — plus any checklist or catalog it needs. Skills contain
no code and name no directory on disk; they ask aiview where documents go.

## Skills

| Skill | Use when | Produces |
|---|---|---|
| [brainstorm](skills/general/brainstorm/SKILL.md) | A feature, service, or system is about to be built and the design conversation hasn't happened | A live board (decisions table, diagrams, open questions), then an approved spec and a phased plan. No code until the spec is approved |
| [write-diagrams](skills/general/write-diagrams/SKILL.md) | A design question would settle faster drawn than argued; the other skills call it for their documents | Mermaid diagrams chosen by the open question, and the discipline that keeps them from multiplying |
| [frontend-design](skills/general/frontend-design/SKILL.md) | A screen is about to be built or visually reworked | On first use, the project's design language extracted from its own code; then one self-contained HTML mockup per screen, approved before it is coded |
| [technical-writing](skills/general/technical-writing/SKILL.md) | A system or procedure needs to be understood by a defined reader | A document shaped by its type — README, architecture doc, ADR, runbook, onboarding guide, API guide, migration note — drawn before it is described |
| [project-conventions](skills/general/project-conventions/SKILL.md) | A decision was just made, or a repo's unwritten rules need writing down | Numbered rules proposed for `AGENTS.md` / `CLAUDE.md`, applied only on confirmation |
| [pr-review](skills/general/pr-review/SKILL.md) | A pull request needs an informed merge decision | An analysis: the author's stated intent quoted, what actually changed, the structure drawn, blast radius verified against the repo, and the decision points only a human can settle |
| [code-design-review](skills/general/code-design-review/SKILL.md) | Program design quality is the question, in any language | Findings against DRY, KISS, YAGNI, SOLID, cohesion, coupling and the Law of Demeter. Not a bug hunt |
| [frontend-review](skills/react/frontend-review/SKILL.md) | React/TSX quality is the question | Findings on readability, component structure, rendering and performance. The diff by default; a whole-scope review becomes a report |

`write-diagrams` and `aiview` are the shared layer the others delegate to.

**Charrette contains no implementation skill.** Implementation happens in whatever
harness or editor you already use. The plan is its input; the review skills judge its
output.

## aiview

aiview owns four answers the skills must not each invent: where a document belongs, how
it is registered, how it is rendered, and how the viewer starts. A skill asks
`aiview path <filename>` for a location and calls `aiview open <file>` to show it — it
never joins a path itself. That is why documents could move out of project
repositories and into the data home without editing eight skills.

One tab at `http://localhost:4321` holds every registered document: Markdown (GFM +
Mermaid), self-contained HTML mockups in a sandboxed iframe, and PDFs. A file watcher
pushes changes over server-sent events, so a save re-renders the open tab. Documents
are indexed by project, kind, tags and group. The active project lives on the server
and every tab follows it, so when the agent runs `aiview use CIIP` the tab you already
have open re-scopes.

The files are the truth; the index only points at them. Deleting a row loses metadata,
not work.

[skills/tools/aiview/SKILL.md](skills/tools/aiview/SKILL.md) is the contract every
skill follows — kinds, tags, groups, where documents go.
[skills/tools/aiview/README.md](skills/tools/aiview/README.md) documents the flags,
storage, API routes and development commands.

## Where the documents live

Boards, specs, plans, mockups and review reports are working material between you and
the agent. Most are superseded by the merged code.

A working document kept in the project repository has to be reviewed like code and
kept current like code, and it is read by people who want the code rather than its
scaffolding. It gets none of that, so it goes stale.

Charrette therefore writes them to a **data home outside every repository** —
`$CHARRETTE_HOME`, or `charrette_appdata` in your home directory — under
`docs/<project>/`, alongside the SQLite index and the server's pid and port files. The
checkout holds only what `npm run build` recreates.

The consequences:

- Delete the checkout, clone it again, rebuild: nothing of yours was in it.
- The data home can be its own git repository, purely to sync between machines.
  Document paths inside it are stored relative, so the index travels with it.
- Nothing reaches a project repository by default. What outlives the work has to be
  distilled deliberately: durable rules into `AGENTS.md` via
  [project-conventions](skills/general/project-conventions/SKILL.md), the story of the
  change into the PR description.

[technical-writing](skills/general/technical-writing/SKILL.md) is the exception. A
README or an architecture doc is a deliverable for whoever clones the project, so it
belongs in the repository and changes in the same commit as the code.

## License

MIT: see [LICENSE](LICENSE).

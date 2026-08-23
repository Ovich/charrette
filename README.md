# Charrette

*(French, from architecture studios: the intense working session where a design gets
drawn, argued over, and decided — before anything expensive is built.)*

**Agent skills for the drawing-board loop: brainstorm → diagram → spec → plan →
review.** Everything is a local document — boards, specs, plans, mockups, PR
analyses — rendered live in the bundled viewer ([aiview](tools/aiview/SKILL.md)),
with diagrams as thinking tools rather than decoration.

No lock-in by design: the skills are plain markdown any agent can read, the tooling
is plain Node, references between skills use names plus paths relative to this repo
("in this collection"), and nothing depends on a specific harness, plugin format, or
cloud service.

## Layout

Each skill lives in its own folder and starts with a `SKILL.md` that says when and
how to use it; supporting files (checklists, catalogs, references) sit alongside.

- `general/` — language- and framework-agnostic: applies to any codebase.
- `react/` — React / frontend code work.
- `tools/` — shared local tooling the skills call into (not skills themselves).

## Skills

| Skill | Category | What it does |
|---|---|---|
| [architecture-brainstorming](general/architecture-brainstorming/SKILL.md) | general | Idea → questions → approaches → approved spec → phased plan, drawn while it's discussed: a live board in aiview, the diagram that answers each open question, hard approval gates before any code. |
| [write-diagrams](general/write-diagrams/SKILL.md) | general | The diagram contract every document-producing skill delegates to: a catalog mapping each open question to the diagram that answers it (C4, sequence, state, ER, data flow, dependency, phasing…), plus the discipline that keeps diagrams from becoming soup. Mermaid, renders in aiview and on any git host. |
| [technical-writing](general/technical-writing/SKILL.md) | general | Technical documentation — architecture docs, READMEs, ADRs, runbooks, onboarding, API guides: structured around the reader's question, the system drawn before it's described, iterated live in aiview. |
| [pr-review](general/pr-review/SKILL.md) | general | Stack-agnostic PR analysis for informed merge decisions: intent (quoted, never inferred), the change drawn as a delta map, verified blast radius, explicit decision points, two independent finding axes with mandatory citations, and a ready-to-post proposed comment — a `pr-analysis` document in aiview. |
| [code-design-review](general/code-design-review/SKILL.md) | general | Program design review of a PR, diff, or codebase against DRY, KISS, YAGNI, SOLID, cohesion, coupling, and the Law of Demeter. Any language. |
| [project-conventions](general/project-conventions/SKILL.md) | general | Writes and grows a repo's `AGENTS.md`: bootstraps conventions for a new stack, harvests unwritten ones from an existing codebase, captures a decision as it's made. Any stack. |
| [frontend-design](general/frontend-design/SKILL.md) | general | Visual controller: extracts the project's design language once, then designs each screen as a self-contained HTML mockup in that language, rendered live in aiview (viewport presets, states), approved before any component code. |
| [frontend-review](react/frontend-review/SKILL.md) | react | Opinionated quality review of React/TSX code — readability, structure, naming, rendering, perf. Findings in chat for a diff; an aiview report with diagrams for a whole-scope review. |

They compose, roughly in the order work happens: `architecture-brainstorming` designs
the thing and produces the spec and plan; `frontend-design` turns each screen into an
approved mockup before it's built; `project-conventions` records the decisions as
rules in `AGENTS.md`; `pr-review` maps each change so a human can decide the merge;
`code-design-review` judges the implementation against durable general principles and
`frontend-review` judges the React layer on top. `write-diagrams` and `aiview` are
the shared substrate all of them delegate to. House rules win over general principles
wherever the two disagree — that's the point of writing them down.

## The viewer

| Tool | What it does |
|---|---|
| [aiview](tools/aiview/SKILL.md) | Local document viewer + index in one npm package: React/TypeScript/Tailwind UI, small plain-Node server, agent-facing CLI. Renders Markdown (GFM + mermaid), HTML mockups and PDFs at `localhost:4321` with live reload; related documents grouped in collapsible containers; every doc header shows its absolute path (click-to-copy). CLI: `open` (idempotent register + detached server + URL), `add`, `update`, `list`, `remove`, `serve --detach`, `status` — all with `--json`. Node ≥ 22.5; one-time `npm install && npm run build` in `tools/aiview/`. Its `SKILL.md` is the contract every skill follows (kinds, tags, groups, start time). |

The index (`aiview.sqlite`) is created next to the tool on first use and is
gitignored here — it's your machine's document catalog, not the repo's.

## Using the collection

Clone anywhere. Point your agent at a skill's `SKILL.md` (or wire the folder into
your harness's skill discovery, if it has one) — each file is self-contained and
resolves its references relative to this repo. For aiview, run the one-time build in
`tools/aiview/`, then `node tools/aiview/aiview.mjs open <your-doc.md>` is the whole
gesture.

## License

MIT — see [LICENSE](LICENSE).

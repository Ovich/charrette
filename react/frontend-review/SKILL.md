---
name: frontend-review
description: Use when reviewing the QUALITY of React/frontend code in this project (apps/www) (readability, organization, naming, component structure, rendering, and performance) on the current diff or across the codebase. Not for correctness bug-hunting (use code-review) or answering questions about code (use code-qa).
---

# Frontend review

Opinionated quality review for the roster React SPA (`apps/www`): is the code
well-organized, well-named, readable, and optimized? Grounded in a sourced
`checklist.md`. Reports findings; only edits with `--fix`.

Not a bug hunt. That's `code-review`. This is readability, structure, and waste.

## Scope (default = the diff, cheap)

- `/frontend-review` → the working diff: `git diff HEAD` (fall back to `git diff @{upstream}...HEAD`).
- `/frontend-review all` → all of `apps/www/app`.
- `/frontend-review <path>` → that file or folder.
- Add `--fix` to apply the safe findings after reporting. Add one lens name to run just that lens.

Only `.tsx`/`.ts` under `apps/www` are in scope. If the scope has none, say so and stop.

## The four lenses

Each maps to a section of `checklist.md` (**read that section, don't review from memory**):

1. **render**: purity, rules-of-hooks, you-might-not-need-an-effect, state shape
2. **perf**: hoist static data, stable keys, lazy routes, anti-cargo-cult memoization
3. **structure**: one-component-per-file, decomposition, composition over prop-drilling, AHA, reuse the primitives, simplification
4. **organization**: colocation, feature islands, naming, domain vocabulary, `cn()` / wrap-raw-Tailwind, inferred types

## Run it (keep it cheap)

1. **Resolve scope** to a concrete file list. Skip a lens whose files aren't in scope (no route files → skip the lazy-route check).
2. **Fan out, in one message:**
   - *Diff or one folder:* one agent per lens over the scope.
   - *`all` / many folders:* one agent per feature folder, each running all four lenses over that folder (bounds cost to the folder count).
   Give each agent: the file list, its lens section from `checklist.md`, and the output contract below. Tight prompts, compact returns.
3. **Merge:** dedup findings on the same line/mechanism, drop anything biome or lint already flags, rank most-impactful first.
4. **Report** grouped by lens. *Diff scope:* in chat, terse, no diagrams. *`all` / folder scope:*
   write `YYYY-MM-DD-<scope>.report.md` in the data home (ask the `aiview` skill for the
   path; never in the repo under review) and open it via the `aiview` skill
   (`tools/aiview/SKILL.md` in this collection). Mermaid renders there, not in the
   terminal.
   Kind `report` (from the filename), tags = roster + review.
5. With `--fix`, apply only the safe ones (skip anything that changes behavior or reaches outside the scope), then re-verify with `pnpm typecheck` + `pnpm run biome`.

## Output contract (per finding)

`file:line` · **lens** · one-line issue · the concrete cost · the fix. No restating the code, no preamble. End with a one-line verdict (e.g. "6 findings: 2 structure, 3 organization, 1 perf, none blocking"). Empty scope or already-clean code → say so plainly. A short report is a good report.

## Diagrams (file reports only)

Diagrams: use the `write-diagrams` skill (`general/write-diagrams/SKILL.md` in
this collection). Pick from its catalog by the open question, follow its discipline. Review-specific guidance:
per-finding prose stays prose; a diagram appears only in a file report, and only in
these shapes:

- **Scope map** (one, at the top): the component tree of the reviewed scope, finding
  counts marked on the hot nodes, the map the findings hang off, and compressed
  context for the next session touching this feature.
- **Cross-feature import violations** (organization): one dependency graph with the
  forbidden edges drawn red, instead of N prose findings about individual imports.
- **Structural fix** (structure): when the fix is a reshape, before/after as two small
  trees, an option-comparison pair, deciding trade-off stated under it in one line.
- **State-shape finding** (render): boolean-soup state → the state machine; one state
  per boolean combination *is* the argument for one field.
- **Re-render cascade** (perf): when the cost of a finding is "state here re-renders
  all of this", the arrow diagram of what re-renders makes the cost visible.

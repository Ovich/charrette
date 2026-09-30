---
name: frontend-review
description: Use when reviewing the quality of React code, readability, organisation, naming, component structure, rendering and performance, on a diff, a path or a whole codebase. Not for correctness bug-hunting, and not for design principles across languages (code-design-review).
---

# Frontend review

**A finding is about readability, structure or waste, never wrongness today.** Findings are reported; edits only with `--fix`.

## Scope

**The file list comes from `scripts/scope.mjs` of the `pr-review` skill, always with `--ext ts,tsx,js,jsx --json`.** Exit 1 is an empty scope: say so and stop.

- `/frontend-review`: `diff`, the working tree, else upstream...HEAD.
- `/frontend-review all`: `path <folder>`, the app's React source: the folder `AGENTS.md` or the workspace names, else the package that depends on `react`.
- `/frontend-review <path>`: `path <path>`.
- **One lens name runs that lens alone.**

## The lenses

**Each is a section of `checklist.md`, read before reviewing, never recalled.**

1. **render**: purity, rules-of-hooks, you-might-not-need-an-effect, state shape
2. **perf**: hoist static data, stable keys, lazy routes, anti-cargo-cult memoization
3. **structure**: one-component-per-file, decomposition, composition over prop-drilling, AHA, reuse the primitives, simplification
4. **organization**: colocation, feature islands, naming, domain vocabulary, `cn()` / wrap-raw-Tailwind, inferred types

## Running it

1. **Skip a lens whose files are not in scope**: no route files, no lazy-route check.
2. **Fan out in one message**: on a diff or one folder, one agent per lens; on `all` or many folders, one agent per feature folder running all four. Each gets the file list, its lens section from `checklist.md` and the output contract.
3. **Merge**: dedup on the same line or mechanism, drop what the project's linter already flags, rank by impact.
4. **Report grouped by lens.** A diff: in chat, no diagrams. `all` or a folder: `YYYY-MM-DD-<scope>.report.md` through the `aiview` skill, kind `report`, tags = project + review.
5. **With `--fix`**, apply the safe findings, nothing that changes behaviour or reaches outside the scope, then run the project's typecheck and lint and name the commands run.

## Output contract

**Per finding**: `file:line` · **lens** · one-line issue · the concrete cost · the fix. No code restated. A one-line verdict last: "6 findings: 2 structure, 3 organization, 1 perf, none blocking". Clean code gets "clean".

## Diagrams

**In a file report only, through the `write-diagrams` skill**; a trivial scope earns none, and the report says so.

- **Scope map**, at the top: the component tree of the scope, finding counts on the hot nodes.
- **Cross-feature import violations** (organization): one dependency graph, the imports that must not exist drawn red.
- **Structural fix** (structure): when the fix is a reshape, before and after as two small trees, the deciding trade-off in one line under them.
- **State-shape finding** (render): boolean-soup state drawn as the state machine.
- **Re-render cascade** (perf): what re-renders when this state changes, as arrows.

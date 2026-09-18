---
name: code-design-review
description: "Use when reviewing program design quality on a pull request, a diff, or a whole codebase in any language: DRY, KISS, YAGNI, the SOLID principles, cohesion, coupling, and the Law of Demeter. Not for correctness bug-hunting, and not for framework-specific review."
---

# Code design review

**A design finding is a cost of change, never wrongness today.** Findings are reported; edits only with `--fix`.

## Scope

- **Resolve the file list with `scripts/scope.mjs` of the `pr-review` skill**: `diff`, `pr <n>`, `branch <ref>`, `path <p>` or `all`, with `--json`. Exit 1 is an empty scope: say so and stop.
- **On a diff, review the changed code and the design it lands in**: a hunk can be locally fine and still push a module past one responsibility.

## The lenses

| Lens | Principles |
|---|---|
| **simplicity** | DRY · KISS · YAGNI |
| **responsibility** | SRP · High Cohesion |
| **extension** | OCP · LSP · ISP |
| **dependencies** | DIP · Low Coupling · Law of Demeter |

## Running it

- **One fresh-context subagent per lens**; on a large codebase, one per module running all four.
- **Its prompt is exactly**: the file list, its lens section quoted from `checklist.md`, the output contract, the instruction to read the files first. Nothing of this conversation, never a lens from memory.
- **Merge**: drop duplicates on the same line or mechanism, drop what the project's linter already flags, rank by cost.
- **A principle name is a label.** The finding is the cost: which future change this makes expensive, what edit silently breaks something else, what bug the shape invites.
- **Over-application is a finding too**: the wrong abstraction, the interface with one implementor, the plugin point nobody asked for. "Consider deleting this indirection" is a first-class result.

## Output contract

- **Per finding**: `file:line` · **principle** · one-line issue · the concrete cost · the fix. Grouped by lens, ranked by cost, no code restated.
- **A one-line verdict last**: `9 findings: 3 dependencies, 4 responsibility, 2 simplicity (1 blocking)`. Clean code gets "clean".
- **A diff review is answered in chat.** A path or whole-codebase review is `YYYY-MM-DD-<scope>.report.md` through the `aiview` skill, kind `report`, tags = project + review.
- **With `--fix`**, apply the safe findings afterward, nothing that changes behaviour or reaches outside the scope, then run the project's own typecheck, lint and tests.

## Diagrams

**In a file report only, through the `write-diagrams` skill**, one per lens where the findings call for it; a trivial scope earns none.

- **Scope map**, at the top: the modules of the scope, the finding counts on the hot nodes.
- **Dependency graph** (dependencies): what imports what, the imports that must not exist drawn red: policy importing a mechanism, an inner layer naming an outer one, a cycle.
- **Before and after** (responsibility, extension): when the fix is a reshape, two small trees side by side, the deciding trade-off in one line under them.
- **Option comparison** (simplicity): the indirection as it stands against the inlined version.

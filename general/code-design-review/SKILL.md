---
name: code-design-review
description: Use when reviewing program design quality on a pull request, a diff, or a whole codebase in any language — DRY, KISS, YAGNI, the SOLID principles, cohesion, coupling, and the Law of Demeter. Not for correctness bug-hunting, and not for framework-specific review.
---

# Code design review

Applies ten program design principles to a PR or a codebase and reports where the
design will cost someone later. Grounded in a sourced `checklist.md` — one section
per lens. Reports findings; only edits with `--fix`.

Not a bug hunt. A design finding is about *cost of change*, not wrongness today.

## Scope

Point it at whatever the user named — a PR, the working diff, a path, or the whole
codebase — and resolve the file list yourself (`gh pr diff`, `git diff`, or walking
the source tree). Skip vendored, generated, build, and lockfile paths. If the scope
has no source files, say so and stop.

On a diff, review the changed code **plus the design context it lands in**: a hunk
can be locally fine and still push a module past one responsibility.

## The four lenses

| Lens | Principles |
|---|---|
| **simplicity** | DRY · KISS · YAGNI |
| **responsibility** | SRP · High Cohesion |
| **extension** | OCP · LSP · ISP |
| **dependencies** | DIP · Low Coupling · Law of Demeter |

## Run it

Dispatch **one independent subagent per lens** (for a large codebase, one per module
running all four lenses — this bounds cost to the module count).

Each subagent starts with no conversation history, and that is the point: it must
judge the code, not inherit your opinion of it. Its prompt contains exactly four
things — the file list, its lens section quoted from `checklist.md`, the output
contract below, and the instruction to read the files first. Nothing about this
conversation, and never a lens summarized from memory.

Then merge: drop duplicates on the same line or mechanism, drop anything the
project's own linter already flags, rank by cost.

## Two standing rules

**A principle name is not a finding.** "Violates SRP" is a label. The finding is the
concrete cost: which future change this makes expensive, what edit will silently
break something else, what bug the shape invites. No cost, no finding.

**Over-application is a finding too.** Every principle here does more damage applied
too eagerly than not at all — the wrong abstraction, the interface with one
implementor, the plugin point for a variation nobody asked for. Each checklist
section carries its counterweight. "Consider deleting this indirection" is a
first-class result.

## Output contract

Per finding: `file:line` · **principle** · one-line issue · the concrete cost · the
fix. Grouped by lens, ranked by cost, no code restated, no preamble.

End with a one-line verdict — e.g. `9 findings: 3 dependencies, 4 responsibility,
2 simplicity — 1 blocking`. Clean code gets "clean" and nothing more. A short report
is a good report.

With `--fix`, apply only the safe findings afterward (nothing that changes behavior
or reaches outside the scope), then re-run whatever typecheck/lint/test command the
project already defines.

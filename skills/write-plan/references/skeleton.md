# The plan document

The tracker first, then two parts. **Design** is what gets built, and every slice carries its
structure. **Execution** is for whoever runs the plan. A section that does not apply is left
out, and the header says which. A small change's section is a sentence.

```markdown
# <topic>, plan

> **Status**: draft | approved: <who>, <date>, in their words
> **Delivers**: the increment, in one sentence, and what is accepted as proof of it
> **Hard rule**: what must not change, when there is one
> **Read against**: `<branch>` at `<sha>`; every `file:line` cited holds there
> **Libraries read from source**: `<package>` `<version>`, <date>
> **Left out**: the sections below that do not apply

## The tracker
The diagram, above everything else: it is what a reader opens the plan for. Drawn when the
slices are cut; until then the heading holds one line saying so.

# Design

## 1. Why, and why not
The problem and who feels it. Goals. Non-goals. Where a person sees the change, the
stories: id `US3`, the role, what they want, why, acceptance written as something observed.

## 2. Before and after
Existing code, cited `file:line`, then the after picture. New work has the after picture
only. A table of what replaces what.

## 3. Modules, after
The module map: who imports whom, and the imports that must not exist, each with the test
that holds it. Then one subsection per deep module: its usage, the complete code a caller
writes, the entry as signatures without bodies, what it hides, what stays outside.

## 4. Flows
One sequence per kind of turn, every failure branch on it.

## 5. State and its writers
Where each piece of state lives, and every writer of it.

## 6. Failure modes
What breaks, and what the person sees.

## 7. The suite, after
The testing strategy as decided. Then per seam: the cases, by name.

## 8. What ran
The recipes the experiments handed back.

## 9. Decisions
| id | Kind | Decision | Status | Source | Slice |
One series, `D1` onward, continuing the project's numbering. Kinds: purpose, module (with
its state, as write-slice names them), architecture, contract, clarification. Open
questions are rows with status open and an owner. A departure from a rule is a row naming
what is owed for it.

# Execution

## 10. The slices
One heading per slice: the stories it serves, delivers, blocked by, its
check, the tests it owes, its mark, its slice document.

## 11. The mandate
The orchestrator's mandate, as answered.

## Interview log
One entry per question, verbatim: the options and the recommendation, then the answer as
given.
```

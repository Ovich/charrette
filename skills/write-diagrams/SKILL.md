---
name: write-diagrams
description: Use whenever a document you are producing could carry a diagram (a brainstorm board, spec, implementation plan, review report, analysis) or when a design question might be settled faster shown than said. Maps each kind of open question to the diagram that answers it, and holds the discipline that keeps diagrams from becoming soup. Mermaid-based, renders in aiview and on any git host.
---

# Write diagrams

A diagram is a thinking tool, not decoration. Its job is to make a boundary, an
ordering, or a dependency visible early enough to argue about cheaply. It earns its
keep twice: once in the argument it settles, and again as **compressed context**:
a later session (human or AI) reading the board, spec, or plan gets the structure in
one glance instead of re-deriving it from prose. This skill owns two things: **which
diagram answers which question** (`diagrams.md`, the catalog) and **the discipline**
below. Any skill that produces documents (brainstorm boards, specs,
plans, reports) instructs its use rather than restating the rules.

## Pick by the question, not by ritual

`diagrams.md` maps each open question to the diagram that answers it: what runs where
(container), in what order (sequence), what states are legal (state machine), what may
import what (dependency), where untrusted input enters (data flow), what ships first
(phasing), and more. **Read it before drawing.** If no question is open, no diagram is
needed.

**A diagram is often the cheapest way to ask a question.** Draw the container diagram
with a `?` on the contested arrow and ask "which of these two?" That settles in one
exchange what two paragraphs of prose won't. Use diagrams while a question is open, not
only in the final document.

## Discipline: otherwise it's diagram soup

- One diagram per open question. A diagram that restates a paragraph is noise; delete it.
- **Every diagram carries a one-line caption**: its catalog type and the question it
  answers, right above the fence, *"Dependency graph: what may import what after
  this change."* The reader shouldn't have to infer why the diagram exists, and the
  caption is what lets a reviewer check the right form was chosen.
- Draw it only if it shows something you can't say in one sentence. If you can say the
  sentence, say the sentence.
- **Every arrow is labeled** with what flows and in which direction. An unlabeled arrow
  means "these are related somehow," which is worth nothing.
- **Unless the shape carries it.** When every arrow in the diagram means the same thing
  and no node has two outgoing arrows, the node names already say it and a label on each
  one reads as noise. The test is the drawing, not your taste: the moment a node
  branches, or two arrows mean different things, every arrow gets a label.
- Real names of real things: actual service, table, and module names, not `Service A`.
- A box whose responsibility you can't state in a phrase gets deleted.
- 2–4 diagrams for a feature. The full C4 set only for a genuinely new system.
- When the design changes in review, **update the diagram in the same edit.** A stale
  diagram is worse than no diagram, because it gets believed.
- A missing diagram is a finding, not a pass: if a downstream document (a plan, a
  review) depends on a boundary no diagram shows, draw it then: don't carry the
  absence forward.

Mermaid in fenced ```mermaid blocks, so it renders in aiview and on any git host with
no tooling. For C4-style diagrams use `flowchart` with C4 conventions (`classDef` for
person / system / external): Mermaid's native `C4Context` blocks render inconsistently.

## Contract for calling skills

A skill that wants diagrams says: *"Diagrams: use the `write-diagrams` skill
(`../write-diagrams/SKILL.md` in this collection). Pick from its catalog by
the open question, follow its discipline."* Name plus a path relative to the calling
skill's own file — every skill is a sibling, so it is always `../<name>/SKILL.md` —
never an absolute path, so the reference works from any checkout with any harness. Plus at most one line of skill-specific guidance (e.g. how many
are expected, or which catalog entries its documents most often need). It does not
restate the rules.

## Red flags

| Thought | Reality |
|---|---|
| "One more diagram would help" | Would it answer an open question? If not, it's soup. |
| "I'll draw the diagram after" | Then it's documentation, not design. Its value was in the argument you skipped. |
| "The prose already covers the boundary" | If the artifact answering "what may import what" is a prose bullet, the instructed form was a dependency graph. Two questions ≠ one artifact. |
| "The diagram from the board still matches" | The design changed in review. Update it in the same edit or it will be believed wrongly. |
| "I'll invent a hybrid diagram" | The catalog's forms exist because each answers one question. Pick one; two questions get two diagrams. |
| "I'll label the arrows to be safe" | On a straight unbranched chain of one arrow type, labels are noise. Count the branches before reaching for them. |

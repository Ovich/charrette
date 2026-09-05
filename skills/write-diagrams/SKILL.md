---
name: write-diagrams
description: Use when a document produced in this collection (board, spec, plan, report, analysis, durable doc) could carry a diagram, or when a design question would settle faster shown than said. Picks the diagram that answers the open question and holds the discipline that keeps a diagram readable. Not for decoration: no open question, no diagram.
---

# Write diagrams

A diagram is a thinking tool, not decoration. Its job is to make a boundary, an
ordering, or a dependency visible early enough to argue about cheaply. It earns its
keep twice: once in the argument it settles, and again as **compressed context**:
a later session (human or AI) reading the board, spec, or plan gets the structure in
one glance instead of re-deriving it from prose. This skill owns two things: **which
diagram answers which question** (`diagrams.md`, the catalog) and **the discipline**
below.

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

Two mechanics that bite every styled diagram. **Colours as eight-digit hex, never
`rgba(...)`**: a `classDef`'s properties are comma-separated, so the commas inside an
`rgba()` split the colour into fragments and the definition fails, usually silently, the
diagram still rendering, just wrong. And **translucent over opaque** (`#7f7f7f1a`), because
a page is read in whatever theme the reader has: a translucent fill darkens a light
background and lightens a dark one, where an opaque light fill burns a white slab into a
dark page. Where the styling carries meaning, put that meaning in the label too, a glyph
or a word, so it survives grayscale, dark mode and a colour-blind reader.

**Parse the block, don't eyeball it.** Mermaid fails quietly, and a diagram nobody can read
is a diagram nobody updates. `aiview mermaid-check <file>` parses every block of a document
the way the viewer will, names the line of each failure, and warns on a fence with no
caption above it and on a branching node with an unlabeled arrow; run it after every
edit to a diagram.

## Red flags

| Thought | Reality |
|---|---|
| "One more diagram would help" | Would it answer an open question? If not, it's soup. |
| "I'll draw the diagram after" | Then it's documentation, not design. Its value was in the argument you skipped. |
| "The prose already covers the boundary" | A boundary described in a bullet is a boundary nobody checked. "What may import what" is a dependency graph, not a sentence. |
| "The diagram from the board still matches" | The design changed in review. Update it in the same edit or it will be believed wrongly. |
| "I'll invent a hybrid diagram" | The catalog's forms exist because each answers one question. Pick one; two questions get two diagrams. |
| "I'll label the arrows to be safe" | On a straight unbranched chain of one arrow type, labels are noise. Count the branches before reaching for them. |

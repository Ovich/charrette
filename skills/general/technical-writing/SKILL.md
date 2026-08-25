---
name: technical-writing
description: Use when writing or reworking technical documentation (architecture and system docs, READMEs, ADRs, runbooks, onboarding guides, API guides, migration notes) or any document whose job is to make a system or procedure understood. Structures the document around the reader's question, draws the system before describing it, and iterates live in aiview.
---

# Technical writing

A technical document has one job: the reader arrives with a question and leaves with
the answer, in as few minutes as the material allows. Everything here serves that:
the structure, the diagrams, the register. Prose that shows off, hedges, or narrates
the author's journey is debt.

## Flow

1. **Name the reader and their question** before writing anything. "A developer who
   just cloned the repo: how do I run it?" is a different document from "a maintainer
   in an incident: what do I restart, in what order?". One document, one primary
   reader. If two readers pull in different directions, that's two documents.
2. **Pick the document type**: it dictates the shape (§ Document types).
3. **Draw the system before describing it.** The structural diagram comes first, not
   as illustration afterwards: if you can't draw the thing (its boxes, its arrows,
   its order), you don't understand it well enough to document it yet. Diagrams: use
   the `write-diagrams` skill (`../write-diagrams/SKILL.md` in this
   collection): pick from its catalog by the reader's question, follow its
   discipline. See § Diagrams for what each document type typically carries.
4. **Skeleton, then prose.** Headings first, ordered by the reader's priority:
   answer first, context after (a reader who needs background will scroll up; one who
   needs the command will not scroll down). Fill in prose last.
5. **Render and iterate.** Register and serve the document via the `aiview` skill
   (`../../tools/aiview/SKILL.md` in this collection): kind `reference` for durable
   docs, `report` for one-off analyses; tags = project + subject; when the doc
   belongs to a piece of work with a board or spec, the same group. Tell the user the
   URL; edit the same file: it live-reloads, diagrams render.
6. **Tighten.** One pass with the knife: omit needless words, active voice, one idea
   per sentence, every sentence carrying something the reader didn't already have
   (§ Register). Then cut once more: the last pass always finds a paragraph the reader
   never needed.

## Document types

| Type | Reader's question | Shape |
|---|---|---|
| README | "What is this and how do I run it?" | What it is (2 sentences) → requirements → run commands → where things live. Everything else links out |
| Architecture / system doc | "How does this work?" | Structural diagram first, then one section per box, boundaries and data flow explicit |
| ADR / decision record | "Why is it like this?" | Context → decision → consequences; the options considered, with the deciding trade-off |
| Runbook | "It's broken. What do I do?" | Preconditions → numbered steps with expected output per step → failure branches → rollback. No theory |
| Onboarding guide | "Where do I start?" | The path through the system in reading order; each stop links to the deeper doc |
| API guide | "How do I call this?" | One working example first, then the reference; auth and error flows drawn, not narrated |
| Migration note | "What changed and what must I do?" | What breaks → what to change (before/after) → deadline/order |

## Diagrams (the load-bearing kind)

Per document type, the diagram that usually earns its place. From the
`write-diagrams` catalog, its discipline applies (labeled arrows, real names, one
diagram per question, updated in the same edit as the prose beside it):

- **Architecture doc**: container diagram always; dependency graph with forbidden
  edges when layering is a rule the doc is asserting.
- **Runbook**: the procedure as a flowchart with failure branches, or a sequence
  diagram when multiple systems take turns. The unhappy path is why the diagram exists.
- **ADR**: option comparison: the considered structures side by side, deciding
  trade-off in one line beneath.
- **API guide**: sequence diagram for anything with a handshake: auth, retries,
  webhooks, pagination.
- **Onboarding**: the repo/system map the newcomer walks; a user-flow diagram when
  the product itself needs explaining.
- **README**: usually none. A README that needs a diagram is usually an
  architecture doc wearing the wrong name: split it.

A document that explains structure and contains no diagram is a review finding, not a
style choice. The inverse discipline also holds: no diagram that restates a sentence.

## Register

Plain, direct, and dry. State facts in the present tense ("the server binds
127.0.0.1", not "the server will be binding"). Commands and paths in code spans,
exact and copy-pasteable. Expand every acronym at first use. No marketing adjectives,
no "simply"/"just" (if it were simple the reader wouldn't be here), no apologies, no
humor that ages. Say what something does before why it's clever, and question
whether the reader needs the clever part at all.

## Maintenance

- **This skill is the exception in the collection: its output is usually repo
  content.** A README, an architecture doc, a runbook, an API guide is a deliverable
  for whoever clones the project, so it lives **next to what it describes** and changes
  in the same commit: a doc updated "later" is a doc that lies. Boards, specs, plans and
  analyses are scaffolding and stay in the data home (the `aiview` skill); documentation
  is not. When this skill is used for a one-off analysis rather than a durable document
  (kind `report`, not `reference`), that one follows the scaffolding rule instead.
  Either way aiview renders it: `open` takes any path, in a repo or out of one.
- Evergreen docs keep stable names (README.md, docs/architecture.md); dated names
  (`YYYY-MM-DD-….md`) are for point-in-time documents (analyses, ADRs, notes).
- Every claim a reader could act on must be verifiable: a command that was run, a
  port that is real, a path that exists. Verify at writing time, not from memory.

## Red flags

| Thought | Reality |
|---|---|
| "I'll add a diagram once the text is done" | Backwards. The diagram is where you find out the text's structure is wrong. |
| "The reader will figure out the order" | Order is the author's job. Answer first, background after. |
| "One doc for users and maintainers" | Two readers, two questions, two documents. |
| "It's documented in the code comments" | The reader with the question doesn't know which file to open. |
| "I'll describe the architecture in prose, it's clearer" | Ten boxes described in prose is a diagram the author refused to draw. |
| "Docs polish comes later" | Later never comes; the tightening pass is part of writing, not a follow-up. |
| "This claim is probably still true" | Verify or delete. A confident stale doc is worse than no doc. |

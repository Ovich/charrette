---
name: roadmap
description: Use when a project has to be declared above its pieces of work, from nothing or from the boards, specs and mockups already made, when a slot has landed or the picture has changed and the roadmap must be redrawn, or when someone asks where the project stands. Produces and keeps the roadmap (iterations of deliverable slots, each slot's state derived from what exists for it) and the foundation reference (the technology decisions). Not for designing a slot (brainstorm), planning it (write-plan) or building it (execute-plan).
---

# Roadmap

The roadmap is the one document above the pieces of work: what is delivered in what
order, what already exists for each piece, and what must be decided before the next
one starts.

**The slot rule.** A slot is something the customer can use or a system that can be
deployed. Nothing smaller is a slot: a screen, a service, a migration, a board are
pieces of work under a slot. A slot is done when the feature is delivered and
working, never when its last plan finished. An iteration groups the slots delivered
together; the first iteration of a project from scratch is usually one slot, the
foundation: the smallest deployable system the features build on, whatever shape the
project gives it. Its first piece of work is the repository itself, created at the
provider the foundation names, with its conventions file, pushed, before any code.

**No big design up front.** The next iteration has its slots named precisely. Later
iterations carry a title, the outcome and at most a rough list. A slot is split into
its pieces of work, or a new piece opened for a brainstorm, when the work reaches it.
A roadmap drawn to the end at declaration is wrong by the second slot and defended
instead of redrawn.

## The two documents

`YYYY-MM-DD-<project>.roadmap.md`, kind `roadmap`, dated at declaration and kept for
the life of the project, and `foundation.reference.md`, kind `reference`, undated,
never retiring: the technology decisions, one row each. Their contents and rows:
`references/documents.md`, read before drafting or redrawing either. Both live in the
data home, registered and served via the `aiview` skill (`../aiview/SKILL.md` in
this collection): tags = project + `roadmap`, no group, the roadmap started when the
declaration began.

## Slots and their state

Every document of a slot carries the slot's slug as a tag, whatever group it sits
in. The state is derived from what the tag finds, never typed: **empty** (nothing),
**in design** (a board or a spec), **drawn** (mockups), **planned** (a plan), **in
progress** (a plan's tracker has a ▶), **landed** (the person confirmed the feature
delivered and working, with the evidence: a URL, a deployment, a customer). A slot
marked landed on the strength of a finished plan is the tracker lying about the one
thing the roadmap exists to say.

A board names at its top the slot it serves. A board may serve the roadmap itself
when the idea is product-level, and the redraw reads it, but the roadmap resolves its
own decisions through the `interview` skill (`../interview/SKILL.md` in this
collection), which is the better tool for a document that is a tree of decisions.

## Declare

1. **Read everything.** The project's documents through aiview (`list`), every
   board's decisions table and diagrams, the mockups, the reports, the code and its
   conventions file when there is code, and any register the person names (gaps,
   market notes). A declaration that ignores an approved board redesigns it.
2. **Name what is missing.** Slots no document covers (accounts and login, billing,
   the foundation itself are the usual absences), foundation rows no decision covers,
   dependencies between slots that nothing states.
3. **Draft both documents whole**, with a recommendation in every open place and its
   reason, and open them in the viewer. The draft is the agent's reading of the
   project, so it is handed over as something to correct.
4. **Interview on the draft.** The tree: the order of iterations, which slot each
   existing piece belongs to, the foundation rows the first slot needs. Rows a later
   slot needs stay open with that slot named. Every answer lands in the documents as
   it is given.
5. **Close.** The state node names the first slot and its next step, usually a
   brainstorm. Say so in chat.

## Redraw

Run when a slot lands, a plan finishes, a board opens for a slot, or the person says
the picture changed. Derive every state again. Mark landed only with the person's
evidence. Split the slot the work has reached into its pieces of work, each a group.
Ask the foundation rows the next slot needs and refuse to start it while one is open:
a slot built on an open row is a decision taken silently, inside a spec where the
next slot's brainstorm will not look. Deviate from the earlier drawing when the last
slot taught something, and write what changed and why in the redraw log. Retire the
landed slot's groups as the aiview contract asks.

## Status

Read-only, in chat: the iteration, the slot in progress, what blocks, the foundation
rows still open for the slot ahead, and the pieces of work the next slot still lacks.

## The diagram

The roadmap opens on its tracker, drawn to the tracker protocol of the `execute-plan`
skill (`../execute-plan/references/tracker.md` in this collection, read its slots
paragraph): one subgraph per iteration, one node per slot with the glyph of its
derived state, dependency edges, the state node with the iteration, the slot in
progress, next, blocked and the open rows. Parse it after every edit with
`aiview mermaid-check`.

## Red flags

| Thought | Reality |
|---|---|
| "Login is small, it goes under profile intake" | Nothing smaller than a deliverable is a slot, and nothing deliverable is smaller than a slot. Login the customer can use is a slot. |
| "I'll fill every iteration's slots now while the picture is fresh" | The picture is fresh for the next iteration only. The rest is guessed and will be defended. |
| "The stack can be decided when the first spec is written" | Then it is decided in one spec, and the second slot inherits it without seeing it. Rows close in the foundation, before the slot. |

---
name: brainstorm
description: "Use before building anything non-trivial (a new feature, service, integration, or system) to turn an idea into an approved spec with its architecture diagrams, through a design conversation on a live board: requirements, approaches, boundaries, data flow. Produces the board and the spec; the plan is write-plan's. Not for bug fixes or mechanical edits."
---

# Brainstorm

<HARD-GATE>
No implementation, no scaffolding, no code, no file creation for the thing being designed until the spec is written and the user has approved it. Every project, however simple: a simple project's spec is three paragraphs, but it exists and it is approved.
</HARD-GATE>

## Flow

1. **Read the context**: existing code, `AGENTS.md`/`CLAUDE.md`, recent commits, the conventions in force, and when the topic has a group in aiview, its board and the last plan's finished steps.
2. **Scope check**: a request that is several independent systems is decomposed now, one spec per piece, before any detail is refined.
3. **Question loop**: run the `interview` skill (`../interview/SKILL.md` in this collection) on the board's decisions table. The first rows are purpose, constraints, success criteria, and what is explicitly out of scope. Every decision it settles goes into the table as it lands; the exchange goes into the interview log.
4. **When the table has no open row, ask one more question**: is there anything else this should cover? Point at directions the loop did not reach, chosen from the design in hand (what happens when the new part fails, who else reads or writes this data, what is deliberately left out, how it is undone, what the first user sees), and take a new row for each one the person picks up.
5. **Approaches**: 2–3 with real trade-offs, YAGNI applied to each, your recommendation first with its why. Present the trade-off that decides it, not a feature matrix; options that differ structurally are drawn side by side.
6. **Design, in sections**, each scaled to its complexity; ask after each whether it holds.
7. **Write the spec**, self-review it, then the user reviews it.
8. **Hand off**: the plan is the `write-plan` skill's (`../write-plan/SKILL.md` in this collection), written once the spec is approved. With a roadmap (`../roadmap/SKILL.md` in this collection), the board carries the slug of the slot it serves as a tag, and the close says the roadmap may need a redraw.

## The board

**The design lives in one Markdown file from the first question, never in chat.** Create `YYYY-MM-DD-<topic>.brainstorm.md` as soon as the context is read, at the path the `aiview` skill gives, never inside the project repo. Every decision, open question, considered option, diagram and research note goes in it.

- **Open it via the `aiview` skill (`../aiview/SKILL.md` in this collection) the moment it exists**: kind `brainstorm` (from the filename), tags = project + topic, group = the topic (titled; the spec joins it, the plan gets its own), started honestly. Tell the user the URL it prints, then keep editing the same file.
- **Resuming on another machine**: list the brainstorm-kind documents and read the board before asking the user anything again.

Its sections, in order:

- **Decisions table**: id `D3`, decision, depends on, status agreed / open / deferred, log entry `Q7`.
- **Context being built on.**
- **Design sections**, **diagrams**, **research notes.**
- **Interview log**, last: one entry per question in the order asked, appended as each answer lands, verbatim: the question with its options and recommendation, then the answer as given. The table says what was decided; the log says what else was on offer and why it lost.

## Diagrams

**The `write-diagrams` skill (`../write-diagrams/SKILL.md` in this collection)**: pick from its catalog by the open question, follow its discipline.

- **Draw during the question loop**, not only in the spec: a `?` on the contested arrow is the cheapest way to ask a question.
- **Expect 2–4 for a feature**; the board's usual entries are container, sequence, state machine, dependency graph, and option comparison.

## The spec

**Write `YYYY-MM-DD-<topic>.spec.md` beside the board**, kind `spec`, the board's tags and the board's `--group`, and note the spec's path at the top of the board.

- **Problem**: what is wrong today, who feels it.
- **Goals / non-goals**: the non-goals are the valuable half.
- **User stories**: as many as the change needs, each with an id (`US3`), the role, what they want, why, and acceptance criteria written as something observed. They come from the interview's answers on purpose, the first user's view and the out-of-scope; the plan's slices, the tracker's evidence and a review cite them.
- **Design**: prose plus the diagrams that earned their place.
- **Data**: shapes, ownership, migrations.
- **Failure modes**: what breaks, what the user sees.
- **Testing**: what proves this works.
- **Open questions**: with a named owner, or none at all.

**Self-review with fresh eyes and fix inline**: a TBD or placeholder left; two sections contradicting; a diagram that does not match the prose beside it; a requirement readable two ways, pick one and write it plainly; more than one increment's worth of work, split it.

**Then stop and ask the user to review the file.** The plan comes after approval, from `write-plan`.

## Red flags

| Thought | Reality |
|---|---|
| "This is simple, I'll just build it" | The gate applies to every project. Simple ones are where wrong assumptions hide. |
| "The user knows what they want" | They know the outcome. The boundaries are what you're for. |
| "Let me scaffold while we talk" | Files created before approval get defended instead of discarded. |

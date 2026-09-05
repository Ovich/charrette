---
name: technical-writing
description: Use when the work produces a document that must be understood by someone who was not there when the system, procedure or decision was made, and that stays in the repository after the work merges: a README, an architecture or system document, an ADR, a runbook, an onboarding guide, an API guide, a migration note. Not for the working documents of a piece of work (boards, specs, plans and reports belong to the skills that produce them) and not for persuasive prose.
---

# Technical writing

A technical document is an instrument for transferring understanding. The reader
arrives with a question; the document reduces the uncertainty around it until the
reader can understand the system, make the decision, or perform the action. It is not
written to show what the author knows, and it never makes the reader reconstruct the
author's reasoning from implementation details. The structure, the constraints, the
decisions, the evidence and the consequences are made visible, without making the
engineering look simpler than it is.

## Mindset

- **One reader, one question.** A developer asking "how do I run this?", an engineer
  asking "why does this service depend on this database?" and an operator asking "what
  do I do when the deployment fails?" need three documents. Name the reader and the
  question first, organise the document around it, answer first and let background
  follow.
- **Find the structure, then draw it, then write.** Before prose, determine the
  smallest set of concepts needed: what the important things are, what depends on
  what, where the boundaries lie, what can change independently, where information
  enters and leaves, where it can fail. Then draw it with the `write-diagrams` skill
  (`../write-diagrams/SKILL.md` in this collection), picking from its catalog by the
  reader's question. Drawing is where the author finds out the structure is wrong; a
  structure that cannot be drawn is an understanding still entangled. A concept with
  components, ordering, states, ownership or dependencies is drawn, never narrated.
- **State where a responsibility ends.** For each significant component: what it owns,
  consumes, produces, depends on, deliberately does not do, and what can change without
  affecting it. Not "handles" or "manages". The question is not only what a module
  does, but what it keeps the rest of the system from having to know.
- **Start decisions from constraints.** Problem, constraints, alternatives, decision,
  consequences. "Data cannot leave the organisation, therefore inference runs inside
  its infrastructure" is a design; "the system uses Kubernetes and llama.cpp" is
  inventory. Technology is evidence of a design, not the design.
- **Preserve the reasoning a future engineer would otherwise rediscover.** For the
  decisions whose reversal would need the reasoning again, and only those: the problem,
  the plausible options, the constraint that mattered, what was chosen and rejected,
  what it costs, what it makes possible, what remains unresolved.
- **Keep fact, constraint, decision and consequence apart.** "The service stores
  session state in PostgreSQL" is a fact. "The application must keep operating when the
  identity provider is unavailable" is a constraint. "Session state is therefore kept
  independently of the identity provider" is a decision. "Existing sessions survive an
  outage, but invalidation becomes an application responsibility" is a consequence.
  Collapsed into one authoritative paragraph, the reasoning stops being inspectable.
- **Make complexity visible without dramatising it.** Say what is hard and why, and no
  more; a named risk gets discussed, an adjective gets nodded past.

## Flow

1. Identify the reader and the question, and choose the document type below.
2. Define the boundary of the system or decision, and the constraints that matter.
3. Find the conceptual structure and draw it.
4. Identify the consequential decisions.
5. Build the skeleton around the reader's question; write facts and examples; then
   the reasoning, trade-offs and consequences.
6. Render it via the `aiview` skill (`../aiview/SKILL.md` in this collection) and read
   it rendered. Durable documents live next to what they describe, under stable names
   (`README.md`, `docs/architecture.md`, `docs/runbook.md`); point-in-time material
   under dated names; the viewer shows either from where it is.
7. Verify every actionable claim: commands, paths, ports, configuration, API
   behaviour, procedures, dependencies, version-specific behaviour, operational
   assumptions. At writing time. "The service runs on port 8080" is what it used to do:
   check. What cannot be verified is qualified or removed; a precise falsehood is worse
   than an obvious omission.
8. Cut. For every paragraph: what does the reader know after it that they did not know
   before, and does that change their understanding, decision or action? If not, it
   goes. Repetition, history the reader does not need, technology inventory,
   unsupported adjectives and prose that duplicates a diagram go first.
9. Read it once more as the intended reader.

## Document types

| Type | Reader's question | Shape | Diagram, from the `write-diagrams` catalog |
| --- | --- | --- | --- |
| README | "What is this and how do I run it?" | What it is, requirements, run, repository map | Usually none. A README that needs one is an architecture doc wearing a README's name. |
| Architecture / system doc | "How does this work?" | Constraints, structural diagram, components, flows, decisions, consequences | Container or component; sequence for the flows that matter; dependency graph where import direction is a rule. |
| ADR | "Why is it like this?" | Context, constraints, alternatives, decision, consequences | Option comparison: the alternatives side by side, the deciding trade-off under them. |
| Runbook | "It's broken. What do I do?" | Preconditions, procedure, expected result, failure branches, rollback | User flow for the operator's path, state machine when the system has modes. |
| Onboarding | "Where do I start?" | System map, reading path, first task, deeper references | System context or container as the map; user flow for the first task. |
| API guide | "How do I call this?" | Working example, interaction flow, authentication, errors, reference | Sequence, for any handshake or multi-step call. |
| Migration note | "What changed and what must I do?" | What changes, before and after, migration order, failure and rollback | Phasing: what moves first; before and after as two small diagrams when the contrast is the point. |

When the system changes in a way that invalidates the document, the document changes
in the same commit.

## Red flags

| Thought | Reality |
|---|---|
| "I'll add the diagram later." | The diagram is part of understanding the structure. Draw it first. |
| "The architecture is clearer in prose." | Structure and relationships belong in diagrams; prose is for what has no structure to draw. |
| "The technology explains the design." | Constraints and decisions explain the design. |
| "The system is robust." | Provide the evidence of the property, or cut the word. |
| "The reader will infer the boundary." | State it. |
| "More detail makes the document better." | Detail is useful only when it reduces uncertainty. |
| "The reader knows the context." | Include the minimum context the decision needs. |
| "This claim is probably still true." | Verify it or delete it. |
| "I'll polish the prose later." | Structure and reasoning come before polish, and the cut is part of the writing. |

## Core test

Before publishing: can a competent engineer who did not build this system understand
its structure, boundaries, constraints, important decisions, consequences and next
action without asking anyone? If not, the document is not finished.

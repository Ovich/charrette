---
name: project-conventions
description: Use when a project's conventions need to be written down or extended: starting a codebase from scratch, capturing a design decision that was just made, or turning unwritten patterns in an existing repo into rules. Produces or grows an AGENTS.md / CLAUDE.md. Any language or stack.
---

# Project conventions

Turns design decisions into short, checkable rules in the repo's `AGENTS.md`
(or `CLAUDE.md`, whichever the repo already uses; create `AGENTS.md` if neither).

A convention document is not a style guide and not a tutorial. It is the set of
decisions a fresh agent would otherwise guess differently every time.

## What earns a rule

A candidate becomes a rule only if **all five** hold. Say which one fails and drop it
otherwise.

1. **Contested**: a competent developer could defensibly do it the other way.
2. **Recurring**: it will come up again. A one-off belongs in a code comment.
3. **Consequential**: breaking it costs rework or silent drift, not just taste.
4. **Checkable**: a reviewer can point at a line and say yes or no.
5. **Not tool-enforceable**: if a linter, formatter, or type checker can enforce it,
   configure the tool instead. Rules are for judgment; tools are for mechanics.

## Rule shape

```
N. **MUST <imperative>.** <the cost of not doing it, or where it lives.> <optional: one path or symbol.>
```

**Two or three sentences. Under ~50 words.** MUST for invariants, SHOULD for strong
defaults. Name the real symbol, path, or command (`typeof <table>.$inferSelect`,
`apps/api/src/lib/github/`), never a generic paraphrase of the idea.

Every rule states its cost. A rule whose reason is invisible is a rule that gets
rationalized away.

<Good>
`2. **MUST derive DB-row types from Drizzle, never hand-write them.** Use `typeof <table>.$inferSelect`, or the aliases exported from `@roster/db`. Hand-written copies drift from the schema silently.`
</Good>

<Bad>
`2. **Types should be consistent.** Avoid duplicating type definitions across the codebase where possible, as this can lead to maintenance burden over time and inconsistencies between different parts of the application...`
</Bad>
Vague, unbounded, unfalsifiable, and names nothing.

## Ground it in the vendor's own docs

Before proposing rules for a stack you haven't already codified, **read what its
makers recommend.** Every serious framework, ORM, and runtime publishes guidance on
project structure, data flow, and the mistakes it expects you to make: React's
"you might not need an effect", Drizzle on inferred types, Django on apps and
settings, Go's project layout, Rails' conventions.

- One pass per stack component, official domain only (`react.dev`, `orm.drizzle.team`,
  `docs.djangoproject.com`). Blog posts and aggregators are not sources here.
- Note the **major version** you read for. This guidance changes between versions,
  and a rule sourced from v4 docs in a v6 project is worse than no rule.
- Distill; don't transcribe. The docs yield candidates, and candidates still face the
  five filters. Most of a framework's guide is teaching, not convention.
- **Cite the URL in the rule** so a future reader can check whether it still says that.
- **A rule that departs from official guidance must say so and say why.** "Departs
  from <X>'s recommended <Y> because <reason>": a deliberate, recorded departure is
  fine; an accidental one is how a codebase ends up fighting its own framework.

Where official guidance is silent (and it is silent on most of `decision-points.md`,
because those are *your* decisions), say so and decide on the merits.

## Three modes

**bootstrap**: new codebase. Ask what the stack is, read its official guidance (above),
then work through only the decision points *that stack actually forces* (see
`decision-points.md`), one question at a time. Write an `## Architecture (context you must not break)` section plus the
handful of rules those answers produce. Stop there: 5–8 rules is a healthy day one.
A long document written before the code exists is mostly guesses, and wrong guesses
are expensive to unwind.

**harvest**: existing codebase. Read the source and recent history for patterns that
are already followed but unwritten, and for places the codebase contradicts itself.
Propose each as a rule **with its evidence**: the files that already comply, and the
ones that don't. A pattern with no counter-example may not need writing down; a
pattern the codebase breaks in three places is either a rule or a mistake: say which
you think it is.

**capture**: a decision was just made, in conversation or in a PR. Run it through the
five filters, write it in the shape above, place it in the section it belongs to.
This is the common case: the document grows one decision at a time.

## Placement and numbering

Numbering is **append-only**. A new rule takes the next free number and existing rules
are never renumbered, because `AGENTS EXCEPTION (rule 11)` markers in the code point at
numbers. Group rules under the headings the document already uses; add a heading only
when a third rule needs it.

Every document gets two clauses, once, near the top. The escape hatch: a rule that is
genuinely unreasonable at a specific site may be deviated from with a comment beginning
`AGENTS EXCEPTION (rule N):` plus short reasoning; without one, deviation is a review
finding, and so is a marker whose reasoning doesn't hold up. A convention doc with no
escape hatch produces either lies or bad code. And the capture clause: when a decision
made during a session would pass the five filters, run this skill to capture it before
the session ends. The convention document is the one file every agent reads, so the
trigger for growing it lives there, not in the skills that happen to make decisions.

## Never propose

Formatting, naming casing, import order, line length (tooling's job) · restatements of
general principles like DRY or SOLID (that's `code-design-review`) · aspirations with
no test ("write clean code") · rules about code that doesn't exist yet.

## Output

Show the exact markdown block to be inserted and where it goes. Apply only on
confirmation. When a proposal contradicts an existing rule, say so and name the number.
Superseding is a decision for the user, not a silent edit.

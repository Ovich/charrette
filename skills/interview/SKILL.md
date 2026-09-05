---
name: interview
description: Use when a person asks to be interviewed about a design object (an idea, a board, a spec, a plan, a change) until it is understood the same way by them and the agent, or when another skill needs its open decisions resolved one by one. Produces the resolved decisions written into the object's own document. Not for gathering requirements from scratch (brainstorm) and not a questionnaire.
---

# Interview

A design object holds decisions, and the decisions depend on each other. An interview
walks that tree and resolves it in order, so that when it ends the person and the
agent hold the same design and the document says so.

## The tree

Before the first question, lay out the decisions the object holds as a table in its
document: decision, status, what it depends on. A row is a choice a competent
engineer could have made differently and that the object rests on, one row per
choice, not per sentence. When the object or its board already carries such a table,
that table is the tree: cite its rows by their ids and add to it, never copy it.
Everything asked or found from here on is written there, never left in chat. A
question that uncovers a decision the table did not have adds a row.

Statuses: **agreed**, the person said yes or a source settles it; **proposed**, your
recommendation is on the table and unanswered; **open**, no recommendation yet;
**deferred**, the current increment's verification does not need it, with a named
owner.

## The order

Resolve a decision before the ones that depend on it. A question asked out of order
is answered on an assumption that a later answer overturns, and both answers then
have to be revisited.

## Look before asking

A question the codebase, the git history, the conventions file or the existing
documents can answer is answered by reading them, and the table records the answer
with its source. What has shipped is agreed by that fact. When the object and the
codebase disagree, the row records both and becomes a question for the person, which
one holds, never a judgment of yours. The person is asked only what nobody can read:
purpose, priority, appetite, what is out of scope, which of two defensible options
they want.

## Every question carries a recommendation

One question per message. Multiple choice where the options are knowable, open where
they are not, and in both cases your recommended answer first, with why. A question
without a recommendation hands the person the work rather than the decision.

## When it ends

When no row is open: every decision agreed, or deferred with a named owner and the
reason it can wait. Say that it ended, and what was deferred. An interview that stops
before that has left an assumption in the object, and an interview that continues
past it is asking about taste.

## What it is not

Not a review: it resolves what the object leaves undecided and does not judge what it
decided. Not a way to enlarge the object: a decision that belongs to a later
increment is deferred, not designed.

## Red flags

| Thought | Reality |
|---|---|
| "I'll ask a few questions at once to save time" | The second question assumes an answer to the first. One per message, in dependency order. |
| "They probably want the usual" | Then say so as the recommendation, and ask. An assumption written into a spec costs a rewrite; a question costs a message. |
| "The table is getting long" | Each row is a decision somebody would otherwise make silently. Defer the ones that belong to a later increment, name their owner, and stop when nothing is open. |

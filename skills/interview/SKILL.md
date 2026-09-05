---
name: interview
description: Use when a person asks to be interviewed about a design object (an idea, a board, a spec, a plan, a change) until it is understood the same way by them and the agent, or when another skill needs its open decisions resolved one by one. Produces the resolved decisions written into the object's own document. Not for gathering requirements from scratch (brainstorm) and not a questionnaire.
---

# Interview

The object is a tree of decisions, and each decision is answered by one of three
things: the codebase, the person, or a later increment. The interview finds out which,
for every decision, in the order the tree imposes.

**Read first.** Whatever the code, the history or the existing documents settle is
settled, and the decisions table in the object's document records it with its source.
Shipped code counts as a decision made. Where the object says one thing and the code
another, that is a question for the person, not a finding.

**Then ask, one decision at a time.** Start at the root, and never ask about a branch
before its parent is agreed. Each message holds one question and your recommended
answer with the reason, so the person decides rather than works. Keep asking until
nothing on the table is open. Thoroughness is the point: a decision left unasked is
one the implementation makes silently.

**Defer what this increment does not need.** A decision the increment's verification
does not depend on is marked deferred with an owner, not designed.

**The table is the record.** Decision, status (agreed, open, deferred), source or
owner, in the object's own document, never in the chat. When it has no open row, say
so, list what was deferred, and stop.

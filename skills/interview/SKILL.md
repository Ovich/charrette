---
name: interview
description: Use when a person asks to be interviewed about a design object (an idea, a board, a spec, a plan, a change) until it is understood the same way by them and the agent, or when another skill needs the object's open decisions resolved one by one. Runs in chat and leaves the resolved decisions there, for the caller to write where they belong.
---

# Interview

The object is a tree of decisions, and each decision is answered by one of two
things: what can be read, or the person. The interview finds out which, for every
decision, in the order the tree imposes.

**Read first.** Whatever the code, the history, the existing documents or, for a
library or a standard, its official documentation settle is settled, and the
interview records it with its source. Shipped code counts as a decision made. Where
the object says one thing and the code another, the person decides which holds.

**Then ask, one decision at a time.** Start at the root, and ask about a branch once
its parent is agreed. Each message holds one question and your recommended answer
with the reason, so the person decides rather than works: the decision named with
what it depends on, the question in one sentence, the recommended option first and
marked, each option carrying the trade-off that decides it, and a closing line that
takes a number or a rejection of the frame. Keep asking until every decision is
agreed or deferred. Thoroughness is the point: a decision left unasked is one the
implementation makes silently.

**"Not now" is an answer.** The person may defer a decision; it is recorded as
deferred with an owner and a reason.

**Close in chat.** When every decision is agreed or deferred, say so and list them
with their status and source. The caller, a skill or the person, decides where that
goes.

---
name: interview
description: Use when a person asks to be interviewed about an existing design document (a board, a spec, a plan, a change) until it is understood the same way by them and the agent, or when another skill needs the document's open decisions resolved one by one. Runs in chat and leaves the resolved decisions there, for the caller to write where they belong. Turning an idea into a spec is brainstorm's, hardening a plan is write-plan's.
---

# Interview

The object is a tree of decisions, and each decision is answered by one of two
things: what can be read, or the person. The interview finds out which, for every
decision, in the order the tree imposes.

**One decision per message, in tree order.** Start at the root, and take a branch
once its parent is agreed. Before each, read: the code, the history, the existing
documents and, for a library or a standard, its official documentation. When that
settles the decision, the message states the answer with its source and the person
confirms. Shipped code counts as a decision made, and where the object says one
thing and the code another, the person chooses which holds. When reading leaves it
open, the message asks, with your recommended answer and the reason, so the person
decides rather than works: the decision named with what it depends on, the question
in one sentence, the recommended option first and marked, each option carrying the
trade-off that decides it, and a closing line that takes a number or a rejection of
the frame. Keep going until every decision is agreed or deferred. Thoroughness is
the point: a decision left unasked is one the implementation makes silently.

**"Not now" is an answer.** The person may defer a decision; it is recorded as
deferred with an owner and a reason.

**Close in chat.** When every decision is agreed or deferred, say so and list them
with their status and source. The caller, a skill or the person, decides where that
goes.

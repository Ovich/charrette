---
name: interview
description: Use when a person asks to be interviewed about an idea or an existing design document (a board, a plan, a change) until it is understood the same way by them and the agent, or when another skill needs open decisions resolved one by one. Runs in chat and leaves the resolved decisions there, for the caller to write where they belong. Keeping the discussion as a document is brainstorm's, turning it into a plan is write-plan's.
---

# Interview

The object is a tree of decisions. Each is answered by what can be read or by the person.

**Two options, `research: yes | no` and `experiments: yes | no`.** Ask them first, in one
message with your recommendation, when the subject makes them plausible. Ask them later,
the moment a decision rests on a claim about the world: a tool exists, it works with our
versions, the industry does it this way, or the person doubts a tool. On a yes to either,
read `references/investigate.md`. The caller stores the answers with its decisions.

**One decision per message, in tree order**, a branch once its parent is agreed. What
reading settles is stated with its source, and the person confirms. Where a document says
one thing and the code another, the person chooses which holds. What reading leaves open
is asked: the decision with what it depends on, the question in one sentence, the
recommended option first and marked, each option with the trade-off that decides it, and
a closing line that takes a number or a rejection of the frame. A decision left unasked
is one the implementation makes silently.

**"Not now" is an answer**: deferred, with an owner and a reason.

**Close in chat**: every decision with its status and source. The caller decides where
that goes.

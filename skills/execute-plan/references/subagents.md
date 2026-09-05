# Subagent mode

## The brief

A brief has four slots, in this order: where the plan is (its aiview path, the step's
node id); the step's jurisdiction, its node text and done-when, and nothing beyond it;
the facts this session has already established, given as facts (the branch, the
commands that verify, what an earlier step found); the return contract: what changed,
where, the evidence the done-when is met, and anything found that the plan did not
predict. A subagent never edits the tracker. This session is its single writer.

## Parallel branches

Where the plan draws a fork (`references/tracker.md` says when one may be drawn),
dispatch one subagent per branch, each with its own brief, and put one `aiview
pending` card per branch on the plan document. Tick each branch as its return lands,
close its card, and run the join node's verification yourself. In inline mode a fork
is the one place worth asking, once, whether to run its branches as subagents after
all; on a no they run in the order drawn.

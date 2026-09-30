---
name: brainstorm
description: "Use when a person wants to think an idea through and keep the discussion: a feature, a tool choice, an architecture question, before a plan or without one. Produces a board in aiview holding the decisions, the diagrams and what was investigated. Not for an implementation plan and not for bug fixes."
---

# Brainstorm

**The discussion lives in one Markdown file from the first question, never in chat.**
`YYYY-MM-DD-<topic>.brainstorm.md`, through the `aiview` skill: kind `brainstorm`, tags = project + topic, group = the topic. With a
roadmap, the slot's slug is a tag. A resuming
session reads the board before asking anything again.

**Run the `interview` skill** and write each
answer into the board as it lands.

The board, in this order:

- **Decisions table**: id `D3`, decision, depends on, status (agreed, open, deferred), log entry `Q7`. The interview's `experiments` option is its first row.
- **Context being built on.**
- **Diagrams**, through the `write-diagrams` skill, drawn during the questions.
- **A question about a screen** is asked through the `point-at` skill.
- **What ran**: the recipes the experiments hand back.
- **Interview log**, last: one entry per question, verbatim, the options and the recommendation, then the answer as given.

**No code in the repository for the thing being discussed.**

**Close** by saying what is agreed and what is open.

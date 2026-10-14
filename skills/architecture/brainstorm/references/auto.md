# Auto brainstorm

A swarm of role seats debates the questions on the swarm board; you are the orchestrator and
the board's only writer. The board's mechanics are the `swarm` skill's (orchestrator side for
you, seat side for the seats); dispatch is the `orchestrate` skill's. In order:

## 1. The board first

Open it as `SKILL.md` says, its human part's brief written from the person's ask.

## 2. The strategy

The board's first section under the human part: a `field: value` table, written and approved
as the `orchestrate` skill's `references/charter.md` says.

| Field | Content | Recommended |
|---|---|---|
| topic | one line + the brief | from the ask |
| questions | the initial decisions rows, status open | from the ask, ordered as a tree |
| seats | the skeptic (fixed) + free-form topic seats, one row each: seat id, role prompt in full, written as the `orchestrate` skill's `references/roles.md` says, and the events that wake it (`on`, the seats file's field): the skeptic `on: ["agreement"]`, so every agreement reaches it unmentioned; a topic seat none | skeptic + 2 to 3 |
| seat cap | the most seats | 4 |
| evidence | a set, for all or per seat: `codebase`, `documents`, `web`, `connected`, or `none` | `codebase, documents` |
| experiments | yes · no; on yes, each seat its own sandbox outside the repository, only its recipe comes back | no |
| exchanges | N posts on one question before it escalates | 6 |
| budget | wall time and/or tokens; on hit, close with what stands | 45 minutes |
| new questions | seats may raise them: yes · no | yes |
| arbiter | orchestrator · person | person |
| board | the brainstorm board's file, group, tags | this board |

**Evidence**, what a seat may read:

- `codebase`: the repository read-only, its conventions, git history and tests. **Each seat
  reads the project's conventions file (AGENTS.md or CLAUDE.md) first when one exists**, and
  cites the rule when an idea conflicts with it; a project without one runs the same.
- `documents`: the project's aiview documents, cited with their date.
- `web`: official docs, specifications, published packages, the version and date read.
- `connected`: the MCP sources the strategy names, and only those.
- `none`: reasoning alone.

**Every claim a seat posts names its source**: `file:line`, `#<doc id>`, URL and date, or a
recipe. The skeptic's sign-off checks the source is there.

## 3. Approval in chat

Push-back is settled one decision at a time through the `interview` skill; the approved
strategy stays on the board.

## 4. Open the run

As the `swarm` skill's orchestrator side says: kind `brainstorm`, group the board's topic, one
seat per strategy row, each seat's `link` naming its row in the strategy section.

## 5. Dispatch

Every seat at once, as the `orchestrate` skill says, **each on the plugin's `seat-runner` agent
(`subagent_type: "charrette:seat-runner"`, no `isolation`), never on a general agent.** Give
it web or MCP tools only when the strategy's evidence lists them for that seat. Each brief:

```markdown
Take seat `<seat id>` in run `<run id>` with the `swarm` skill, seat side.

**Join**: `<the exact join command, --as included>`. **You**: `--as <group>/<seat id>` on every call.

**Your role**: the row `<seat id>` in the strategy section of `<board file>`, aiview id `#<id>`, read through the aiview skill. **The questions**: its decisions rows with status open.

**Evidence**: <the strategy's evidence for this seat>. **Experiments**: <no | yes, in your own sandbox at <path>, outside the repository>.
```

## 6. While it runs

Listen to every event (the `swarm` skill, orchestrator side). **You are the only writer of the
board; seats only debate.**

- **An agreement the skeptic endorsed**: its row `agreed`, `Source` the agreement's `#<seq>`;
  a diagram it names (seats post mermaid on the thread) promoted to *Diagrams* through the
  `write-diagrams` skill; the human part refreshed.
- **N exchanges on one question without one**: an escalation. With `arbiter: orchestrator`,
  post the ruling and its reason on the thread; it stands only once the skeptic endorses it,
  and is marked `ruled (by orchestrator)` in the row and in *For you*. With `arbiter: person`,
  or a ruling the skeptic objects to: the row goes `for the person`, both sides written.
- **A new question from a seat**: a row, when `new questions: yes` and the budget allows.
- **The person, in chat** (never on the page): relay to a seat (`post "@<seat> …"`), interrupt
  (the `swarm` skill, orchestrator side), rule, or add a question.

## 7. Close

When every question is settled or the budget is hit: `close` the run, the human part final, the
debate log written (per question: the posts that moved it, the agreement verbatim). Then what
is `for the person` goes through the `interview` skill, its answers written on the board.

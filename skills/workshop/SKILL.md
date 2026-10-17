---
name: workshop
description: "Use when a person wants a swarm of role seats to work a topic on the swarm board under a chosen protocol: a brainstorm (ideas before any judgment) a debate (questions argued to decisions, a skeptic endorsing) or an editorial (one text drafted, read by seats standing for its readers, revised), or a seat's brief names a workshop protocol. Produces the protocol's board in aiview, written by the orchestrator alone. Not for one person thinking aloud with the agent (brainstorm, interview) and not for a plan's slices (execute-plan)."
---

# Workshop

You are the facilitator: an orchestrator running role seats on the swarm board under one
protocol, the board's only writer. The board's mechanics are the `swarm` skill's (orchestrator
side for you, seat side for the seats); dispatch, charter and roles are the `orchestrate`
skill's.

**The run goes to its end without the person.** The person approves the strategy before and
reads the result after; every choice in between is yours, made against the strategy's
`criteria`, its reason posted on the thread and written on the board. Nothing waits on chat.

**Seats know the orchestrator and each other, never the person.** A seat asks `@orchestrator`
and you answer; nothing a seat reads (its brief, its role, the protocol file, your posts) names
the person or waits on one. Seats read the board only where the protocol makes it their record (the
editorial run record); it then holds the work alone, never the person. You alone write it.

**The protocol decides the board, the phases, the moves allowed in each and what comes out.**
Read its file before the strategy:

| Protocol | When | File |
|---|---|---|
| brainstorm | the person wants options, many and varied, before choosing | `references/brainstorm.md` |
| debate | the questions are known and need deciding, with sources | `references/debate.md` |
| editorial | a text must be written for a given reader: a letter, a proposal, a README | `references/editorial.md` |

## 1. The strategy

Open the protocol's board first, its human part's brief written from the person's ask. The
strategy is its first section under the human part: a `field: value` table, written and approved
as the `orchestrate` skill's `references/charter.md` says; push-back settled one decision at a
time through the `interview` skill. The protocol adds its fields.

| Field | Content | Recommended |
|---|---|---|
| protocol | one of the table above | from the ask |
| questions | what the seats work, one row each | from the ask, 1 to 3 |
| seats | one row each: seat id, role prompt in full (the `orchestrate` skill's `references/roles.md`), `on` | what the protocol recommends |
| evidence | a set, for all or per seat, below | `codebase, documents` |
| criteria | what you choose by when the protocol has you choose: what a good result is, what is ruled out | from the ask |
| budget | wall time, shared across the phases; a phase's share spent ends it, the run closes with what stands | 30 minutes |

**Evidence**, what a seat may read:

- `codebase`: the repository read-only, its conventions, git history and tests. **Each seat
  reads the project's conventions file (AGENTS.md or CLAUDE.md) first when one exists**, and
  cites the rule when an idea conflicts with it.
- `documents`: the project's aiview documents, cited with their date.
- `web`: official docs, specifications, published packages, the version and date read.
- `connected`: the MCP sources the strategy names, and only those.
- `given`: the files and links the person hands over, read-only.
- `none`: reasoning alone.

A claim, where the protocol asks for one, names its source: `file:line`, `#<doc id>`, URL and
date, or a recipe.

## 2. Open the run

As the `swarm` skill's orchestrator side says: kind as the protocol names it, group the board's
topic, one seat per strategy row, each seat's `link` naming its row.

## 3. Dispatch

Every seat at once, as the `orchestrate` skill says, **each on the plugin's `seat-runner` agent
(`subagent_type: "charrette:seat-runner"`, no `isolation`), never on a general agent**, web or
MCP tools only when the evidence lists them. Each brief, plus the lines the protocol adds:

```markdown
Take seat `<seat id>` in run `<run id>`, protocol `<protocol>` of the `workshop` skill, with the `swarm` skill, seat side.

**Join**: `<the exact join command, --as included>`. **You**: `--as <group>/<seat id>` on every call.

**Your role**: <the seat's role prompt, in full>. **The questions**: <the questions, in full>. **The criteria**: <the strategy's criteria>.

**Evidence**: <the strategy's evidence for this seat>.
```

**Register each seat's transcript as soon as it is dispatched**, `$S slice <seat id> --run <run> --transcript <path>`, so the board sees a still seat within seconds.

## 4. Phases

**You open every phase; a seat never does.** `$S phase <name> "<what it asks>" --as
<group>/orchestrator` (`$S` the `swarm` skill's tool) opens phase `<name>`; the current phase
ends with it: a separator in the thread that wakes every seat; its answer prints the step to run
next. A seat runs `$S done <name>` when its part is posted, or at once when the phase asks
nothing of it; the board tells you when every seat is done. You open the next phase then, or
when its share of the budget is spent, a seat missing then skipped and the board saying so. A
`stalled` event means act now: the thread has gone still, and its line says your step.

**Every post is every seat's.** The board delivers each post to every seat in full, and a wake
brings the whole unread thread; a seat acts only when addressed or a phase opens. Before a post
that decides or adds, a seat reads the whole phase (`thread`, as the owed-phase line says) and
opens on what it takes from whom (`#seq`) and what it sets aside, with why; a point raised is
answered by whoever's work it touches, never left to fall through. A point that concerns every
seat mentions them all (`@swarm`). A seat starting a long piece of work says so with `doing`, so a quiet thread still shows who works on what.

**A seat may propose going back**: `@orchestrator back <phase>: <the reason>`, the reason
naming what the later phase showed (a fact the research missed, a strategy the draft cannot
hold). You decide, on the criteria: reopen the phase with `$S phase <name> "again: <the reason>"`
and the phases after it run again, or decline on the thread with why. Each reopening
spends budget; the board logs it. Between phases you write the board as the
protocol says. A move the phase does not allow is answered on the thread with the phase's
rule, never written up.

**You never end your turn while the run is open.** Listen in the background, as `phase`'s
answer prints (`wait --mentions --as <group>/orchestrator`): every `done`, `all-done` and
`stalled` reaches you, joins and posts do not; read them with `deliver` when a phase closes, or as they land when the protocol has you steer them (editorial).
`stalled` reaches you alone, never a seat.

**The person, in chat, may still interrupt**: relay to a seat (`post "@<seat> …"`), stop the
run, or change a criterion; the run never asks them to.

## 5. Close

`close` the run once its last phase is done; the
human part final; the protocol's log written. Then,
the run over, the person gets what it produced: they approve a text, pick among ranked
options, settle a row left open, or ask for another run, through the `interview` skill, their
answers written on the board.

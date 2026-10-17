---
name: swarmstorm
description: "Use when a person wants a swarm of role seats to work a topic on the swarm board under a chosen protocol: a brainstorm (ideas before any judgment), a debate (questions argued to decisions, a skeptic endorsing) or an editorial (one text drafted, read by seats standing for its readers, revised; a cover letter among its templates), or a custom protocol recommended for the person's intent, or a seat's brief names a swarmstorm protocol. Produces the run's record in aiview, written by the orchestrator alone. Not for one person thinking aloud with the agent (brainstorm, interview) and not for a plan's slices (execute-plan)."
---

# Swarmstorm

You are the orchestrator, the run's facilitator: running role seats on the swarm board under one
protocol, the run's only writer. The board's mechanics are the `swarm` skill's (orchestrator
side for you, seat side for the seats); dispatch, charter and roles are the `orchestrate`
skill's.

**The run goes to its end without the person.** The person is interviewed and approves the
strategy before, and reads the result after; every choice in between is yours, made against the
strategy's `criteria`, its reason posted on the thread and written in the record. Nothing waits
on chat.

**Seats know the orchestrator and each other, never the person.** A seat asks `@orchestrator`
and you answer; nothing a seat reads (its brief, its role, the protocol file, the documents, your
posts) names the person or waits on one.

## Protocols and templates

**Protocols, templates and seats are defaults, never a form to fill.** Read what the person
wants done, and why, then recommend the protocol that fits, or its template when one matches,
with the reason; when none fits, recommend a **custom protocol**: its phases, each phase's moves
and who acts, and what comes out, drawn on the closest protocol below. The recommendation is
then adjusted with the person in the strategy (*1*): the phases added, dropped or reordered, the
seats added or removed, each role's prompt rewritten. **The protocol decides the phases, the
moves allowed in each, the default seats and what comes out.** Read its `protocol.md` before
the strategy:

| Protocol | When | File |
|---|---|---|
| brainstorm | the person wants options, many and varied, before choosing | `references/brainstorm/protocol.md` |
| debate | the questions are known and need deciding, with sources | `references/debate/protocol.md` |
| editorial | a text must be written for a given reader: a letter, a proposal, a README | `references/editorial/protocol.md` |

**A template is one use of a protocol, ready to run again**: the protocol's inputs filled for a
kind of work (the output's skeleton, the seats renamed, given personas or added, the election,
the interview's questions, the evidence it expects), never its phases. A protocol lists its
templates in its `protocol.md`; when the ask matches one, run the template; else the protocol's
defaults, the strategy filling what a template would. **A custom protocol run once lives in the
dossier's strategy; a person who wants it, or a new template, kept for every run of its kind**:
read `references/new-protocol.md` before writing either.

## 0. Before the run, with the person

**The run's documents**, through the `aiview` skill (`aiview path` for where each goes, `aiview
add` to index it, all in the topic's group), yours alone to write, seats reading and never
editing them: a **record** per run, each phase's work then what came out; and a **dossier**
when the topic is run more than once, kept and updated in place across its runs (the ask, the
interview, the inputs, the seats, the feedback). **Every run goes into aiview, every time**: a
new run is a new record, never a section appended to an earlier one; a document only on disk,
or only on the thread, does not exist for the next run. Their templates are the protocol's:
read its `documents.md` before writing either.

**Interview the person** (the `interview` skill), one decision at a time: their ask split into
its demands and judged against the evidence, each gap worked with one open question, then what
the protocol or template asks. Write it into the dossier as it goes, in two layers: their
answers and preferences bind; your proposals and samples may be overturned and are never
copied. **A fact they confirm that the evidence lacks** is written into the evidence, within its
existing fields, only on their yes; the run never edits evidence.

## 1. The strategy

The strategy is the dossier's `field: value` table, written and approved as the `orchestrate`
skill's `references/charter.md` says; push-back settled one decision at a time through the
`interview` skill. The protocol adds its fields; a template fills them. **Every field is the
person's to change**, before the run or between runs: the strategy is where the protocol, the
phases, the seats and each role are adjusted, never the skill's files. A change for one run is
written in the dossier only; one the person wants for every run of its kind becomes a template,
or a protocol (`references/new-protocol.md`), on their yes.

| Field | Content | Recommended |
|---|---|---|
| protocol | one of the table above, its template if any, or `custom` | from what the person wants done |
| phases | the protocol's phases as this run runs them: each with its moves, who acts and the message that opens it; for `custom`, written here in full, in the shape of a `protocol.md`'s phase table | the protocol's, adjusted with the person |
| questions | what the seats work, one row each | from the ask, 1 to 3 |
| seats | one row each: seat id, role prompt in full (the `orchestrate` skill's `references/roles.md`), effort, `on`; seats added, removed or rewritten for this run | the protocol's or template's, adjusted with the person |
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
- `given`: the files and links the person hands over, read-only, cited, never edited.
- `none`: reasoning alone.

A claim, where the protocol asks for one, names its source: `file:line`, `#<doc id>`, URL and
date, or a recipe.

## 2. Open the run

As the `swarm` skill's orchestrator side says: kind as the protocol names it, group the topic,
one seat per strategy row, each seat's `link` naming the dossier. The record is created and
indexed before the dispatch. A recording, when the person wants one, starts before the joins,
on this run's own board (`#doc=<id>&run=<run>`), and its own first frame is checked before any
seat is dispatched.

## 3. Dispatch

Every seat at once, as the `orchestrate` skill says, **each on the plugin's `seat-runner` agent
(`subagent_type: "charrette:seat-runner"`, no `isolation`), never on a general agent**, at the
effort its row names, web or MCP tools only when the evidence lists them. Each brief, plus the
seat's parts from the protocol:

```markdown
Take seat `<seat id>` in run `<run id>`, protocol `<protocol>` of the `swarmstorm` skill, with the `swarm` skill, seat side. `$S` = `<the swarm tool's command>`.

**Join**: `<the exact join command, --as included>`. **You**: `--as <group>/<seat id>` on every call.

**Your role**: <the seat's role prompt, in full>. **The questions**: <the questions, in full>. **The criteria**: <the strategy's criteria>.

**Evidence**: <the strategy's evidence for this seat>. **Dossier**: `<path>`, the sections <the ones this seat reads>. **Record**: `<path>`: read it at the start of every phase.

**Your parts**: <per phase, from the strategy's phases; a phase that asks you nothing: `done` at once>.

**The phases** (a custom protocol only): <the strategy's phase table, in full>.

**Posts**: write each to `<folder>/<seat>-<n>.md`, then `$S post --file <that path> --as <group>/<seat id>`; those are the only files you write. A post failing twice goes to `@orchestrator` at once, never retried in silence.

One command per shell call. Never end your turn while the run is open; when the board says the run is closed, run the end command it gives and return a short summary.
```

**Register each seat's transcript as soon as it is dispatched**, `$S slice <seat id> --run <run> --transcript <path>`, so the board sees a still seat within seconds.

## 4. Phases

**You open every phase; a seat never does.** `$S phase <name> "<what it asks>" --as
<group>/orchestrator` (`$S` the `swarm` skill's tool) opens phase `<name>`; the current phase
ends with it: a separator in the thread that wakes every seat; its answer prints the step to run
next. **The message says each seat's part, so a seat knows it from the message alone**; the
protocol gives the messages. A seat runs `$S done <name>` when its part is posted, or at once
when the phase asks nothing of it. **Open the next phase the moment `all done` arrives**, or
when its share of the budget is spent, a seat missing then skipped and the board saying so. Fix
tooling only between phases: the seats wait on you, and a still board reads as a stalled one.

**Every post is every seat's.** The board delivers each post to every seat in full, and a wake
brings the whole unread thread; a seat acts only when addressed or a phase opens. Before a post
that decides or adds, a seat reads the whole phase (`thread`) and opens on what it takes from
whom (`#seq`) and what it sets aside, with why; a point raised is answered by whoever's work it
touches, never left to fall through. A point that concerns every seat mentions them all
(`@swarm`). **Every post that hands work on mentions whoever acts next**: a seat is woken only
by a mention. A seat starting a long piece of work says so with `doing`.

**You never end your turn while the run is open.** Listen in the background, as `phase`'s
answer prints: `wait --mentions --as <group>/orchestrator` hears every `done`, `all-done` and
`stalled`; a protocol that has you steer the posts listens with `wait` alone, so every post
wakes you and is read as it lands. **A seat silent past its share, or one that ran `done`
before its part**, is mentioned with what it owes and the posts it has to answer; a `stalled`
event means act now. `stalled` reaches you alone, never a seat.

**Write each phase into the record as it closes**, in full, never as a pointer to the thread:
each post of the phase, in thread order, under `### <Seat>`, its body as posted with what only
served the thread removed (the mentions, the `#seq` references, the `done` and hand-off lines),
headings inside a post demoted to bold so the outline stays the phases'; your own posts (a
correction, a count, a ruling) under `### Orchestrator`; an event (a join, a `done`, a stall)
never. A reopened phase's new round is a new section (`## 7. Read, round 2`), the earlier one
kept.

**A seat may propose going back**: `@orchestrator back <phase>: <the reason>`, the reason
naming what the later phase showed. You decide, on the criteria: reopen the phase with
`$S phase <name> "again: <the reason>"` and the phases after it run again, or decline on the
thread with why. Each reopening spends budget; the record keeps both rounds. A move the phase
does not allow is answered on the thread with the phase's rule, never written up.

**The order of authority** in every ruling: truth first (the evidence), then the person's
preferences and feedback, then what the protocol or template ranks next, then a seat's taste.

**The person, in chat, may still interrupt**: relay to a seat (`post "@<seat> …"`), stop the
run, or change a criterion; the run never asks them to.

## 5. Close, and after

`close` the run once its last phase is done, the record ending on what the run produced. Then
the person gets it: they approve a text, pick among ranked options, settle a row left open, or
ask for another run, through the `interview` skill, their answers written in the record.

- **What they say of it goes into the dossier's feedback**, in their reason's words, the day it
  was said, for the next run; never only into chat.
- **Nothing they keep is replaced without their yes** (a delivered file, a record, a
  recording); what it replaces is kept aside.

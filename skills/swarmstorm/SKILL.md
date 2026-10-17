---
name: swarmstorm
description: "Use when a person wants a swarm of role seats to work a topic on the swarm board under a chosen protocol: a brainstorm (ideas before any judgment), a debate (questions argued to decisions, a skeptic endorsing) or an editorial (one text drafted, read by seats standing for its readers, revised; a cover letter among its templates), or a custom protocol recommended for the person's intent, or a seat's brief names a swarmstorm protocol. Produces the run's record in aiview, written by the orchestrator alone. Not for one person thinking aloud with the agent (brainstorm, interview) and not for a plan's slices (execute-plan)."
---

# Swarmstorm

You are the **orchestrator**: you run role seats on the swarm board under one protocol, and you
alone write the run's documents. The board's verbs are the `swarm` skill's, orchestrator side;
dispatch, charter and roles are the `orchestrate` skill's.

- **The run goes to its end without the person.** They approve the strategy before and read the
  result after; every choice between is yours, made on the strategy's `criteria`, its reason
  posted on the thread and written in the record.
- **Seats know the orchestrator and each other, never the person.** Nothing a seat reads names
  the person or waits on one; a seat asks `@orchestrator`.

## Choose the protocol

- **Recommend from what the person wants done**: the protocol that fits, its template when one
  matches, with the reason; when none fits, a **custom protocol** (its phases, each phase's
  moves and who acts, what comes out) built on the closest one.
- **Protocols, templates and seats are defaults**: the person adjusts the phases, the seats and
  each role in the strategy.
- **Read the protocol's `protocol.md` before the strategy**:

| Protocol | When | File |
|---|---|---|
| brainstorm | options, many and varied, before choosing | `references/brainstorm/protocol.md` |
| debate | known questions to decide, with sources | `references/debate/protocol.md` |
| editorial | a text for a given reader: a letter, a proposal, a README | `references/editorial/protocol.md` |

- **A template is one use of a protocol, kept to run again**: its inputs filled for a kind of
  work, never its phases. The protocol lists its templates.
- **A change for one run lives in the dossier**; one the person wants for every run of its kind
  becomes a template or a protocol on their yes: read `references/new-protocol.md` first.

## Before the run

- **Two documents, through the `aiview` skill, in the topic's group**: a **record** per run,
  each phase's work then what came out; a **dossier** when the topic runs more than once, kept
  across its runs. A new run is a new record. Read the protocol's `documents.md` before writing
  either.
- **Interview the person** (the `interview` skill): their ask split into its demands and judged
  against the evidence, each gap one open question, then what the protocol or template asks;
  written into the dossier as it goes. Their answers and preferences bind; your proposals and
  samples may be overturned and are never copied.
- **A fact they confirm that the evidence lacks** goes into the evidence, within its existing
  fields, on their yes; the run itself never edits evidence.

## The strategy

The dossier's `field: value` table, approved as the `orchestrate` skill's
`references/charter.md` says, every field the person's to change. The protocol adds fields; a
template fills them.

| Field | Content | Recommended |
|---|---|---|
| protocol | from the table above, its template, or `custom` | from what the person wants done |
| phases | each phase as this run runs it: who acts, the moves, the message that opens it; a custom protocol's in full, as a `protocol.md` phase table | the protocol's |
| questions | what the seats work, one row each | 1 to 3 |
| seats | per seat: id, role prompt in full (the `orchestrate` skill's `references/roles.md`), effort, `on` | the protocol's or template's |
| evidence | below, for all or per seat | `codebase, documents` |
| criteria | what a good result is, what is ruled out | from the ask |
| budget | wall time across the phases; a phase's share spent ends it | 30 minutes |

**Evidence**, what a seat may read; a claim names its source (`file:line`, `#<doc id>`, URL and
date, or a recipe):

- `codebase`: the repository read-only; **each seat reads the conventions file (AGENTS.md or
  CLAUDE.md) first** and cites the rule an idea conflicts with.
- `documents`: the project's aiview documents, cited with their date.
- `web`: official docs, specifications, published packages, the version and date read.
- `connected`: the MCP sources the strategy names, and only those.
- `given`: the files and links the person hands over, read-only.
- `none`: reasoning alone.

## Open and dispatch

- **Open the run** as the `swarm` skill's orchestrator side says: kind from the protocol, group
  the topic, one seat per strategy row, each seat's `link` the dossier; the record created and
  indexed before the dispatch.
- **A recording** starts before the joins, on this run's own tab (`#doc=<id>&run=<run>`), its
  own first frame checked before any seat is dispatched.
- **Every seat at once on the plugin's `seat-runner` agent** (`subagent_type:
  "charrette:seat-runner"`, no `isolation`), at its row's effort, web or MCP tools only when its
  evidence lists them; its transcript registered at once (`slice <id> --transcript`).
- **The brief**:

```markdown
Take seat `<seat id>` in run `<run id>`, protocol `<protocol>` of the `swarmstorm` skill, with the `swarm` skill, seat side. `$S` = `<the swarm tool's command>`.

**Join**: `<the exact join command, --as included>`. **You**: `--as <group>/<seat id>` on every call.

**Your role**: <the role prompt, in full>. **The questions**: <in full>. **The criteria**: <the strategy's>.

**Evidence**: <this seat's>. **Dossier**: `<path>`, sections <the ones this seat reads>. **Record**: `<path>`, read at the start of every phase.

**Your parts**: <per phase, what its message asks of you; a phase that asks nothing: `done` at once>. **The phases** (a custom protocol only): <the strategy's phase table>.

**The thread**: every post reaches every seat. Before a post that decides or adds, read the whole phase (`$S thread`) and open on what you take from whom (#seq) and what you set aside, with why. Answer a point that touches your work. End a hand-off by mentioning whoever acts next; a point for everyone mentions `@swarm`. Before long work, `$S doing "<what>"`.

**Posts**: write each to `<folder>/<seat>-<n>.md`, then `$S post --file <that path> --as <group>/<seat id>`; those are the only files you write. A post failing twice goes to `@orchestrator` at once.

One command per shell call. Never end your turn while the run is open; when the board says it is closed, run the end command it gives and return a short summary.
```

## During the run

- **You open every phase** with `phase`, its message saying each seat's part, so a seat knows it
  from the message alone.
- **Open the next phase the moment `all-done` arrives**, or when its budget share is spent, a
  seat missing then skipped. Fix tooling only between phases.
- **Listen until the close**: `wait --mentions` as `phase` prints, or `wait` alone when the
  protocol has you steer every post.
- **A seat silent past its share, or `done` before its part**, is mentioned with what it owes.
- **Write each phase into the record as it closes**, in full: each post in thread order under
  `### <Seat>`, minus what only served the thread (mentions, `#seq`, `done` and hand-off lines),
  its headings demoted to bold; yours under `### Orchestrator`; events never. A reopened phase is
  a new section (`## 7. Read, round 2`), the earlier kept.
- **A seat may propose going back** (`@orchestrator back <phase>: <reason>`): reopen the phase
  with `phase <name> "again: <reason>"`, the phases after it running again, or decline on the
  thread with why.
- **A move the phase does not allow** is answered on the thread with the phase's rule.
- **Order of authority** in every ruling: truth (the evidence), then the person's preferences
  and feedback, then what the protocol ranks next, then a seat's taste.
- **The person may interrupt in chat**: relay to a seat, stop the run, or change a criterion.

## Close and after

- **`close` once the last phase is done**, the record ending on what the run produced; the person
  then decides on it through the `interview` skill, their answers written in the record.
- **What they say of the result goes into the dossier's feedback**, in their reason's words,
  dated.
- **Nothing they keep is replaced without their yes**: a delivered file, a record, a recording;
  what it replaces is kept aside.

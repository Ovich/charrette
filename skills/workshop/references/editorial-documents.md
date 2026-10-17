# Editorial: the documents of a run

Four documents carry an editorial run. The orchestrator creates each through the `aiview`
skill (`aiview path <file>` for where it goes, `aiview add` to index it, every document of one
run in one aiview group), and is their only writer once the run is open; seats read them and
never edit them. Each template below is the skeleton to copy; `<…>` is filled, nothing else is
added.

**Every run goes into aiview, every time.** A new run is a new board document, created and
indexed before the dispatch, never a section appended to an earlier run's board; the interview,
the feedback and the manifests are the same documents carried from run to run, updated in place
and re-indexed; all four sit in the text's aiview group, so the person finds every run beside
the inputs it used. A document that lives only on disk, or only on the thread, does not exist
for the next run.

| Document | Kind | Created | Written by | Read by |
|---|---|---|---|---|
| the interview | `reference` | before the run, during the interview | the orchestrator, with the person | every seat but the readers |
| the feedback | `reference` | before the first run on a text; kept across runs | the orchestrator, after each run | every seat but the readers, and the orchestrator |
| the manifests | `reference` | before the run, after the interview | the orchestrator | each seat its shared part and its own section |
| the board | `report` | when the run opens, before the dispatch | the orchestrator, as each phase closes | every seat at the start of each phase (readers: only what the protocol gives them) |

## The interview

`YYYY-MM-DD-<topic>-interview.reference.md`. Written as the interview goes, one answer at a time;
the person confirms each restated answer before it is kept. Its first paragraph states the two
layers; a later round of preferences is added as its own section, dated, superseding the earlier
answers it names.

```markdown
# <Topic>: the interview

An input to the <topic> run, read by every seat. The person's answers, confirmed facts and
preferences bind. The orchestrator's proposals and every sample sentence may be overturned with a
reason and are never copied into the text. Each answer is restated in the register the text
needs; the content binds, the wording here is not a model for the text's style.

**This is material, not a checklist**: the text carries a few of these points; the brief chooses
which, and names what it leaves out.

## 1. The ask against the evidence

<the reader's ask split into its demands, each split into parts, each met · partly · gap, with
where the evidence holds it; the verdict in one sentence; "gaps inform emphasis, never content">

## 2. Questions and answers

**Q1. <the question, as asked>**

<the answer, restated; what the evidence already held; what it answers>

## 2b. The person's preferences

Each shown on one sentence written two ways; the choice and its cost.

**Q<n>. <voice | register | level of detail | the one thing the reader keeps | the close | …>.**
Shown: A « … » / B « … ». **Preference: <A | B | their own>.** The cost to watch: <…>.

## 3. Confirmed facts beyond the evidence

Written into the evidence on the person's yes, within its existing fields, dated:

- (Q<n>) <the fact, as written into <where>>

## 4. The brief

_Settled by the strategist in the run._
```

## The feedback

`YYYY-MM-DD-<topic>-feedback.reference.md`. Created empty before the first run on a text, then
carried over: after each run the orchestrator adds what the person said of the result, in their
reason's words, the day it was said. Never only in chat.

```markdown
# <Topic>: the person's feedback across runs

The `feedback` input of the editorial protocol. It binds like the person's preferences; the
facts still come from the evidence.

## What the person rejected, and why

| run | what | their reason |
|---|---|---|
| <run> | <the phrase, claim or choice, quoted> | <their reason> |

## Claims struck

- <the claim>: <why, and what the evidence holds instead>

## Preferences in force

<the interview's latest preference section, by reference, plus any set since>

## What worked

<the run, its readers' verdict, and what made the difference>
```

## The manifests

`YYYY-MM-DD-<topic>-seats.reference.md`. One document: **All seats**, then one section per seat.
It says who the seats are, what they read and what each owns, never the text's structure,
positioning, tone or level of detail: the brief settles those.

```markdown
# <Topic>: the seats

Each seat reads **All seats** and its own section, nothing else here. The protocol is the
`workshop` skill's `editorial`.

## All seats

**Whose text this is.** <whose text, for which reader, to what end; write it as if it were
yours: the evidence is your only experience.>

**What you read** (read-only, never edited):

| Input | What it is | Binding |
|---|---|---|
| <the interview> | the person's answers, facts and preferences | they bind; the orchestrator's proposals may be overturned |
| <the feedback> | what the person rejected, struck and set | binds like the preferences |
| <the evidence> | the facts | every fact and every constraint binds |
| <the reader's own document> | the ask | the reader's own words |
| <the precedents> | earlier texts of the same kind | wording and framing only; a fact counts only if the evidence still holds it |
| <the board's given sections> | context researched before the run | a figure or quote enters only with its source |

**Reading.** <how to read a large source: look up by name, never whole.>

**Truth.** A claim holds only if the evidence or the interview's confirmed facts hold it; a gap
is never content and never conceded.

**The text.** <language, the part written (body only, or the whole), length.>

**The thread.** Every post reaches every seat in full. Before a post that decides or adds, read
the whole phase (`thread`) and open on what you take from whom (#seq) and what you set aside,
with why. A point for everyone mentions `@swarm`. Before long work, `doing "<what>"`. Every post
goes through a file (`post --file`).

**The election.** <the elected slots, the source of candidates, the vote's rules, as the
protocol's `election` field settles them.>

## judge
<what it reads first, what it posts, what it checks in the read and the final check>

## strategist
<the brief's points; the preferences that bind it; read light: the interview and the judge first>

## writer
<the voice rules that bind; the inputs that are not inputs (an earlier version of this text)>

## auditor
<the table's columns; what is priority 1; at most <n> rounds>

## checker
<the sources; the known struck claims; the veto in the election>

## <reader>
<the reader's persona and what it knows; the note format and the verdict line>
```

## The board

`YYYY-MM-DD-<topic>-record.report.md`, created when the run opens, before the dispatch: its head,
then any given sections (context researched before the run). One phase becomes one section,
written by the orchestrator as the phase closes, never before.

```markdown
# <Topic>: run record

The record of the run: every phase's work, written here as the phase closes. Every seat reads
this document in full at the start of each phase and builds on it.

**Question**: <what the text must do, for whom>.

## Given: <what was researched before the run>

<…>

## 1. Judge
### Judge
<the post>

## 2. Brief
### Strategist
<the brief>
### <Seat>
<its answer>
### Orchestrator
<a correction, if any>
### Strategist
<the settled brief>

## 3. Election: candidates
## 4. Election: votes and count
## 5. Draft
## 6. Polish
## 7. Read, round <n>
## 8. Revise
## 9. Final check

## The text (final)

<the final text, alone, as it will be used>
```

**How a phase is written in.** Each post of the phase, in thread order, under `### <Seat>`, its
body as posted with what only served the thread removed: the mentions, the `#seq` references,
the `done` and hand-off lines; headings inside a post demoted to bold so the board's outline stays
the phases'. An event (a join, a `done`, a stall) is never written in. The orchestrator's own
posts (a correction, the count, the rulings) go in under `### Orchestrator`. When a phase reopens,
its new round is a new section (`## 7. Read, round 2`), the earlier one kept.

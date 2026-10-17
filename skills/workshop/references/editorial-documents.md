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

## The briefs

One per seat, sent at dispatch on the `seat-runner` agent, the effort the seats row recommends.
The `workshop` skill's brief, completed for this protocol; `<parts>` comes from the seat's
lines below.

```markdown
Take seat `<seat>` in run `<run>`, protocol `editorial` of the `workshop` skill, with the
`swarm` skill, seat side. `$S` = `<the swarm tool's command>`.

**Join**: `$S join --run <run> --seat <seat> --doing reading --as <group>/<seat>`. **You**:
`--as <group>/<seat>` on every call.

**Manifests**: `<path>`, sections `All seats` and `<seat>` only. **Interview**: `<path>`.
**Feedback**: `<path>`. **Board**: `<path>`: read it at the start of every phase.

**Your parts**: <parts>.

**How the run works**: the orchestrator opens each phase; every message starts with the phase
and what it asks. Before a post that decides or adds, read the whole phase with
`$S thread --as <group>/<seat>` and open on what you take from whom (#seq) and what you set
aside, with why. Before long work, `$S doing "<what>"`. Every post through a file: write it to
`<folder>/<seat>-<n>.md`, then `$S post --file <that path> --as <group>/<seat>`; those are the
only files you write. Do what the phase asks of you (when it asks nothing, do nothing), then
`$S done <phase>`. Follow exactly the next step each answer prints. Everyone is `@swarm`. A post
failing twice goes to `@orchestrator` at once.

One command per shell call. Never end your turn while the run is open; when the board says the
run is closed, run the end command it gives and return a short summary.
```

**The parts, per seat** (a phase that asks a seat nothing is `<phase> (nothing: done at once)`):

| seat | parts |
|---|---|
| judge | research (the table and the brief's input, ending `@swarm`) · strategy (answer the brief, ending `@strategist`) · propose · vote · read (at most 5 notes: does the text answer the ask's core) · final (at most 3 notes or `clean`) |
| strategist | research (read the interview and the judge first, light) · strategy (the brief, ending `@swarm`; after every seat answered, the settled brief, each point taken or declined; **only then** `done strategy`) · propose · vote · polish (when a fact is missing: what the interview or the evidence holds) · read (is the brief kept) · final |
| writer | strategy (the voice and form it would write in) · propose · vote · draft (a ledger of the points raised, taken or declined, then the whole text from the winners and the brief) · polish (the whole next version, ending `@auditor`) · revise (the whole text, then per note) · final (one fix, only if a blocking note is addressed to it) |
| auditor | strategy (what the reader must see, what to leave out) · propose · vote · polish (drives: the table, ending `@checker`; ends polish) · read · final |
| checker | strategy (what the evidence allows and forbids, the claims likeliest to outrun it) · propose · vote (vetoes first) · polish (strikes and the strongest held wording, ending `@writer`) · read · final |
| reader | strategy (as the reader: what it must believe, what makes it stop) · vote (as the reader, counts double) · read (only the latest whole text: notes and the verdict) · final (only the latest text) |

Every seat's brief says what it never reads: a reader never reads the evidence, the interview or
the board's analysis, only its own reader's document and what the thread gives it; the writer
never reads an earlier version of this text as input.

## The phase messages

What `phase <name> "<text>"` says, so each seat knows its part from the message alone:

| phase | text |
|---|---|
| research | `judge: read the board, the manifests (All seats and judge) and the interview; post the table as it now stands, then for the brief: what the ask is really about, the strongest met demands, the misreadings and their framing; ending @swarm, then done research. Every other seat: read the manifests and the interview now, then done research.` |
| strategy | `The brief. strategist: post the whole brief, with the slots and the elected ones, ending @swarm. Every other seat, once it is posted: read the whole phase, answer from your role, ending @strategist, then done strategy. strategist: once all have answered, the settled brief, each point taken or declined, ending @swarm, and only then done strategy.` |
| propose | `The election, step 1. Settled brief #<seq> (elected: <slots>). Every seat but the readers: one post, at most one candidate per elected slot, labelled, <from the precedents, the source named | written fresh>, within the slot's limit; ending @swarm, then done propose. Readers: done propose now.` |
| vote | `The election, step 2. Candidates: <seat #seq (letter)…>. checker: your vetoes first. Every seat: per slot, approve as many as fit, one line of why each, never your own, also on natural language and pull; ending @orchestrator, then done vote. Readers: as the reader; your approvals count double.` |
| draft | `writer: the whole text from the settled brief #<seq> and the winners <…> fused into one voice, the other slots to the brief; a ledger first; ending @orchestrator, then done draft. Every other seat: done draft now.` |
| polish | `On the whole text (#<seq>) and the orchestrator's notes. auditor drives, at most <n> rounds: one table over every sentence, the notes first; end @checker. checker strikes and proposes, ending @writer. writer posts the whole next version, ending @auditor. auditor ends polish: done polish, then @swarm polish is over; writer and checker then done. Every other seat: done polish now.` |
| read | `Round <n> on the whole text (#<seq>). Every seat but the writer: at most 5 notes from your role, ending @orchestrator; readers: only that text, notes and the verdict. Then done read. writer: done read now.` |
| revise | `writer: the read and the orchestrator's rulings (#<seq>); the whole new text, revised as a whole, then per note taken or declined; ending @orchestrator, then done revise. Every other seat: done revise now.` |
| final | `Final check on #<seq>. Every seat but the writer: only what still breaks a rule, a source or natural language, at most 3 notes, or clean; readers: the verdict. Then done final. writer: one fix only if a blocking note comes to you; done final now.` |

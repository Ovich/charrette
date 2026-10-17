# Protocol: editorial

One text written by one seat, read by seats standing for its real readers, revised on what they
say. Out: the final text, its rounds kept in the record.

**The protocol is the same for any text; the kind of text lives in the run's inputs**: the
**template** (`templates/`, below), or with none the strategist's brief, settles the skeleton
(sections or paragraphs and what each must do), length, tone and **altitude**, the level of
detail the reader is owed; the **dossier** (`documents.md`) holds the person's ask, answers,
preferences, evidence, seats and feedback. The default seats, their parts and their briefs are
`seats.md`: read it before writing the dossier's **Seats**.

**Record**: a new one for every run, its template in `documents.md`, its sections the phases'
(`## 1. Research` to `## 9. Final check`), ending on `## The text (final)`, the final text
alone, as it will be used. **Every phase's work is written in as the phase closes**, in full:
the judge's table; the brief, the answers and the settled brief; every candidate, every vote and
the count; the draft; each polish iteration's table, strikes and whole text; the read notes and
the rulings; each revision with its per-note replies; the final check. **It is also the seats'
working memory**: every seat reads it in full at the start of each phase and builds on what is
there.

## Templates

| Template | When | File |
|---|---|---|
| cover-letter | a cover letter for a job posting, from the candidate's evidence and earlier letters | `templates/cover-letter.md` |

## Strategy, beyond the shared fields

| Field | Content | Recommended |
|---|---|---|
| questions | one row: what the text must do, for whom, its length and tone | from the ask |
| seats | as `seats.md` | its defaults, or the template's |
| template | the skeleton the run fills, binding on the writer; the auditor's hierarchy orders the proofs inside it | from the ask, or the strategist's brief |
| altitude | strategic (what, why it matters, what it changed for people; a mechanism only when it is the differentiator, named one level up, never its parts), operational, or technical | from the template |
| evidence | adds `given`: the files and links handed over with the ask (a brief, a draft, a spec, the reader's document) | `given, web` |
| criteria | what the text must achieve and what is ruled out | from the ask |
| election | the slots elected (the parts that make the impression), the rest written by the writer; and where the candidates come from: `precedents`, earlier texts of the same kind the person provides, the source of wording and framing only, never of facts, the facts always from the evidence; or `generated`, written by each seat from the strategy and the evidence | the opening, the turning point and the close; `precedents` whenever the person has earlier texts, else `generated` |
| feedback | the dossier's feedback, read by every seat and by you, kept apart from the evidence | carried from run to run |
| iterations | polish iterations on the whole text, at most | 2 |
| rounds | read-and-revise rounds on the whole text | 1 |
| budget | as shared | 30 minutes |

## Phases

| Phase | Who | May | May not | You, after |
|---|---|---|---|---|
| **1 research** | judge; the style keeper | the judge reads the reader's context first: the dossier's given research, else the evidence's `web`, every figure with its source; then posts one table: the reader's ask split into its demands, each split into its parts, each part met · partly · gap, the evidence that backs it (where, never more than it says); then what the ask is really about, the strongest met demands in the order they serve the text, and where the text could be misread, with the framing that prevents it (gaps are background, never content); the style keeper posts the markers of the reader's own voice, each quoted from their document | write the text | the table on the record; the auditor holds the text to the demands marked strongest |
| **2 strategy** | the strategist, then every seat answering it | the strategist posts **the brief** in one post, each point with its recommendation and reason: who reads first and how long they give it, the one thing they keep (one thesis sentence every part must serve), the motivation and its weight, tone and form each shown on one sentence written in that form, **the text's slots** (what each must do, its length, the elected ones marked), each work or point by name (expand · condense · one line · out) with its angle, what is left out, each figure with its source; every other seat answers from its role; the strategist then posts **the settled brief**, each point taken or declined with why, and only then runs `done` | propose wording beyond a sample; a sample that invents a fact (seats copy samples) | correct the brief before the seats build on it; the settled brief on the record |
| **3 propose** (blind) | every seat but the readers and the style keeper | post at most one candidate per elected slot, labelled by slot, within the brief and its slot's limit: from `precedents`, a passage taken from one of them (its file named) and adapted, its facts from the evidence; from `generated`, written fresh from the evidence | read the others' candidates first; carry a fact from a precedent that the evidence no longer holds | nothing |
| **4 vote** | every seat | per slot, approve as many candidates as fit the brief, each approval with one line of why, also on natural language and pull; the checker first vetoes a candidate whose fact the evidence does not hold, naming where; a reader seat's approval counts double | approve its own candidate | post the count: per slot, the most approvals win; a tie goes to the reader seats' choice, then to you on the criteria, truth first; the winners are raw material the writer fuses into one voice, and the checker verifies them again |
| **5 draft** | writer | post a ledger of the points raised, taken or declined, then the full text, one block, built on the winners fused into one voice, the other slots written to the brief | — | the text on the record |
| **6 polish** | auditor, checker, the style keeper, writer, on the whole text | per iteration: the auditor posts one table covering every sentence of the whole text, paragraph by paragraph: the sentence, what it lacks (scope · outcome · verb · aim), its priority (1 to 3, natural language and the text's pull first), a stronger version, the source that carries it, or `keep` / `cut`; below it, what only the whole shows: every fact said once, no verb or phrase repeated, tenses consistent, each work's room matching its weight, every demand of the judge's table answered, complex sentences made simple, the hierarchy and the altitude kept; a sentence that narrates a process instead of stating a concept or a proof is weak, and the row proposes the concept form; the checker strikes any row that outruns its source and gives the strongest wording the source does hold; the style keeper marks what departs from the reader's voice; the writer posts the whole next version, taking the rows left or saying why not, `unchanged` at once when nothing is left | rework one paragraph in isolation | the whole text replaced on the record, with the table and the strikes; the next iteration, until every row says `keep` or the iterations are spent; the auditor ends polish (`done polish`, then `@swarm polish is over`), and the others run `done` after it |
| **7 read** | every seat but the writer | per note, at most 5, on the whole text: the line quoted, the reaction as that seat, the change asked; a claim's note names what the source lacks; the auditor's note on a work out of order, or a minor one given more room than a core one, is blocking; the strategist's note says whether the brief is kept | rewrite the text | the notes on the record, the round numbered; your rulings in one post, each note taken or declined with why, the checker winning on truth over impact; a gap the evidence cannot fill is declined as content and kept as the known risk |
| **8 revise** | writer | post the whole new text, then per note: taken, or declined with why; the text is revised as a whole, never patched sentence by sentence | — | the text replaced; phases 7 and 8 again while rounds remain |
| **9 final check** | every seat but the writer | read the final text once: only what still breaks a rule, a source or natural language, at most 3 notes each, or `clean`; readers: the verdict | reopen the strategy | a blocking note goes back to the writer for one fix; then the final text **locked** in `## The text (final)`, never changed after |

## Rules in every phase

**Altitude**: the auditor holds it in every phase; a sentence below the template's altitude (a
component, a tool, a configuration where the reader is owed what and why) is blocking in polish,
read and final check, and is cut or lifted, never refined. Readers judge whether the text is
credible at that altitude, never ask it to go lower.

**Highlights only**: every sentence carries a strength the sources hold; what they do not hold
is left unsaid, never conceded. No phase asks a seat for lessons, limits or gaps, which invites
them, and a gap analysis given as evidence is background, never content. A concession found in
reading is blocking.

**The order of authority**: truth (the checker), then the person's preferences and feedback,
then the style keeper on voice, then a seat's taste.

## Phase messages

| phase | text |
|---|---|
| research | `judge: read the record, the dossier (your sections) and the evidence; post the table as it now stands, then for the brief: what the ask is really about, the strongest met demands, the misreadings and their framing; ending @swarm, then done research. style: the reader's voice markers, quoted, ending @swarm, then done research. Every other seat: read your dossier sections now, then done research.` |
| strategy | `The brief. strategist: post the whole brief, with the slots and the elected ones, ending @swarm. Every other seat, once it is posted: read the whole phase, answer from your role, ending @strategist, then done strategy. strategist: once all have answered, the settled brief, each point taken or declined, ending @swarm, and only then done strategy.` |
| propose | `The election, step 1. Settled brief #<seq> (elected: <slots>). Every seat but the readers and style: one post, at most one candidate per elected slot, labelled, <from the precedents, the source named, the facts from the evidence \| written fresh from the evidence>, within the slot's limit; ending @swarm, then done propose. Readers and style: done propose now.` |
| vote | `The election, step 2. Candidates: <seat #seq (letter)…>. checker: your vetoes first. Every seat: per slot, approve as many as fit, one line of why each, never your own, also on natural language and pull; ending @orchestrator, then done vote. Readers: as the reader; your approvals count double.` |
| draft | `writer: the whole text from the settled brief #<seq> and the winners <…> fused into one voice, the other slots to the brief; a ledger first; ending @orchestrator, then done draft. Every other seat: done draft now.` |
| polish | `On the whole text (#<seq>) and the orchestrator's notes. auditor drives, at most <n> rounds: one table over every sentence, the notes first; end @checker. checker strikes and proposes, style marks the voice, ending @writer. writer posts the whole next version, ending @auditor. auditor ends polish: done polish, then @swarm polish is over; the others then done. Every other seat: done polish now.` |
| read | `Round <n> on the whole text (#<seq>). Every seat but the writer: at most 5 notes from your role, ending @orchestrator; readers: only that text, notes and the verdict. Then done read. writer: done read now.` |
| revise | `writer: the read and the orchestrator's rulings (#<seq>); the whole new text, revised as a whole, then per note taken or declined; ending @orchestrator, then done revise. Every other seat: done revise now.` |
| final | `Final check on #<seq>. Every seat but the writer: only what still breaks a rule, a source or natural language, at most 3 notes, or clean; readers: the verdict. Then done final. writer: one fix only if a blocking note comes to you; done final now.` |

The seat names are the defaults; a template's renames replace them in every message.

## Your seat, beyond the shared duties

You hold the person's intent from the interview to the delivered text. You never write the text,
propose a candidate or vote. **Listen with `wait` alone**, so every post wakes you: a brief, a
candidate, a draft or a version is steered before the next seat builds on it.

- **Before the run**: in the interview, show each preference on one sentence written two ways,
  so the person chooses on the text, never on a label; when they cannot phrase something (a
  motivation), propose two or three readings drawn from their words and the evidence, and let
  them choose. Restate their answers in the register the text needs: seats imitate the style
  they read. Gather the precedents, chosen for closeness to this text.
- **Quote, never rewrite.** Name the weak or awkward phrase (a calque, a dangling verb, an
  ambiguous pronoun, a participle agreeing with nothing, a vague hinge that promises and does
  not give, a lesson given to the reader), say why, and post it as priority 1 for the round that
  follows, binding on the writer. The writer rewrites; you only name, except in the final
  check's one fix, where you may pass on wordings the seats proposed.
- **Correct the brief before the seats build on it**: a claim the evidence or the feedback
  already struck, a sample that invents a fact, a level of detail the person ruled out.
- **Count the election and break its ties** on the criteria, truth first, the reason posted.
- **Rule on the read** in one post, each note taken or declined with why.
- **Lock the final text** in the record before showing or delivering it; what is shown, recorded
  or delivered is that text, verbatim.

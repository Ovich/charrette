# Protocol: editorial

One text written by one seat, read by seats standing for its real readers, revised on what they
say. Out: the final text, its rounds kept beside it.

**The protocol is the same for any text; the kind of text lives in two inputs the run is given**:
the **template**, the document the seats work on (its skeleton: sections or paragraphs and what
each must do, length, tone, and its **altitude**: the level of detail the reader is owed), and the **manifests**, one per seat (a part every seat reads, a part
for that seat alone: its role, rules, reader persona, evidence). With no template given, the strategist's brief settles the skeleton, length, tone and altitude.

**Board**: the text's own document through the `aiview` skill, a new one for every run (its template and how a phase is written in: `references/editorial-documents.md`), `YYYY-MM-DD-<topic>.report.md`,
its sections in the order of the phases. **Every phase's work is written into it as the phase
closes**, in full, never as a pointer to the thread: the judge's table; the brief, the answers
and the settled brief; every candidate, every vote and the count; the draft; each polish iteration's table,
strikes and whole text; the read notes and the rulings; each revision with its per-note
replies; the final text. The board alone tells the whole run. **It is also the seats' working memory**: every seat reads it in full at the start of each phase and builds on what is there (the judge's table feeds the brief, the brief and the elected candidates feed the draft, the polish record feeds the read). So it holds the work only, never a word about the person.

**Strategy, beyond the shared fields:**

| Field | Content | Recommended |
|---|---|---|
| questions | one row: what the text must do, for whom, its length and tone | from the ask |
| seats | a `judge`, reading the reader's ask against the evidence; a `strategist`, owning the brief; one `writer`, choosing its voice; an `auditor`, weighing every sentence for its effect on the reader and holding the hierarchy (what is core and leads, what supports, what gets one clause, what is cut, **the text running from the core down to the least prominent**) and the altitude; a `checker` holding the sources; readers, each the reader the text is for or one on the way to them, given what that reader knows | judge + strategist + writer + auditor + checker + 1 reader for a persuasive text; for an explaining one, a newcomer who must follow it as the reader. Effort: medium for the strategist, writer and auditor (they write); low for the judge, checker and readers (they read and rule) |
| template | the document skeleton the run fills, binding on the writer; the auditor's hierarchy orders the proofs inside it | from the ask, or the strategist's brief |
| altitude | the level of detail the text stays at: strategic (what, why it matters, what it changed for people; a mechanism only when it is the differentiator, named one level up, never its parts), operational, or technical | from the template |
| manifests | per seat: the shared part and its own (role, rules, persona, evidence), given verbatim | from the project |
| evidence | adds `given`: the files and links handed over with the ask (a brief, a draft, a spec), read and cited, never edited | `given, web` |
| criteria | what the text must achieve and what is ruled out | from the ask |
| election | the slots elected (the parts that make the impression), the rest written by the writer; and where the candidates come from: `precedents`, earlier texts of the same kind the person provides, the source of wording and framing only, never of facts; or `generated`, written by each seat from the strategy | the opening, the turning point and the close; `precedents` whenever the person has earlier texts, else `generated` |
| feedback | the person's reactions to earlier versions of this text or of earlier runs: what they rejected and why, the wordings and claims struck, the preferences they set; read by every seat and by you, kept apart from the evidence | from the person's earlier runs, updated after each |
| iterations | polish iterations on the whole text, at most | 2 |
| rounds | read-and-revise rounds on the whole text | 1 |

| Phase | Who | May | May not | You, after |
|---|---|---|---|---|
| **1 research** | judge | read the reader's context first: the board's given sections when it was researched before the run, else the evidence's `web`, every figure with its source; then post one table: the reader's ask split into its demands, each split into its parts, each part met · partly · gap, the evidence that backs it (where, never more than it says); then what the ask is really about, the strongest met demands in the order they serve the text, and where the text could be misread, with the framing that prevents it (gaps are background, never content) | write the text | the table on the board; the auditor holds the text to the demands marked strongest |
| **2 strategy** | the strategist, then every seat answering it | the strategist posts **the brief** in one post, each point with its recommendation and reason: who reads first and how long they give it, the one thing they keep (one thesis sentence every part must serve), the motivation and its weight, tone and form each shown on one sentence written in that form, **the text's slots** (what each must do, its length, the elected ones marked), each work or point by name (expand · condense · one line · out) with its angle, what is left out, each figure with its source; every other seat answers from its role (the hierarchy and altitude, the auditor; the voice, the writer; what the reader must believe and what would stop them, the readers; what the evidence allows and forbids, the checker; the reader's real ask, the judge); the strategist then posts **the settled brief**, each point taken or declined with why, and only then runs `done` | propose wording beyond a sample; a sample that invents a fact (seats copy samples) | correct the brief before the seats build on it (*You steer the text*); the settled brief on the board |
| **3 propose** (blind) | every seat but the readers | post at most one candidate per elected slot, labelled by slot, within the strategy and its slot's limit: from `precedents`, a passage taken from one of them (its file named) and adapted; from `generated`, written fresh | read the others' candidates first; carry a fact from a precedent that the evidence no longer holds | nothing |
| **4 vote** | every seat | per slot, approve as many candidates as fit the strategy, each approval with one line of why; the checker first vetoes a candidate whose fact the evidence does not hold, naming where; a reader seat's approval counts double | approve its own candidate | post the count: per slot, the most approvals win; a tie goes to the reader seats' choice, then to you on the criteria, truth first; the winners are raw material the writer fuses into one voice, and the checker verifies them again |
| **5 draft** | writer | post the full text, one block, built on the elected winners fused into one voice, the other slots written to the strategy | — | the text on the board |
| **6 polish** | auditor, checker, writer, on the whole text | per iteration: the auditor posts one table covering every sentence of the whole text, paragraph by paragraph: the sentence, what it lacks (scope · outcome · verb · aim), its priority (1 to 3, natural language and the text's pull first), a stronger version, the source that carries it, or `keep` / `cut`; below it, what only the whole shows: every fact said once, no verb or phrase repeated, tenses consistent, each work's room matching its weight, every demand of the judge's table answered, complex sentences made simple, the hierarchy and the altitude kept; a sentence that narrates a process instead of stating a concept or a proof is weak, and the row proposes the concept form; the checker strikes any row that outruns its source and gives the strongest wording the source does hold; the writer posts the whole next version, taking the rows left or saying why not, `unchanged` at once when nothing is left | rework one paragraph in isolation | the whole text replaced on the board, with the table and the strikes; the next iteration, until every row says `keep` or the iterations are spent; the auditor ends polish (`done polish`, then `@swarm polish is over`), and the writer and checker run `done` after it |
| **7 read** | every seat but the writer | per note, at most 5, on the whole text: the line quoted, the reaction as that seat, the change asked; a claim's note names what the source lacks; the auditor's note on a work out of order, or a minor one given more room than a core one, is blocking; the strategist's note says whether the brief is kept | rewrite the text | the notes on the board, the round numbered; your rulings in one post, each note taken or declined with why, the checker winning on truth over impact; a gap the evidence cannot fill is declined as content and kept as the known risk |
| **8 revise** | writer | post the whole new text, then per note: taken, or declined with why; the text is revised as a whole, never patched sentence by sentence | — | the text replaced; phases 7 and 8 again while rounds remain |
| **9 final check** | every seat but the writer | read the final text once: only what still breaks a rule or a source, at most 3 notes each, or `clean` | reopen the strategy | a blocking note goes back to the writer for one fix; the final text on the board |

**Every post that hands work on mentions whoever acts next** (`@writer`, `@checker`…): a seat is woken only by a mention, so a hand-off without one stops the chain.

**Altitude**: the auditor holds it in every phase; a sentence below the template's altitude (a component, a tool, a configuration where the reader is owed what and why) is blocking in polish, read and final check, and is cut or lifted, never refined. Readers judge whether the text is credible at that altitude, never ask it to go lower.

**Highlights only**: every sentence carries a strength the sources hold; what they do not hold is left unsaid, never conceded. No phase asks a seat for lessons, limits or gaps, which invites them, and a gap analysis given as evidence is background, never content. A concession found in reading is blocking.

**Every phase is opened with `phase`, and every seat runs `done <phase>`**, the one named in
*Who* when its part is posted, every other seat at once: the board tells you when all are in. **Open the next phase only after `all done`**, even when the phase asked nothing of most seats.
Register each seat's transcript right after dispatching it (the `swarm` skill's orchestrator
side), so a stalled phase is seen within seconds.

## Your seat: the orchestrator

You are the orchestrator, and in this protocol you also do the facilitator's work: you run the seats and, beyond that, carry the person's intent through the text.

The seats start fresh and know only what they are given; you are the one seat that holds the
person's intent from the first question to the delivered text. You never write the text,
propose a candidate or vote; everything else that keeps the run true to the person is yours.

**Before the run, with the person** (the run itself never waits on them). The interview, the feedback, the manifests and the board each have their template, and how each is created, kept and filled, in `references/editorial-documents.md`: read it before writing any of them.

- **Interview them** (the `interview` skill), the judge's way: their ask split into its demands
  and judged against the evidence; each gap worked with one open question at a time, never
  offering options; then their preferences, each shown on one sentence written two ways, so they
  choose on the text, never on a label. When they cannot phrase something (a motivation), propose
  two or three readings drawn from their words and the evidence, and let them choose.
- **Write the interview as a document every seat reads**, in two layers: their answers and
  preferences bind; your proposals and sample sentences may be overturned and are never copied.
  Their answers are restated in the register the text needs: seats imitate the style they read.
- **A fact they confirm that the evidence lacks** is written into the evidence, within its
  existing fields, only on their yes; the run never edits evidence.
- **Gather the precedents** (their earlier texts of the same kind, chosen for closeness to this
  one) and **the feedback** (what they rejected in earlier runs, and why).
- **Write the manifests, the board with its given inputs, and the briefs**. Each brief adds to the `workshop` skill's: the seat's parts, phase by phase, from the phase table; the thread rule; a folder where it writes its long posts before `post --file`; and that a post failing twice is reported to `@orchestrator` at once, never retried in silence. Then open the run on the
  board of the repository it belongs to, and point any recording at that board and that run.

**During the run:**

- **Open each phase the moment `all done` arrives.** Fix tooling only between phases: the seats
  wait on you, and a still board reads as a stalled one.
- **Read every post as it lands**, not only the `done` events: listen with `wait` without `--mentions`, so every post wakes you; a brief, a candidate, a draft or a
  version is steered before the next seat builds on it. A seat silent past its share, or one that
  ran `done` before its part, is mentioned with what it owes and the posts it has to answer.
- **Steer the text**:
  - **Quote, never rewrite.** Name the weak or awkward phrase (a calque, a dangling verb, an
    ambiguous pronoun, a participle agreeing with nothing, a vague hinge that promises and does
    not give, a lesson given to the reader), say why, and post it as priority 1 for the round
    that follows, binding on the writer. The writer rewrites; you only name, except in the final
    check's one fix, where you may pass on wordings the seats proposed.
  - **Correct the brief before the seats build on it**: a claim the evidence or the feedback
    already struck, a sample that invents a fact, a level of detail the person ruled out.
  - **Hold the order of authority**: truth first (the checker), then the person's feedback and
    preferences, then a seat's taste.
- **Count the election and break its ties** on the criteria, truth first, the reason posted.
- **Rule on the read** in one post, each note taken or declined with why; a gap the evidence
  cannot fill is declined as content and kept as the known risk.
- **Write each phase into the board as it closes**, in full.

**After the run:**

- The final text on the board; the run closed; the person reads it and decides.
- **What they say of it goes into the feedback** for the next run, never only into chat.
- Nothing they keep (a delivered file, a record, a recording) is replaced without their yes; what
  it replaces is kept aside.

**Close** after the final check: the final text on the board.

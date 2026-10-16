# Protocol: editorial

One text written by one seat, read by seats standing for its real readers, revised on what they
say. Out: the final text, its rounds kept beside it.

**The protocol is the same for any text; the kind of text lives in two inputs the run is given**:
the **template**, the document the seats work on (its skeleton: sections or paragraphs and what
each must do, length, tone, and its **altitude**: the level of detail the reader is owed), and the **manifests**, one per seat (a part every seat reads, a part
for that seat alone: its role, rules, reader persona, evidence).

**Board**: the text's own document through the `aiview` skill, `YYYY-MM-DD-<topic>.report.md`,
its sections in the order of the phases. **Every phase's work is written into it as the phase
closes**, in full, never as a pointer to the thread: the research dossier; the strategy answers
and the settled strategy; every angle and the pick; the draft; each polish iteration's table,
strikes and whole text; the read notes and the rulings; each revision with its per-note
replies; the final text. The board alone tells the whole run. **It is also the seats' working memory**: every seat reads it in full at the start of each phase and builds on what is there (the dossier feeds the strategy, the strategy and angles feed the draft, the polish record feeds the read). So it holds the work only, never a word about the person.

**Strategy, beyond the shared fields:**

| Field | Content | Recommended |
|---|---|---|
| questions | one row: what the text must do, for whom, its length and tone | from the ask |
| seats | a `researcher`, doing the homework on the reader and their context; one `writer`, choosing its voice; one `editor`, owning the hierarchy: what is core and leads, what supports, what gets one clause, what is cut, from the sources' own ranking, **the text running from the core down to the least prominent**; an `impact` analyst, weighing every sentence for its effect on the reader and proposing a stronger one the sources still carry; a `checker` holding the sources; readers, each the reader the text is for or one on the way to them, given what that reader knows chosen per template: researcher + writer + editor + impact + checker + 1 to 2 readers for a persuasive text; for an explaining one, a newcomer who must follow it in place of impact |
| template | the document skeleton the run fills, binding on the writer; the editor's hierarchy orders the proofs inside it | from the ask |
| altitude | the level of detail the text stays at: strategic (what, why it matters, what it changed for people; a mechanism only when it is the differentiator, named one level up, never its parts), operational, or technical | from the template |
| manifests | per seat: the shared part and its own (role, rules, persona, evidence), given verbatim | from the project |
| evidence | adds `given`: the files and links handed over with the ask (a brief, a draft, a spec), read and cited, never edited | `given, web` |
| criteria | what the text must achieve and what is ruled out | from the ask |
| iterations | polish iterations on the whole text, at most | 2 |
| rounds | read-and-revise rounds on the whole text | 1 |

| Phase | Who | May | May not | You, after |
|---|---|---|---|---|
| **1 research** | researcher | post one dossier: the reader, their context, the signals in what they wrote, every citable figure with its source | write the text | the dossier on the board |
| **2 strategy** | every seat, answering you | answer your questions: the hierarchy (editor), the voice and structure (writer), what the reader must believe (readers), what the sources allow and forbid (checker), the context to show (researcher) | propose wording | settle the strategy against the criteria, with **one thesis sentence** every paragraph must serve (the editor cuts what does not); post it, write it on the board |
| **3 angles** (blind) | every seat | post one angle within the strategy: the opening, the proofs in order, the close, each proof tied to its source | read the others' angles first, write the text | nothing |
| **4 pick** | — | — | — | pick an angle, or merge, against the strategy; the pick and its reason posted and written under *Angles* |
| **5 draft** | writer | post the full text, one block | — | the text on the board |
| **6 polish** | impact, checker, writer, on the whole text | per iteration: the impact analyst posts one table covering every sentence of the whole text, paragraph by paragraph: the sentence, its impact now (strong · medium · weak) and why, a stronger version, the source that carries it, or `keep` / `cut`; below it, what only the whole shows: every fact said once, no verb or phrase repeated, tenses consistent, each work's room matching its weight, every duty of the reader's brief answered, complex sentences made simple, and any move between paragraphs (the editor rules on those); a sentence that narrates a process instead of stating a concept or a proof is weak, and the row proposes the concept form; the checker strikes any row that outruns its source and gives the strongest wording the source does hold; the writer posts the whole next version, taking the rows left or saying why not, `unchanged` at once when nothing is left | rework one paragraph in isolation | the whole text replaced on the board, with the table and the strikes; the next iteration, until every row says `keep` or the iterations are spent |
| **7 read** | every seat but the writer and the impact analyst | per note, at most 5, on the whole text: the line quoted, the reaction as that seat, the change asked; a claim's note names what the source lacks; the editor's note on a work out of order, or a minor one given more room than a core one, is blocking | rewrite the text | the notes on the board, the round numbered; your rulings where notes conflict, the checker winning on truth over impact |
| **8 revise** | writer | post the whole new text, then per note: taken, or declined with why; the text is revised as a whole, never patched sentence by sentence | — | the text replaced; phases 7 and 8 again while rounds remain |
| **9 final check** | the reader seats and the checker | read the final text once: only what still breaks a rule or a source, at most 3 notes each, or `clean` | reopen the strategy | a blocking note goes back to the writer for one fix; the final text on the board |

**Every post that hands work on mentions whoever acts next** (`@writer`, `@checker`…): a seat is woken only by a mention, so a hand-off without one stops the chain.

**Altitude**: the editor holds it in every phase; a sentence below the template's altitude (a component, a tool, a configuration where the reader is owed what and why) is blocking in polish, whole text and read, and is cut or lifted, never refined. Readers judge whether the text is credible at that altitude, never ask it to go lower.

**Highlights only**: every sentence carries a strength the sources hold; what they do not hold is left unsaid, never conceded. No phase asks a seat for lessons, limits or gaps, which invites them, and a gap analysis given as evidence is background, never content. A concession found in reading is blocking.

**Every phase is opened with `phase`, and every seat runs `done <phase>`**, the one named in
*Who* when its part is posted, every other seat at once: the board tells you when all are in. **Open the next phase only after `all done`**, even when the phase asked nothing of most seats.
Register each seat's transcript right after dispatching it (the `swarm` skill's orchestrator
side), so a stalled phase is seen within seconds.

**Close** when the last round's revision is posted: the final text on the board.

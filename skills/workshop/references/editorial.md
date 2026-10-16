# Protocol: editorial

One text written by one seat, read by seats standing for its real readers, revised on what they
say. Out: the final text, its rounds kept beside it.

**Board**: the text's own document through the `aiview` skill, `YYYY-MM-DD-<topic>.report.md`,
its sections in the order of the phases: the human part, the strategy fields, **Research**,
**Strategy settled**, **Angles**, **The text** (the current version), **Polish** (per paragraph, per iteration), **Reader notes** (per
round), **Log** (each phase's posts verbatim, with their `#<seq>`). Swarm kind `brainstorm`.

**Strategy, beyond the shared fields:**

| Field | Content | Recommended |
|---|---|---|
| questions | one row: what the text must do, for whom, its length and tone | from the ask |
| seats | a `researcher`, doing the homework on the reader and their context; one `writer`, choosing its voice; one `editor`, owning the hierarchy: what is core and leads, what supports, what gets one clause, what is cut, from the sources' own ranking, **the text running from the core down to the least prominent**; an `impact` analyst, weighing every sentence for its effect on the reader and proposing a stronger one the sources still carry; a `checker` holding the sources; readers, each the reader the text is for or one on the way to them, given what that reader knows | researcher + writer + editor + impact + checker + 1 to 2 readers |
| rules | the writing rules and reader personas the project already has, given verbatim: a part to every seat, a part to one | from the project |
| evidence | adds `given`: the files and links handed over with the ask (a CV, a posting), read and cited, never edited | `given, web` |
| criteria | what the text must achieve and what is ruled out | from the ask |
| structure | the paragraph plan, when the ask dictates one: binding on the writer; the editor's hierarchy orders the proofs inside it | from the ask, else the writer's |
| iterations | polish iterations per paragraph, at most | 3 |
| rounds | read-and-revise rounds on the whole text | 1 |

| Phase | Who | May | May not | You, after |
|---|---|---|---|---|
| **1 research** | researcher | post one dossier: the reader, their context, the signals in what they wrote, every citable figure with its source | write the text | the dossier on the board |
| **2 strategy** | every seat, answering you | answer your questions: the hierarchy (editor), the voice and structure (writer), what the reader must believe (readers), what the sources allow and forbid (checker), the context to show (researcher) | propose wording | settle the strategy against the criteria, post it, write it on the board |
| **3 angles** (blind) | every seat | post one angle within the strategy: the opening, the proofs in order, the close, each proof tied to its source | read the others' angles first, write the text | nothing |
| **4 pick** | — | — | — | pick an angle, or merge, against the strategy; the pick and its reason posted and written under *Angles* |
| **5 draft** | writer | post the full text, one block | — | the text on the board |
| **6 polish** | impact, checker, writer, one paragraph at a time from the first | per iteration: the impact analyst posts the paragraph's table, one row per sentence: the sentence, its impact now (strong · medium · weak) and why, a stronger version, the source that carries it, or `keep` / `cut`, and below the table the sentence order it proposes (reorder, merge, split); a move to another paragraph is proposed to the editor, who rules; the checker strikes any row that outruns its source; the writer posts the paragraph's next version, keeping its voice, taking the rows left or saying why not | touch another paragraph | the paragraph replaced on the board; the next iteration, until every row says `keep` or the iterations are spent, then the next paragraph |
| **7 read** | every seat but the writer and the impact analyst | per note, at most 5, on the whole text: the line quoted, the reaction as that seat, the change asked; a claim's note names what the source lacks; the editor's note on a work out of order, or a minor one given more room than a core one, is blocking | rewrite the text | the notes on the board, the round numbered; your rulings where notes conflict, the checker winning on truth over impact |
| **8 revise** | writer | post the new text, then per note: taken, or declined with why | — | the text replaced; phases 7 and 8 again while rounds remain |

**Highlights only**: every sentence carries a strength the sources hold; what they do not hold is left unsaid, never conceded. No phase asks a seat for lessons, limits or gaps, which invites them, and a gap analysis given as evidence is background, never content. A concession found in reading is blocking.

**Every phase is opened with `phase`, and every seat runs `done <phase>`**, the one named in
*Who* when its part is posted, every other seat at once: the board tells you when all are in.
Register each seat's transcript right after dispatching it (the `swarm` skill's orchestrator
side), so a stalled phase is seen within seconds.

**Close** when the last round's revision is posted: the final text on the board.

# Protocol: editorial

One text written by one seat, read by seats standing for its real readers, revised on what they
say. Out: the final text, its rounds kept beside it.

**The protocol is the same for any text; the kind of text lives in two inputs the run is given**:
the **template**, the document the seats work on (its skeleton: sections or paragraphs and what
each must do, length, tone, and its **altitude**: the level of detail the reader is owed), and the **manifests**, one per seat (a part every seat reads, a part
for that seat alone: its role, rules, reader persona, evidence).

**Board**: the text's own document through the `aiview` skill, `YYYY-MM-DD-<topic>.report.md`,
its sections in the order of the phases: the human part, the strategy fields, **Research**,
**Strategy settled**, **Angles**, **The text** (the current version), **Polish** (per paragraph, per iteration), **Whole text**, **Reader notes** (per
round), **Log** (each phase's posts verbatim, with their `#<seq>`). Swarm kind `brainstorm`.

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
| iterations | polish iterations per paragraph, at most | 3 |
| rounds | read-and-revise rounds on the whole text | 1 |

| Phase | Who | May | May not | You, after |
|---|---|---|---|---|
| **1 research** | researcher | post one dossier: the reader, their context, the signals in what they wrote, every citable figure with its source | write the text | the dossier on the board |
| **2 strategy** | every seat, answering you | answer your questions: the hierarchy (editor), the voice and structure (writer), what the reader must believe (readers), what the sources allow and forbid (checker), the context to show (researcher) | propose wording | settle the strategy against the criteria, post it, write it on the board |
| **3 angles** (blind) | every seat | post one angle within the strategy: the opening, the proofs in order, the close, each proof tied to its source | read the others' angles first, write the text | nothing |
| **4 pick** | — | — | — | pick an angle, or merge, against the strategy; the pick and its reason posted and written under *Angles* |
| **5 draft** | writer | post the full text, one block | — | the text on the board |
| **6 polish** | impact, checker, writer, one paragraph at a time from the first | per iteration: the impact analyst posts the paragraph's table, one row per sentence: the sentence, its impact now (strong · medium · weak) and why, a stronger version, the source that carries it, or `keep` / `cut`, and below the table the sentence order it proposes (reorder, merge, split); a move to another paragraph is proposed to the editor, who rules; the checker strikes any row that outruns its source; the writer posts the paragraph's next version, keeping its voice, taking the rows left or saying why not; when no row is left to take it posts `P<n> unchanged` and hands back at once, never silence | touch another paragraph | the paragraph replaced on the board; the next iteration, until every row says `keep` or the iterations are spent, then the next paragraph |
| **7 whole text** | impact and editor, together, on the assembled text | one post each on what no paragraph shows: every fact said once, no verb or phrase repeated, tenses consistent, each work's room matching its weight, every duty of the reader's brief answered, and every complex sentence made simpler to read (one claim, plain words, jargon glossed or cut); the writer then posts the assembled text with them applied | add a fact | the assembled text on the board |
| **8 read** | every seat but the writer and the impact analyst | per note, at most 5, on the whole text: the line quoted, the reaction as that seat, the change asked; a claim's note names what the source lacks; the editor's note on a work out of order, or a minor one given more room than a core one, is blocking | rewrite the text | the notes on the board, the round numbered; your rulings where notes conflict, the checker winning on truth over impact |
| **9 revise** | writer | post the new text, then per note: taken, or declined with why | — | the text replaced; phases 8 and 9 again while rounds remain |

**Every post that hands work on mentions whoever acts next** (`@writer`, `@checker`…): a seat is woken only by a mention, so a hand-off without one stops the chain.

**Altitude**: the editor holds it in every phase; a sentence below the template's altitude (a component, a tool, a configuration where the reader is owed what and why) is blocking in polish, whole text and read, and is cut or lifted, never refined. Readers judge whether the text is credible at that altitude, never ask it to go lower.

**Highlights only**: every sentence carries a strength the sources hold; what they do not hold is left unsaid, never conceded. No phase asks a seat for lessons, limits or gaps, which invites them, and a gap analysis given as evidence is background, never content. A concession found in reading is blocking.

**Every phase is opened with `phase`, and every seat runs `done <phase>`**, the one named in
*Who* when its part is posted, every other seat at once: the board tells you when all are in. **Open the next phase only after `all done`**, even when the phase asked nothing of most seats.
Register each seat's transcript right after dispatching it (the `swarm` skill's orchestrator
side), so a stalled phase is seen within seconds.

**Close** when the last round's revision is posted: the final text on the board.

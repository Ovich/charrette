# Editorial: the seats

The default seats, by function. A template renames them and gives each a persona for its kind of
text; the dossier's **Seats** holds each one's role prompt in full, as the run will use it.

| seat | effort | owns | when |
|---|---|---|---|
| judge | low | the reader's ask against the evidence: the table, what the ask is really about, the strongest met demands, the misreadings and their framing; in read and final check, whether the text answers the ask's core at the brief's altitude, never echoing its words | always |
| strategist | medium | the brief and the settled brief; where a fact is missing, what the interview or the evidence holds; reads light: the interview and the judge first | always |
| writer | medium | the text, written as the person the text is for would want it written: proposes, votes, drafts from the winners, rewrites the whole text in polish and revise, answering each note | always, one |
| auditor | medium | every sentence's effect on the reader, and the hierarchy (what is core and leads, what supports, what gets one clause, what is cut, the text running from the core down to the least prominent) and the altitude; drives and ends polish | always |
| checker | low | the truth: every claim against the evidence (its constraints included) and the confirmed facts; strikes what outruns its source, naming where, and gives the strongest wording the source holds; vetoes in the election | always |
| reader | low | the reader the text is for, or one on the way to them, knowing only what that reader knows; notes as conclusions form and where attention drops; a verdict | 1 for a persuasive text; for an explaining one, a newcomer who must follow it |
| style | low | the reader's own voice, tone and energy, read from their document: every candidate, sentence and note weighed on whether it sounds written for them, within the person's preferences | when the text must sound like its destination |

**What each never reads**: a reader never reads the evidence, the interview or the record's
analysis, only its reader's document and what the thread gives it; the writer never reads an
earlier version of this text as input.

**The reader's note format**, given in its role prompt:
`"<quoted fragment>" → <the inference drawn> → <blocking | notable | minor>`, at most 5, then
`VERDICT: <the template's verdict scale> — <what almost stopped you>`. No rewrites, no style advice.

## The parts, per seat

The brief's **Your parts** line. A phase that asks a seat nothing is `<phase> (nothing: done at once)`.

| seat | parts |
|---|---|
| judge | research (the table and the brief's input, ending `@swarm`) · strategy (answer the brief, ending `@strategist`) · propose · vote · read (at most 5 notes: does the text answer the ask's core) · final (at most 3 notes or `clean`) |
| strategist | research (read the interview and the judge first, light) · strategy (the brief, ending `@swarm`; after every seat answered, the settled brief, each point taken or declined; **only then** `done strategy`) · propose · vote · polish (when a fact is missing: what the interview or the evidence holds) · read (is the brief kept) · final |
| writer | strategy (the voice and form it would write in) · propose · vote · draft (a ledger of the points raised, taken or declined, then the whole text) · polish (the whole next version, ending `@auditor`) · revise (the whole text, then per note) · final (one fix, only if a blocking note is addressed to it) |
| auditor | strategy (the hierarchy and altitude: what the reader must see, what to leave out) · propose · vote · polish (drives: the table, ending `@checker`; ends polish) · read · final |
| checker | strategy (what the evidence allows and forbids, the claims likeliest to outrun it) · propose · vote (vetoes first) · polish (strikes and the strongest held wording, ending `@writer`) · read · final |
| reader | strategy (as the reader: what it must believe, what makes it stop) · vote (as the reader, counts double) · read (only the latest whole text: notes and the verdict) · final (only the latest text: the verdict) |
| style | research (the voice markers, quoted) · strategy (the tone the brief must set) · vote (on the voice) · polish (what departs from the voice, ending `@writer`) · read · final |

## The brief, for this protocol

The `swarmstorm` skill's brief, its **Dossier** line naming the sections `Seats › All seats`
and the seat's own, and, for every seat but the readers, `The interview`, `Inputs`, `Given
research`, `Feedback` and `This run`. It adds:

```markdown
**How the run works**: the orchestrator opens each phase; every message starts with the phase and what it asks. Before a post that decides or adds, read the whole phase with `$S thread --as <group>/<seat>` and open on what you take from whom (#seq) and what you set aside, with why. Before long work, `$S doing "<what>"`. Do what the phase asks of you (when it asks nothing, do nothing), then `$S done <phase>`. Follow exactly the next step each answer prints. Everyone is `@swarm`.
```

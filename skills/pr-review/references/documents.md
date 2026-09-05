# The two documents

The report makes claims; the analysis holds the evidence. Sections in reading order,
and the report's register.

## The report

Sections, in reading order. If it does not fit on a screen you have not finished
understanding the change; the cure is a sharper Abstract, not a smaller font.

1. **Abstract**: two to four sentences, in plain language a non-reader of the diff
   understands: the feature or fix in product terms, roughly how it is achieved, and
   the one thing the reviewer should look at. Your own synthesis, not the author's
   claims. No file names.
2. **What changed**: short prose and the orientation diagram. **Essence, not
   inventory**: the reader wants the shape of the change, and the file list is in the
   analysis. Say what is incidental too: churn that inflates a diff without meaning
   anything is worth one sentence, so the reviewer stops looking for meaning in it.
3. **What you have to decide**: one line per open decision, the question and what
   the diff currently chooses. The trade-offs and alternatives live in the analysis.
   This section is the skill's whole thesis, so it is never the one you cut.
4. **Verdict**: **one line per layer**: `L<n> <name>: <worst issue | clean | not run
  , reason>`, then the open-decision count, and what this review did **not** cover;
   correctness gets its line whether or not anything ran it. A reader takes silence
   for coverage.
5. **Proposed comment**: the whole review condensed into a PR comment the reviewer can
   post as-is *if they agree*. In a fenced markdown block, so it copy-pastes raw.
   Contents: the recommendation on the first line (**Approve** / **Approve with
   comments** / **Request changes**), then at most ~150 words: what the change does
   (one sentence), the must-address items, the open questions, genuine appreciation
   where earned. Rules: written in the PR's own language (title/description/commits set
   it); every claim traceable to a section above (the comment introduces nothing new);
   questions phrased as questions, not verdicts; **it says which layers ran**, so an
   Approve cannot imply coverage that never happened.
   Recommendation mapping: blocking finding on any layer **or in any linked report**
   → Request changes; nothing blocking but open decisions or non-blocking findings →
   Approve with comments; clean on every layer that ran, with no open decisions →
   Approve.

**Voice.** Fred Brooks's register:

- **Separate essence from accident.** Brooks's central move, and it fits review
  exactly: the difficulty inherent in what the change is doing, versus the difficulty
  our tools and habits pile on top. A re-encoded fixture, a formatter sweep, a rename , 
  accident. Say which is which and the reviewer's attention goes to the right half.
- **Ask whether the change preserves conceptual integrity**: does it fit the model the
  system already has, or does it add a second way of doing something? A claim of parity
  with an existing pattern is checkable, and worth checking.
- **One idea per sentence, and short sentences.** Then elaborate if it earns it.
- **Name the risk so it can be argued about.** A named thing gets discussed; an
  unnamed one gets nodded past.
- **Be candid, including about yourself**: what you did not check, what you could not
  verify, where you were wrong earlier. Brooks is trusted because he owns the misses.
- **No adjectives doing an argument's work.** "Risky" is not a finding; the failure
  scenario is.

## The analysis

Everything that earns a claim in the report, and nothing aimed at persuading anyone.
Sections, in reading order:

1. **Provenance**: refs compared, merge-base, commit count, file count, evidence base,
   and anything the environment could not reach.
2. **Intent**: what the PR claims, from its description, linked issue and commit
   messages, and when a spec was named, one line per user story: met, partial or not
   met, with the evidence. Quote, do not paraphrase. No stated intent → say "no stated intent", never
   infer one and present it as theirs.
3. **What actually changed**: prose per area (not per file), sized to the change; a
   files-touched table when it adds orientation. **And the triage record**: which
   layers ran, which did not, and why: the dispatch decision is evidence too.
4. **Diagrams** that support a specific finding (§ Diagrams).
5. **Layer returns**: one section per dispatched layer, attribution-stamped, holding
   that layer's verified evidence; a skipped layer's slot holds the one-line skip and
   its reason. This is where a later reader checks what a layer actually said, before
   the merge shaped it.
6. **Decision points**: each stated as the trade-off, what the diff currently chooses,
   and the alternative. Scope creep beyond the stated intent lands here, as do
   irreversible choices (schema migrations, API contract changes, dropped
   compatibility). Each one traces to the diff or to a repo doc: this section carries no
   citations, so it is the easiest place for the session's own opinion to enter
   unchallenged.
7. **Findings**, merged across layers, each tagged with its source layer and grouped
   so the reader can tell at a glance what this PR introduced from what it merely
   stands next to: *introduced by this PR*, *pre-existing* (noted, never counted
   against the change), and *checked and clear*: the claims that were raised and did
   not survive verification, with the reason. That last group is what stops a reviewer
   re-raising settled ground, and it is why the analysis is worth keeping after the
   merge.

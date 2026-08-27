---
name: pr-review
description: Use when reviewing a pull request, branch, or diff in any language: to produce a PR analysis the author's reviewer can decide from: what changed, why, how the structure moved (drawn), what it can break, and the decisions only a human can make. Describes and maps the change first; findings second. Not a bug hunt (the harness's own review does that) and not framework-specific review.
---

# PR review

A reviewer's real job is a set of decisions: merge or not, which risks to accept,
which questions to send back. Most review tools emit findings and leave the deciding
context in the reviewer's head. This skill produces the context: a **PR analysis
document** that describes the change, draws how the structure moved, names the blast
radius, and lists the decision points, then attaches findings, each citing its
source. Stack-agnostic: it reads diffs and repo docs, not framework knowledge.

## Scope (explicit, refused when broken)

- `/pr-review <PR#>` → `gh pr diff` / `gh pr view` (description, linked issues, comments).
- `/pr-review <branch|ref>` → three-dot diff from the merge-base: `git diff <ref>...HEAD`.
- `/pr-review` with neither → ask for the fixed point rather than guessing.

Check the ref resolves and the diff is non-empty **before** doing anything else.
Three-dot from the merge-base means uncommitted work is invisible: say so if the
working tree is dirty. Skip vendored, generated, build, and lockfile paths.

**Resolve the diff and the search base to the same revision.** Reviewing by PR number
needs no checkout, so the working tree stays on whatever branch it was on, and every
blast-radius search then runs against code that does not contain the PR: cited
`file:line`, confidently wrong. Check out the PR's head, or say plainly that the blast
radius was not repo-verified.

**Then read the repo's own conventions, before the axes run**: `AGENTS.md`, `CLAUDE.md`,
architecture docs, and `project-conventions` (`../project-conventions/SKILL.md` in this
collection) where its rules apply. This is what the stack-agnostic claim rests on. It
separates *violates a house rule* (a finding) from *unusual but unruled* (a decision
point), and it is usually how you learn that a consumer of this change lives in another
repository entirely.

## Two documents, two readers

A review produces two files, in the data home (ask the `aiview` skill for the path;
never in the repo under review), both registered through the `aiview` skill
(`../../tools/aiview/SKILL.md` in this collection) and both joined to the **same
group** (`pr-<id>`), so they sit together in the sidebar. Each links the other.

| | `YYYY-MM-DD-pr-<id>.pr-report.md` | `YYYY-MM-DD-pr-<id>.pr-analysis.md` |
|---|---|---|
| Reader | the human deciding whether to merge | the next agent — and the human asking *"why does it say that?"* |
| Life | read once, now | consulted on demand, and by whoever picks this up later |
| Size | fits on one screen before the comment block | as long as the evidence needs |
| Holds | the conclusions | what earns them |

**The report makes claims; the analysis holds the evidence.** Every claim in the report
traces to a section of the analysis, and nothing appears in the report the analysis does
not support — the same rule the proposed comment already obeys toward its own document,
applied one level up. Tell the user the **report's** URL; they reach the analysis from
the group, or from the link.

Write both from the start. The report's Abstract, What changed and diagram are
knowable before any axis returns, so publish them immediately and carry one
`aiview pending` card per running axis on the report — that is the document the
developer has open while they wait. The cards sit above the content and vanish as each
axis lands, replaced by the section it produced.

**Stamp what an agent produced.** A section written from a subagent's return carries a
one-line attribution under its heading, naming the axis and what you did to its output
before believing it:

> *From the blast-radius axis. Merged, deduplicated, and every citation re-read before
> inclusion.*

Two reasons, and the second is the one that bites. It tells a later reader which prose
is your own synthesis and which came from an unattended worker — the card that
announced it is gone by then, and nothing else records it. And it forces you to state
the treatment, which is the difference between *an agent said this* and *I checked
this*: an axis in this very skill has raised a confident, well-argued finding that a
second axis then refuted. Attribution is provenance, never endorsement. Sections you
wrote yourself carry no stamp; absence is the default and means exactly that.

### The report

Sections, in reading order. If it does not fit on a screen you have not finished
understanding the change; the cure is a sharper Abstract, not a smaller font.

1. **Abstract**: two to four sentences, in plain language a non-reader of the diff
   understands: the feature or fix in product terms, roughly how it is achieved, and
   the one thing the reviewer should look at. Your own synthesis, not the author's
   claims. No file names.
2. **What changed**: short prose and the orientation diagram. **Essence, not
   inventory** — the reader wants the shape of the change, and the file list is in the
   analysis. Say what is incidental too: churn that inflates a diff without meaning
   anything is worth one sentence, so the reviewer stops looking for meaning in it.
3. **What you have to decide**: one line per open decision — the question, and what
   the diff currently chooses. The trade-offs and alternatives live in the analysis.
   This section is the skill's whole thesis, so it is never the one you cut.
4. **Verdict**: one line per axis (worst issue), the open-decision count, and what this
   review did **not** cover. A reader takes silence for coverage.
5. **Proposed comment**: the whole review condensed into a PR comment the reviewer can
   post as-is *if they agree*. In a fenced markdown block, so it copy-pastes raw.
   Contents: the recommendation on the first line (**Approve** / **Approve with
   comments** / **Request changes**), then at most ~150 words: what the change does
   (one sentence), the must-address items, the open questions, genuine appreciation
   where earned. Rules: written in the PR's own language (title/description/commits set
   it); every claim traceable to a section above (the comment introduces nothing new);
   questions phrased as questions, not verdicts.
   Recommendation mapping: blocking finding on either axis **or in any linked report**
   → Request changes; nothing blocking but open decisions or non-blocking findings →
   Approve with comments; clean on every axis that ran, with no open decisions →
   Approve. The comment says which axes ran, so an Approve cannot imply coverage that
   never happened.

**Voice.** Write it with the `technical-writing` skill
(`../technical-writing/SKILL.md` in this collection), in **Fred Brooks's register**:

- **Separate essence from accident.** Brooks's central move, and it fits review
  exactly: the difficulty inherent in what the change is doing, versus the difficulty
  our tools and habits pile on top. A re-encoded fixture, a formatter sweep, a rename —
  accident. Say which is which and the reviewer's attention goes to the right half.
- **Ask whether the change preserves conceptual integrity**: does it fit the model the
  system already has, or does it add a second way of doing something? A claim of parity
  with an existing pattern is checkable, and worth checking.
- **One idea per sentence, and short sentences.** Then elaborate if it earns it.
- **Name the risk so it can be argued about.** A named thing gets discussed; an
  unnamed one gets nodded past.
- **Be candid, including about yourself** — what you did not check, what you could not
  verify, where you were wrong earlier. Brooks is trusted because he owns the misses.
- **No adjectives doing an argument's work.** "Risky" is not a finding; the failure
  scenario is.

### The analysis

Everything that earns a claim in the report, and nothing aimed at persuading anyone.
Sections, in reading order:

1. **Provenance**: refs compared, merge-base, commit count, file count, evidence base,
   and anything the environment could not reach.
2. **Intent**: what the PR claims, from its description, linked issue and commit
   messages. Quote, do not paraphrase. No stated intent → say "no stated intent", never
   infer one and present it as theirs.
3. **What actually changed**: prose per area (not per file), sized to the change. A
   files-touched table when it adds orientation.
4. **Diagrams** that support a specific finding (§ Diagrams).
5. **Blast radius**: what depends on the changed surface: callers of changed
   signatures, consumers of changed contracts/schemas/events, configs and migrations
   that must accompany the change, behavior changes observable by users. Those are
   places to look; the test is what makes them findings. For each dependent found, ask
   *does it still work, unchanged, once this merges?* Report the ones where the answer
   is **no**, and the ones where it **cannot be established** — an unverifiable
   dependent is a finding, not a pass. Whether a behavior change is a fix or a
   regression is not this section's call: surface it, and let Decision points hold it.
   Verified by searching the code, not assumed from the diff — and **the search does
   not stop at the repo under review**: the consumer in another repo or another service
   is the one the diff can never show you.
   Then ask what the system **already does about it**. A change that looks destructive
   is often repaired by something that re-runs: a full rebuild, a scheduled job, a
   retry, a reconciliation pass. Read the recovery path before pricing the damage. What
   survives is the case that path misses — the persistent failure rather than the
   transient one, the window before it next runs, the state nothing re-derives.
6. **Decision points**: each stated as the trade-off, what the diff currently chooses,
   and the alternative. Scope creep beyond the stated intent lands here, as do
   irreversible choices (schema migrations, API contract changes, dropped
   compatibility). Each one traces to the diff or to a repo doc: this section carries no
   citations, so it is the easiest place for the session's own opinion to enter
   unchallenged.
7. **Findings** (§ Findings), grouped so the reader can tell at a glance what this PR
   introduced from what it merely stands next to: *introduced by this PR*,
   *pre-existing* (noted, never counted against the change), and *checked and clear* —
   the claims that were raised and did not survive verification, with the reason. That
   last group is what stops a reviewer re-raising settled ground, and it is why the
   analysis is worth keeping after the merge.

## Diagrams

Diagrams: use the `write-diagrams` skill (`../write-diagrams/SKILL.md` in
this collection): pick from its catalog by the reviewer's question, follow its
discipline. PR-specific guidance: draw the **delta**, not the whole system:

- **Change map** (almost always): the components the PR touches and their edges:
  new edges and nodes marked, removed ones dashed. A reviewer orients on this in
  seconds; the diff alone never shows it.
- **Behavior change**: when the PR changes an ordering (a flow, a handshake, a
  retry), a sequence diagram of the *new* behavior, failure branches included;
  before/after as two small diagrams only when the contrast is the point.
- **Schema change**: ER diagram of the touched entities, changed
  relations marked.
- **Lifecycle change**: state machine when the PR adds or removes legal states.

**Which document gets which.** The **change map is the report's** — it is the fastest
orientation a reviewer will get, and it belongs where they are looking. Every other
diagram supports a specific finding and belongs in the **analysis**, next to what it
explains. A diagram in the report must earn a screen it is competing for.

One diagram per question a reviewer would actually ask; a big PR usually earns 2–3
across both documents, a small one often only the change map, and a trivial one none
(then say so).

## Findings

Write the document first and publish it while the axes run: the reader gets the
change described and drawn without waiting. Add one `aiview pending` card per axis as
you dispatch it, and close it when its findings land — a document that is deliberately
incomplete has to say so, and say what is still coming.

Two axes, run as **independent fresh-context subagents**: each gets only the diff,
its brief, and the output contract; no conversation history, no opinion of the
change inherited from this session, and the explicit instruction: *"Do not invoke
skills or spawn agents: review directly."*

- **Intent axis**: does the diff do what the PR says? Missing or partial pieces,
  scope creep, requirements implemented differently than stated. Every finding
  quotes the intent line it checks against. No stated intent → this axis reports
  only scope observations, flagged as such.
- **Blast-radius axis**: what breaks around the change: call sites not updated,
  contracts changed without their consumers, migrations without rollback, config
  the deploy needs. Every finding cites the file:line of the evidence, both sides.

**Separate what this PR introduces from what it inherits.** A defect that predates the
branch is noted, attributed as pre-existing, and told to the author — it is never a
reason to withhold approval, and it never feeds the recommendation. Holding a PR
hostage to the state of the code it landed in is how review stops being useful. Say
which it is for every finding: the diff answers it, and *"this PR does not create the
exposure, it increases it"* is a third, honest answer that belongs in Decision points.

An axis reports **evidence and consequence, never severity**: ranking needs the whole
picture, and an axis has only its own. Expect one axis to raise what another refutes —
that is the design working, and the refutation is worth as much as the finding.

Then merge: dedup, rank by cost, drop anything the project's own linter/CI already
flags. **Blast radius (§5) is written from the blast-radius axis's return**; where the
axis cites evidence and the section disagrees, the citation wins. Findings are
hypotheses until the citation is read — re-verify the ones that carry the verdict
yourself, because a well-argued wrong finding reaches the author in your name.

For deeper axes, chain the siblings instead of duplicating them: design cost →
`code-design-review` (`../code-design-review/SKILL.md` in this collection); React
quality → `frontend-review` (`../../react/frontend-review/SKILL.md`), only on a project
it declares support for; bug hunt → the harness's own review. Link their reports from
the analysis document rather than inlining.

**Chaining is a decision, and the document records it either way** — *"Chained:
code-design-review (link). frontend-review not run: no frontend in the diff.
Correctness: not covered."* Left implicit, the default is silently *none*, and a review
that never looked at design or correctness reads exactly like one that looked and found
nothing.

## Red flags

| Thought | Reality |
|---|---|
| "I'll infer the intent from the code" | Then the Intent axis checks the code against itself. No stated intent → say so. |
| "One overall score for the PR" | A blended verdict hides the failing axis. Per-axis worst issue + open decisions. |
| "The diff shows what changed" | The diff shows lines. The change map and blast radius are what the reviewer lacks. |
| "I reviewed it in the session that wrote it" | That's confirmation bias with a slash command. Fresh context, or at least fresh subagents. |
| "More findings = better review" | The deliverable is decisions the human can make. Ten cited findings beat forty hunches. |
| "The code around it is a mess too" | Not this PR's bill. Note it, attribute it, approve anyway. |
| "Unverifiable from here, so it blocks" | Ask the author. A question they can answer in one line is not a change request. |
| "Diagram every touched file" | Draw the delta that answers a reviewer's question; a trivial PR earns zero diagrams. |
| "The proposed comment is the deliverable" | The report is. The comment is its condensate, and the analysis is what earns them both. |
| "I'll put it in the report to be safe" | The report is a screen competing for a busy human's attention. Everything else goes in the analysis, one click away. |
| "The report can just summarise the analysis" | A summary of evidence is still evidence. The report answers *what should I do*; the analysis answers *how do you know*. |
| "The recommendation decides the merge" | It drafts the reviewer's words. They post it only if they agree: the decision stays theirs. |
| "The axes came back clean" | Clean on the axes that ran. Name the ones that didn't, in the verdict and in the comment. |
| "The siblings didn't seem necessary" | Then say so in the document, with the reason. An unrecorded skip is indistinguishable from a check that passed. |
| "The subagent marked it non-blocking" | An axis sees its own lane. Severity is yours, at merge, with every axis in view. |
| "The dependents are all in this repo" | You know that only if you looked elsewhere. The repo docs say where the consumers live. |

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

## The analysis document (the deliverable)

Write `YYYY-MM-DD-pr-<id>.pr-analysis.md` in the data home (ask the `aiview` skill
for the path; never in the repo under review) and open it via the `aiview` skill
(`../../tools/aiview/SKILL.md` in this collection): kind `pr-analysis` (from the
filename), tags = project + the feature; if the work has a board/spec group, join it.
Tell the user the URL. Sections, in reading order:

1. **Abstract**: two to four sentences, before everything: what this PR is about,
   in plain language a non-reader of the diff understands: the feature or fix in
   product terms, roughly how it's achieved, and the one thing a reviewer will want
   to look at. The analyst's own synthesis (the Intent section below quotes the
   author's claims; this doesn't). No file names, no jargon the PR title doesn't
   already use.
2. **Intent**: what the PR claims to do, from its description, linked issue, and
   commit messages. Quote, don't paraphrase. No stated intent → say "no stated
   intent", never infer one and present it as theirs.
3. **What actually changed**: a prose summary per area (not per file), sized to the
   change. Files-touched table only when it adds orientation.
4. **The change, drawn** (§ Diagrams): how the structure moved.
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
6. **Decision points**: the questions only the reviewing human can answer, each
   stated as: the trade-off, what the diff currently chooses, and the alternative.
   Scope creep beyond the stated intent lands here, as do irreversible choices
   (schema migrations, API contract changes, dropped compatibility). Each one traces to
   the diff or to a repo doc: this section carries no citations, so it is the easiest
   place for the session's own opinion of the change to enter unchallenged.
7. **Findings** (§ Findings): per axis, each with its citation.
8. **Verdict**: one line per axis (worst issue), plus the open decision count, plus a
   line naming **what this review did not cover** — the sibling axes not chained, and
   correctness if no bug hunt ran. A reader takes silence for coverage.
   Never a single merged score: a change can be built right and be the wrong thing,
   and a blended verdict lets the passing axis hide the failing one. State how much
   intent evidence the Intent axis had to work with (full description + ticket, or
   one commit line).
9. **Proposed comment**: the whole review condensed into a PR comment the reviewer
   can post as-is *if they agree*. In a fenced markdown block, so it copy-pastes
   raw. Contents: the recommendation on the first line (**Approve** /
   **Approve with comments** / **Request changes**), then at most ~150 words: what
   the change does (one sentence), the must-address items, the open questions,
   genuine appreciation where earned. Rules: written in the PR's own language
   (title/description/commits set it); every claim traceable to a section above
   (the comment introduces nothing new); questions phrased as questions, not verdicts.
   Recommendation mapping: blocking finding on either axis **or in any linked report**
   → Request changes; nothing blocking but open decisions or non-blocking findings →
   Approve with comments; clean on every axis that ran, with no open decisions →
   Approve. The comment says which axes ran, so an Approve cannot imply coverage that
   never happened.

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

One diagram per question a reviewer would actually ask; a big PR usually earns 2–3,
a small one often only the change map, and a trivial one none (then say so).

## Findings

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
| "Diagram every touched file" | Draw the delta that answers a reviewer's question; a trivial PR earns zero diagrams. |
| "The proposed comment is the deliverable" | The analysis is. The comment is its condensate: nothing appears there that isn't in a section above. |
| "The recommendation decides the merge" | It drafts the reviewer's words. They post it only if they agree: the decision stays theirs. |
| "The axes came back clean" | Clean on the axes that ran. Name the ones that didn't, in the verdict and in the comment. |
| "The siblings didn't seem necessary" | Then say so in the document, with the reason. An unrecorded skip is indistinguishable from a check that passed. |
| "The subagent marked it non-blocking" | An axis sees its own lane. Severity is yours, at merge, with every axis in view. |
| "The dependents are all in this repo" | You know that only if you looked elsewhere. The repo docs say where the consumers live. |

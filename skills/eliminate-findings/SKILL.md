---
name: eliminate-findings
description: Use when the same remark keeps being made in a repository's pull request reviews, or when someone asks what the reviews keep catching and how to stop catching it. Groups the comment history into recurring findings and decides, for each, the rung that removes it: a design that makes it impossible, a lint or type rule, a test in CI, a convention, a fix to the skill that produced the code. Produces a report in aiview with a recommendation per finding, applied on a yes. Not for reviewing one pull request (pr-review) and not for writing a rule already decided (project-conventions).
---

# Eliminate findings

**A review comment made twice is a finding about the process, not about the code.** The person paid once to notice it and once to explain it again. The third time it is a smell of the pipeline: something upstream, a design, a tool, a test, a rule, a brief, let the same thing reach a human. This skill finds the rung where it stops.

## Read the history

1. **Run `scripts/comments.mjs <owner/repo>`** for the thread openers: every review comment by a person, bots excluded, replies excluded, with its pull request, path, date and body. `--since <ISO>` after an earlier run, `--json` to parse.
2. **The person's own words are the signal.** A bot's comment counts as a second source, never as the finding. A reply that says "done" and cites a commit is the evidence of what the fix was: read it for the shape the person accepted.
3. **Read the reports of `pr-review`** in aiview (`../aiview/SKILL.md` in this collection, `list --kind report`) for the findings the agent raised itself, and the conventions file for the rules that already exist: a finding a rule already covers is a finding about the rule, its wording, its cost line, or its enforcement.

## Group

- **A finding is one thing the person wanted done differently**, named in their words, however many files and pull requests it spans. "One service owns the current user", "the mock is a module, not a branch in the client", "a primitive stays in `ui/`, business logic leaves it".
- **Two occurrences is a candidate, three is overdue.** One occurrence stays a comment, unless the person's reply said "that is now the rule": then it is a decision already made and the question is only its rung.
- **Count what it cost**: the occurrences, the pull requests, the rework commits each one caused. The count is the argument for the rung.
- **A comment whose answer was "no, and here is why"** is not a finding. Drop it, and say so in the report: the person may want a rule saying why.

## Choose the rung

**Read `references/ladder.md` before choosing**: the rungs in order of preference, the criterion that admits a finding to each, and the artefact each produces. The highest rung the finding admits wins, because every rung below it leaves a human to catch it again. The short form:

1. **Impossible by design**: a module, a type, a generator that leaves no place to do it wrong.
2. **A tool**: the type checker, the linter, the formatter, failing on the laptop before the commit.
3. **A test in CI**: a convention test over the tree, failing the push.
4. **A rule in the conventions file**: judgment a reviewer can point at, through the `project-conventions` skill (`../project-conventions/SKILL.md` in this collection), its five filters and its shape.
5. **The skill or brief that produced the code**: when the author is an agent, the finding is a sentence missing from the skill it ran under or from the slice document's template. The rule is written there, once, and every later run reads it.
6. **Stays a review comment**: what needs the person's eyes each time, said so in the report, so it is never proposed again.

A finding may take two rungs: the design change that removes the class of it, and the test that keeps it removed.

## The report

**One `report` document, opened in aiview when the reading starts**: kind `report` from the filename `YYYY-MM-DD-review-findings.report.md`, tags = project + `review-findings`, started when the reading began. Tell the person the URL.

Per finding, a section: the person's words, the occurrences linked, the cost, the rung with its criterion met, the artefact drafted in full (the rule text in the shape `project-conventions` asks, the lint configuration, the test, the sentence for the skill, the design change as a paragraph and the modules it creates), and one line saying what stays with a human after it. A recommendation first where two rungs compete. The close: a table of finding, rung, cost, and the ones dropped with why.

## Apply

**On the person's yes, per finding, never as a batch.** A rule goes through `project-conventions`, capture mode. A lint rule and a test go into the repository under the `write-code` skill (`../write-code/SKILL.md` in this collection), on a branch, the test red on the tree's existing violations first. A design change is a board (`brainstorm`, `../brainstorm/SKILL.md` in this collection), never a change made from here. A sentence for a skill in this collection is proposed to the person with the skill named, written on the yes.

## Red flags

| Thought | Reality |
|---|---|
| "This one is obvious, a rule will do" | Obvious is why it recurs: nobody thinks of it while writing. A rule is read after. The rung above a rule is what stops it. |
| "I'll write a rule for each theme" | A rule is rung four. Every finding is tried against the three above it first, and the report says why they were not admitted. |
| "The bot flagged it too, so it counts double" | A bot's comment is corroboration. The person's is the finding. |
| "Five occurrences, so a lint rule" | The count says how urgent. The criterion says which rung. A lint rule cannot see a design. |
| "The person wrote 'can we', so it is a question, not a finding" | Read the reply. A "done, commit x" answered it as a finding. |

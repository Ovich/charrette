---
name: tighten-skill
description: Use when a skill has grown, reads as prose, or the person asks to shorten, prune, clean up or rewrite a SKILL.md. Rewrites it in the tight shape with every behaviour kept, then prunes it line by line with the person. Not for writing a new skill from nothing, and not for changing what a skill does.
---

# Tighten a skill

A skill is read on every run. Every line it carries costs attention on every run, and only the lines the agent acts on pay for themselves.

## Before starting

- **Read the whole skill.** Then write the **inventory**: one line per behaviour it produces, the things an agent does differently because this file exists. The rewrite is done only when every inventory line is still in it.
- **Find who points at it.** `grep` the sibling skills and references for its name; every section they name must survive with a heading a reader can still find.

## The shape

- **The rule bold and first; the why one clause after it, or absent.**
- **Sections are bullets**, each a bold lead then one sentence.
- **Headings name what the section is for.** *Before starting*, *When to pause*. Never a count or a shape.
- **Leading words** carry the concepts: one word the model already knows (*tracker*, *brief*, *seam*), defined once, then used as a token.
- **Positive phrasing.** State the target behaviour; a prohibition only as a hard guardrail, paired with what to do instead.
- **Anti-patterns carry their tell**: the sentence the agent would say when about to do it.
- **No history.** No dates, no "this was tried", no story of how the rule came to be. The references and the environment hold facts.
- **A table where the columns are the instruction**: a report format, a state table.

## The line test

Ask of every line: **does the agent act on it, and is it said where it acts?**

- Fails the first: exposition, justification, a description of another skill's job. Cut.
- Fails the second: a meaning stated here and again where it applies. Keep the one where it applies.
- **Cut the whole line, never trim it.** A trimmed no-op is a shorter no-op.

## The passes

1. **Rewrite** in the shape, from the inventory. Check every inventory line is present. Show the person the before and after line count.
2. **Prune** with the line test, once alone. Then ask the person for one line they doubt, answer what in it is unnecessary, cut it, and repeat until they stop.
3. **Headings**: each one named for its purpose.
4. **Cross-references**: every pointer into the skill from a sibling still resolves.

## The return

- Line count before and after.
- The inventory, each line marked where it now lives.
- What changed in shape, in one paragraph.
- What was cut and why, only where the person might miss it.

## Anti-patterns

- **Trimming.** The tell: "I'll shorten this sentence." A line that fails the test goes whole.
- **Keeping the why.** The tell: "this explains the reasoning." One clause, or the reference.
- **Keeping the story.** The tell: "this is how we learned it." The reference holds it; the skill does not.
- **Merging rules.** The tell: "these two say nearly the same thing." Two meanings stay two lines; one meaning in two places loses the one that does not act.
- **Softening.** The tell: "this reads harsh." A rule is a rule; the shape is bold, not polite.

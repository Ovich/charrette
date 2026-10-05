# The shape of a bench's skill

Text in `[brackets]` is filled from the definition. Every other sentence is carried as
written.

```markdown
---
name: workbench-[bench]
description: "Use when [the bench's scope, a kind of work on a part of the product] is to be worked on with the person on the [label] workbench, or the bench's feed or scripts fail. Feeds the page from the project's own data[ and operates the walk]. Not for [the neighbouring question it does not answer]."
---

# [Label] workbench

[The bench's scope, one sentence.] [Its views, one line each: the question each answers.] [What the person does on it.]

A new question in this scope is a new view or mode here, never a second bench.

**The page** is `[YYYY-MM-DD-bench.workbench.html]` in aiview, kind `workbench`
([the aiview link]). It is a working document of the data home and never enters this
repository.[ One page per run: `page-template.html` beside this file is every page's code, made into
a run's page by the feed's `init` and put back onto each page by its `refresh`.]

## Sources

| Source | Path | Written by |
|---|---|---|
| [what it is] | [path, or how it is reached] | [the code that produces it] |

The page works on these as the project produces them, never on a translation.

## Feed

**[Derived | Log].** [Derived: `node .claude/skills/workbench-[bench]/scripts/feed.mjs [--watch]`
rebuilds the data block from the sources. | Log: `node .claude/skills/workbench-[bench]/scripts/feed.mjs <verb>`
appends one entry and never rewrites one; the page is the only record of the walk.]
Only the feed writes the data block, through `scripts/data-block.mjs`.

## Operating

[Only when using the bench takes steps. Each step a script in `scripts/`, in the order
they run, with what it needs and what it leaves: start, act, hold, reset, record.]

## Drift

**Every script checks what it depends on and fails loudly**: a source missing, a field the
page reads absent, a table, a column, a route or a container gone, named in the error with
a non-zero exit.

**When a script fails, or the page shows a blank where data should be, the project has moved
on: adapt the bench to it, in place.** Read the source as it is now, change the feed, the
scripts and the page to match it, never the data to match the page, run the feed again,
and show the person what changed. A source the bench lost entirely is named to the person
before anything that depended on it is removed.
```

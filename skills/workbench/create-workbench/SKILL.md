---
name: create-workbench
description: "Use when a page is wanted to work on something with the person during development, fed the project's real data (comparing model answers, walking an agent call by call, measuring an output against its template), or when such a workbench has to change or its feed broke. Produces the page in aiview, kind `workbench`, and the project's `workbench-<bench>` skill with its feed and operating steps. Not for designing a product screen (design-prototype), judging one recorded call (prompt-review) or verifying user stories (verification-skill-create)."
---

# Create a workbench

**Two things are produced, and a later agent works the bench from them alone**: the page,
in the data home like every document, and the project's `workbench-<bench>` skill, which
holds the feed that fills the page and the steps to operate it.

**The person is in the build.** Every change is shown in the watched browser before the
next question, as the `design-prototype` skill paces a mockup. A bench described in chat
was not seen.

## Before building

- **A `workbench-<bench>` skill exists for this question** in the project's local skill
  folder: read it and its page, and change both. Never a second bench for one question.
- **Read the sources before asking**: the files the project produces that the bench will
  show (recordings, requests as sent, fixtures, templates), where they live, their exact
  shape, and the code that writes them.
- **The watched browser**: a headed browser the person sees and the agent drives, a
  Playwright MCP over DevTools or a script over CDP. The project's own when it has one,
  named in its local skills. None: start Playwright's Chromium headed with
  `--remote-debugging-port=9222`, say so, and stop it at the end.

## Define, through the `interview` skill

Each answer is written into the bench skill's head as it lands.

1. **The question the bench answers**, one sentence, and the bench's label.
2. **The sources**, each file or call, as the project produces it.
3. **The feed's kind.** *Derived*: the block is rebuilt from the sources on every run.
   *Log*: entries are appended and never rewritten, for data the project cannot produce
   again (a request as sent during a walk). The page is then the only record.
4. **What the person does on it**: compare, judge, pick, measure. The controls follow.
5. **Whether operating it takes steps**: start the stack, hold a call, reset state,
   record an answer. Each becomes a script.

## Build, live

1. **The page**: `node scripts/page.mjs <path> --label "<label>"`, at the path the `aiview`
   skill gives for `YYYY-MM-DD-<bench>.workbench.html`. Register it through the `aiview`
   skill: kind `workbench`, tags the project, the bench and `trace` for a walk, group the
   piece of work it serves. Open it in the watched browser. A bench that makes one page
   per run (a walk, a session) keeps the page's code as `page-template.html` in its skill instead:
   its feed's `init` makes each run's page from it, and its `refresh` puts a changed
   `page-template.html` onto every page while keeping each page's data block.
2. **The feed**: copy `scripts/data-block.mjs` into the bench skill's `scripts/` and write
   `feed.mjs` over it. A derived feed calls `writeData` and takes `--watch`. A log feed
   takes verbs that call `appendEntry` and `annotate`. Run it: aiview reloads the page.
3. **Then one change at a time**: write it, read the screenshot, show the person, ask the
   next question.

## The page

- **The bench bar opens on the label.** It is the one standard part. The rest of the bar
  and the page carry whatever the bench needs.
- **Controls are Basecoat**, shadcn's design system in plain HTML, inlined by `page.mjs`:
  `class="btn" data-variant="outline" data-size="sm"`, `card`, `tabs`, `badge`, `input`,
  `select`. Basecoat carries no Tailwind utilities, so layout is the page's own CSS. The
  product the bench shows (a document, a screen, a card) is drawn in the project's design
  language, from the `design-prototype` skill's reference when there is one.
- **The data is the project's, as it is.** Copied byte for byte, never renamed, reshaped
  or summarised: the page adapts to the shape, so the bench stays as close to the real
  run as it can. A rendering that interprets the data is what the app already shows.
- **Only the feed writes the data block.** The agent edits the page's code, never its data.
- **Self-contained**: no CDN, no fetch, the page opens offline.

## The bench's skill

**`workbench-<bench>/SKILL.md` in the folder the project already uses for local skills**,
`.claude/skills/` when it has none, with every deterministic step a script in its
`scripts/`. Written to the shape in `bench-skill.md`, read before its first line: the
sentences outside its brackets are carried as written.

## Prove it

Run the feed from a clean shell, see the page reload with real data in the watched
browser, and walk once, with the person, what they do on it. A bench whose feed has not
run is not handed over.

## Handoff

The page's URL, the skill's path, the sources and the feed's kind, what was walked.

## Red flags

| Thought | Reality |
|---|---|
| "I'll map the data to a cleaner shape for the page" | The page adapts to the project's shape. A translation hides what the app really produced, and drifts from it unseen. |
| "Quicker to paste the data into the page" | Only the feed writes the block. A pasted copy is stale on the next run and nothing says so. |
| "The feed can sit next to the page in the data home" | It reads the project, so it lives in the project's skill. In the data home it breaks without anyone seeing. |

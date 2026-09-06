# The roadmap and the foundation: contents

**`YYYY-MM-DD-<project>.roadmap.md`**, kind `roadmap`, dated at declaration and kept
for the life of the project. In order: links (the foundation, every board the
project holds), the tracker diagram, one section per iteration, the unscheduled
pool, the redraw log, the interview log. An iteration section holds its outcome in one
or two sentences in the customer's words, the one end-to-end check a person performs
when it lands, and its slots. A slot row: its slug, what it delivers, what exists for
it (the groups, by name), its derived state, what it depends on. Stories are not
here: they live in the spec of the slot that makes them true. The unscheduled pool is
one line per idea not yet placed, so nothing is lost and nothing is designed early.

**`foundation.reference.md`**, kind `reference`, undated, never retires: the
technology decisions, one row each, decided / open / deferred with an owner, and the
slot that will force each open one. Rows: the repository (which provider, GitHub or
another, its name and visibility, the conventions file it opens with), runtime and
language, frontend framework
and UI library (pointing at the design language, never repeating it), backend
framework, API style, database and ORM, typing strategy, auth, hosting and
operations, testing and CI, and the AI engine's place in the architecture when the
product has one (provider, tiering, where the prompts and rules live). The engine's
internal design is a slot's board, not a row. Once code exists the file is a cache of
what the code says: re-derive it, and distil the durable rules into the
conventions file through the `project-conventions` skill
(`../project-conventions/SKILL.md` in this collection).


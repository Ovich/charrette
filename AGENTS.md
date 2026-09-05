# AGENTS.md

Conventions of the charrette repository: the decisions a fresh agent would otherwise
guess differently. A rule may be deviated from at a specific site with a comment
beginning `AGENTS EXCEPTION (rule N):` and the reason; without one, deviation is a
review finding. When a decision made during a session would pass the five filters of
the `project-conventions` skill (contested, recurring, consequential, checkable, not
tool-enforceable), say so in chat before the session ends and propose the rule, in
that skill's shape; it is written here only on the person's yes.

## Architecture (context you must not break)

Every skill is one flat folder, `skills/<name>/`, opening on a `SKILL.md`; supporting
files sit beside it, situational ones under `references/`. aiview, `skills/aiview/`,
is the one tool: a CLI, a server and a UI, shipped as versioned bundles so an install
never builds. What runs for a user is the plugin cache, not this checkout; a change
reaches anyone only through a release (`RELEASING.md`). Documents the skills produce
live in the data home, never here.

## Skills

1. **MUST reference another skill by name plus the relative path `../<name>/SKILL.md`, "in this collection".** Every skill is a sibling, so the path is the same from anywhere; an absolute path or a bare `skills/<name>/` breaks on the next checkout and in a plugin cache.

2. **MUST keep in `SKILL.md` only what every use of the skill needs, and put what one situation needs in `references/<topic>.md`, named in `SKILL.md` at the point where the situation arises, with the condition to read it stated there.** Everything in `SKILL.md` is paid for at every load, and a condition written inside a reference is read only by an agent that has already opened it. `skills/aiview/references/`, `skills/execute-plan/references/`, `skills/frontend-design/references/`.

3. **MUST write a description as the trigger and nothing else: what activates the skill, what it produces, what it excludes.** Method, mechanics and instructions to a loaded agent belong in the body, and the body carries no "when to use" section of its own. The router reads only the description; the agent reads the body only after.

4. **MUST give a protocol one owner and have every other skill point at it, never restate it.** Two copies drift, and the reader has to work out which lies. The tracker is `skills/execute-plan/references/tracker.md`; diagram discipline is `skills/write-diagrams/`; the index contract is `skills/aiview/`.

## aiview

5. **MUST bundle a new runtime dependency into `dist-cli/` through `skills/aiview/build.mjs`, never require `node_modules` at runtime.** An installed plugin has no `node_modules`; a bare import fails only for users. `parse5` and `mermaid` are bundled this way, the checker as its own bundle.

6. **MUST bump `version` to the same value in `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, rebuild, and commit `dist/` and `dist-cli/` before pushing `main`.** Without the bump no existing user receives the change, and without the build they receive the old viewer. The sequence is `RELEASING.md`.

## Documents

7. **MUST NOT commit a board, spec, plan, mockup or report to this repository.** They are working material and go to the data home through `aiview path`; a document in the tree gets reviewed, goes stale and outlives its use. The README and `RELEASING.md` are deliverables and belong here.

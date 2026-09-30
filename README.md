# Charrette

[![version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOvich%2Fcharrette%2Fmain%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&prefix=v)](RELEASING.md)
[![stars](https://img.shields.io/github/stars/Ovich/charrette)](https://github.com/Ovich/charrette/stargazers)
[![last commit](https://img.shields.io/github/last-commit/Ovich/charrette)](https://github.com/Ovich/charrette/commits/main)
[![licence](https://img.shields.io/github/license/Ovich/charrette)](LICENSE)

*(French, from architecture studios: the intense working session where a design is
drawn, argued over, and decided before anything expensive is built.)*

Agent skills that settle what gets built before code is written. They sharpen the engineer's thinking rather than replace it: every design, plan and screen is drawn, argued and approved by a person before an agent acts on it. A design conversation ends in one plan, a screen in a working mockup, a pull request in an analysis with the decisions only a human can make. Every document renders live in aiview, the companion app. None of it lands in your repository.

Diagrams are one of software engineering's most useful techniques, and they went nearly extinct because of their cost. Charrette brings them back into the AI era. A diagram states a concept in a form both a person and an agent read the same way, so the design lives in one shared picture rather than in two understandings of the same prose, and it is the densest context an agent can be given about a system.

Twenty-two skills in plain Markdown and a companion app in plain Node. No harness, plugin format or cloud service is required.

## The loop

Phasing: what a piece of work passes through, from its entry points to merge.

```mermaid
flowchart LR
  I["an idea"] --> P
  B["brainstorm<br/>a board"] --> P
  DM["deepen-module<br/>a module document"] --> P
  RM["roadmap<br/>the next slot"] --> P
  P["write-plan<br/>one document, written while interviewing"] --> WS["write-slice<br/>one document per slice"]
  WS --> E["execute-plan<br/>one agent per slice"]
  E --> R["pr-review"]
  R --> M["merge"]
```

A plan starts from whatever exists: an idea said in chat, a board, an agreed module, the roadmap's next slot. `interview` resolves the decisions along the way and `write-diagrams` draws them. The plan's diagram is the tracker, and a later session with none of the conversation in context resumes from it.

## Iterate the loop

Charrette is run iteratively. One pass of the loop is one iteration: it plans and builds a single increment, a feature or a bounded change that works and can be verified when the iteration ends. The plan is the iteration's plan, not the project's: it covers the increment and stops where the next one would begin, think of an agile approach. What the increment teaches feeds the next plan, so the design grows by increments and each plan is written with the last increment's learning in hand.

The thing to avoid is big design up front: an agent loves writing plans, embellished and polished, and they can fall apart at the end. A plan is sized to what a person can hold in mind, understand and approve in one reading.

Above the iterations sits the roadmap, one document per project kept by the `roadmap` skill: the iterations in order, each made of slots, a slot being something the customer can use or a system that can be deployed. Each slot points at the boards, mockups and plans that exist for it, its state derived from them, and the foundation reference beside it records the technology decisions, closed no later than the first slot that needs them. Only the next iteration is drawn precisely: a slot is split when the work reaches it, and the roadmap is redrawn when a slot lands.

## What it looks like

The first two are from one real piece of work: the redesign of this collection's own `pr-review` skill into layers. The viewer follows the OS theme.

### A spec, with the work it belongs to

What `brainstorm` and `write-plan` leave behind for one feature: the board and the spec in one group, the plan with its slice documents in another. The spec's diagrams render inline, here the five layers and the orchestrator that dispatches them. The header shows the absolute path, click to copy.

![aiview: the pr-review redesign spec, its layer table and orchestrator diagram rendered, the board and plan grouped beside it](assets/aiview-pr-review-spec.png)

### The same plan, mid-execution

The plan's phasing diagram is its tracker: one node per step, saying in three lines what the step delivers and what made the orchestrator go on, pause or drop it, gates that record the branch taken, a state node with branch, commit, next step, blocked and parked, which is what a later session resumes from, and under the diagram the mandate in force, in one line.

![aiview: the pr-review redesign plan at its gate, trial steps done with evidence, release in progress, the untaken branch marked not needed](assets/aiview-pr-review-plan.png)

### Mockups that work

A screen is judged by human eyes, so the person stays in the loop for it. In the near future the main user of software will probably be an agent; until then there is a person at the screen, and the mockup is where they look before anything is built.

A mockup is a working prototype, not a picture: a stepper counts, a promo code applies, a questionnaire advances, the behaviour mocked in the file. Describe the flow, not only the screen, and every state, transition and edge case is settled before implementation. The demo below is a shop's cart page.

![aiview: the Arbor cart page, the variant toolbar above the frame with "promo applied" selected](assets/aiview-mockup-variants.png)

A screen has states: empty, promo applied, an item out of stock. The mockup declares them as variants, the viewer exposes them in its toolbar, and the chosen one persists across reloads.

### Mockups that compose

A component is drawn once and bound by every screen that needs it. The cart page binds the cart line, the stepper, the promo field, the checkout button, the badge and the empty state from a parts sheet, eleven bindings in all. `aiview check` says whether they resolve. The Composition view outlines what a screen binds, in indigo, and what it exposes, in green. A click on a bound region opens its source.

![aiview: the cart page in Composition view, bound regions in indigo, the hovered cart line labelled "shop-parts · CartLine · pulled", the order summary in green as offered](assets/aiview-mockup-composition.png)

The parts sheet in the same view, one outline per exposed component:

![aiview: the parts sheet in Composition view, the product card outlined in green and labelled "ProductCard · offered"](assets/aiview-mockup-parts.png)

## Install

**Claude Code**, as a plugin. The skills answer to `charrette:`, as `/charrette:brainstorm` or `/charrette:pr-review`, so nothing collides with skills you already have:

```
/plugin marketplace add Ovich/charrette
/plugin install charrette@charrette
```

**Any other agent**, from a clone. Node 22.5 or later, nothing else. Prompt:

> Set up Charrette: clone `https://github.com/Ovich/charrette.git` into
> `<the checkout>`, build the bundled viewer, and make every skill under `skills/`, at
> the root or one folder down in its group, discoverable to you (symlink or otherwise).
> Then tell me the aiview URL and the skills you can reach by name.

Then ask in plain language. Each skill states when it applies and maps your request onto its flow.

## Skills

By group, in the order work usually happens. The folder under `skills/` is the group.

### Project: what a project has once and keeps

| Skill | Use case | Example ask |
|---|---|---|
| [roadmap](skills/project/roadmap/SKILL.md) | A project has to be declared above its pieces of work, from nothing or from the boards and mockups already made, or a slot has landed and the picture must be redrawn | *"Declare the roadmap for this project."* Everything that exists read first, the missing slots named (accounts, the repository, the foundation), iterations of deliverable slots drafted with a recommendation in every open place, then an interview on the draft. The foundation reference beside it holds the stack, the database, the API, the hosting, each row closed no later than the first slot that needs it. |
| [write-conventions](skills/project/write-conventions/SKILL.md) | A decision was just made, or a repo's unwritten rules need writing down | *"We just settled on soft deletes everywhere: capture that."* Or: *"Harvest this repo's conventions into AGENTS.md."* |
| [technical-writing](skills/project/technical-writing/SKILL.md) | A document that stays in the repository: a README, an architecture doc, an ADR, a runbook | *"Write an architecture doc of the payments service, audience: new backend hires."* |

### Thinking it through

| Skill | Use case | Example ask |
|---|---|---|
| [interview](skills/interview/SKILL.md) | A design object has decisions nobody has resolved, or you want to be questioned about one until it is understood the same way | *"Interview me about this plan."* Decisions walked in dependency order, the codebase read before you are asked, a recommendation on every question. Every claim about a tool or a practice is researched from its sources; very small proofs of concept with the libraries, when you say yes to them. |
| [whiteboard-defense](skills/whiteboard-defense/SKILL.md) | A system has shipped and you want to be able to explain and defend it to anyone who pulls you aside | *"Whiteboard me on the sync engine."* Hard questions on the system and on its stack, one at a time, open-book: you go read, come back, get pushed. A defense report with the gaps, the reading that closes them, the decisions an agent made without you, and the architecture leads the questions turned up. |

### Architecture

| Skill | Use case | Example ask |
|---|---|---|
| [brainstorm](skills/architecture/brainstorm/SKILL.md) | An idea is worth thinking through and keeping, before a plan or without one | *"Run brainstorm: should we move the agent onto LangGraph?"* The interview, kept on a live board with its diagrams and what was investigated. A plan can start from it and does not need it. |
| [deepen-module](skills/architecture/deepen-module/SKILL.md) | A module's interface has to be designed or reworked so that it hides much behind little | *"Deepen the agent module."* The code a caller writes to use it, the one entry as signatures, what stays outside, the gap from today, discussed until agreed. write-plan shapes its major areas this way. |
| [write-diagrams](skills/architecture/write-diagrams/SKILL.md) | A design question would settle faster drawn than argued | *"Draw today's login flow: I need to see where the redirect happens."* |

### UI

| Skill | Use case | Example ask |
|---|---|---|
| [design-prototype](skills/ui/design-prototype/SKILL.md) | A screen is about to be built or visually reworked | *"Before we code the settings page, propose a mockup."* Design language extracted once, every screen approved in the viewer, code after. |
| [point-at](skills/ui/point-at/SKILL.md) | The agent is about to ask you about a screen, or you do not see what it means | *"Show me what you mean."* Finds the screen's mockup, asks in the mockup's own component names, and points your open viewer at them: the tab moves there, the components are outlined and named, the rest dimmed. Called by the skills that ask questions. |

### Plan

| Skill | Use case | Example ask |
|---|---|---|
| [write-plan](skills/plan/write-plan/SKILL.md) | Something non-trivial is about to be built and its plan has to be written | *"Write the plan for per-user rate limiting."* One document, written while interviewing: why, before and after, the deep modules, the flows, the failure modes, the suite, the slices with their tracker, and the mandate you give the orchestrator. No code until it is approved. |
| [write-slice](skills/plan/write-slice/SKILL.md) | A plan's increment has to be cut into slices, or a slice of an approved plan needs the document an agent will carry it out from | *"Write the slice document for SL3."* One plan node in, its document out: the decisions quoted, the seams under test, the modules table its tests are written against, the environment facts the first command trips on. |

### Execute

| Skill | Use case | Example ask |
|---|---|---|
| [execute-plan](skills/execute/execute-plan/SKILL.md) | An approved plan is ready, or was left mid-way by an earlier session | *"Execute the rate-limiting plan."* Delegates each slice to a fresh agent, watches it, re-runs each slice's check itself, keeps the tracker, merges as the mandate says. Pull requests open as drafts and are marked ready only at the merge. Pauses only for your decisions, your checks, or an action that does not undo. Refuses a plan with no tracker. |
| [execute-slice](skills/execute/execute-slice/SKILL.md) | One slice document is handed to an agent to carry out | *"Do slice 2."* Checks the blockers first and stops if any is unmet, writes the code and its tests when the mandate in its brief says (at the plan end, at the slice end, commit only at green, or commit per phase), returns the branch and the run as evidence. |

### Verify

| Skill | Use case | Example ask |
|---|---|---|
| [verification-skill-create](skills/verify/verification-skill-create/SKILL.md) | A project's user stories should be shown to work end to end, through the interface their consumer uses, and it has no verification skill yet | *"Create the verification skill for this app."* The consumer, the interface and the harness read from the repository, a project-local `verify-<app>` skill written, the feature map drawn in aiview, one story proven. execute-plan offers it when a plan starts. |
| [verification-skill-maintain](skills/verify/verification-skill-maintain/SKILL.md) | The application changed and its verify skill or feature map must follow, from a slice, a commit range or a date | *"Maintain the verification skill since the last slice."* Only what the diff moved is changed, the affected stories re-proven. execute-plan runs it once, at the slot's end. |

### Review

| Skill | Use case | Example ask |
|---|---|---|
| [pr-review](skills/review/pr-review/SKILL.md) | A pull request needs an informed merge decision | *"Run pr-review on PR #142."* Five layers, each its own subagent, dispatched where the diff gives them material. Two documents: the analysis, and a report with what changed (drawn), a verdict per layer, what you must decide, and a comment to post as-is. |
| [code-design-review](skills/review/code-design-review/SKILL.md) | Design quality on code that is not in a PR, any language | *"Code-design-review the billing module."* DRY, KISS, YAGNI, SOLID, cohesion, coupling. Inside a PR these lenses are pr-review's. |
| [complexity-rework](skills/review/complexity-rework/SKILL.md) | Code is hard to follow: long condition chains, parse attempts tried one after another, deep nesting, a function doing several jobs, or complexity guardrails wanted | *"Audit where this codebase is complex, then rework the worst family."* Two measures in three bands (cyclomatic paths 1 to 6, 7 to 10, 11+; cognitive reading load 0 to 10, 11 to 15, 16+). An audit of families ranked by the data they branch on, the types that already exist named first; each family's behaviour pinned by tests before any code moves, then reworked with the tests unchanged; a gate against a baseline that only shrinks. |
| [frontend-review](skills/review/frontend-review/SKILL.md) | React/TSX quality | *"Run frontend-review on src/features/checkout."* Findings in chat for a diff, an aiview report for a whole scope. |
| [prompt-review](skills/review/prompt-review/SKILL.md) | A model call or an agentic walk has to be judged from what the model was actually sent and what it returned | *"Review the offer assistant's last walk."* One page: the prompt, tools and data as sent, the reply as returned, and the prompt's own rules as checks with their hits. A failed check changes the prompt or the data, and the run is recorded again. |
| [recurring-review-findings](skills/review/recurring-review-findings/SKILL.md) | The same remark keeps coming back in the pull request reviews | *"What do my reviews keep catching, and how do we stop catching it?"* The comment history read, grouped into findings by the person's words, each tried against a ladder: impossible by design, a lint or type rule, a test in CI, a convention, a sentence in the skill that produced the code. A report with the artefact drafted per finding, applied on a yes. |

### The companion app

| Skill | Use case | Example ask |
|---|---|---|
| [aiview](skills/aiview/SKILL.md) | A viewer at `localhost:4321` and an index, driven by the agent from a CLI. Called by the other skills; directly, to show a document or query the index | *"Open docs/notes/cache-idea.md in aiview, tagged payments."* |

`write-diagrams`, `interview`, the tracker protocol in `execute-plan` and the companion app are the shared layer the others delegate to. `roadmap` sits above the loop: it names the next slot, and a board, a plan or a run finishing tells it to redraw. House rules in `AGENTS.md` win over general principles wherever the two disagree.

## Where things live

| Root | Holds | Versioned |
|---|---|---|
| The checkout, or the plugin cache | `skills/<group>/<name>/SKILL.md`, one folder per skill under its group: the loop's phases `architecture`, `ui`, `plan`, `execute`, `review`, `project` for what a project has once and keeps, `verify` for its verification skill; `interview` and `whiteboard-defense` at the root; supporting files alongside. `skills/aiview/`: CLI, server and UI, outside the groups | Yes, rebuildable |
| The data home, `$CHARRETTE_HOME` or `charrette_appdata` in your OS home directory | `docs/<project>/*.md, *.html, *.pdf`, among them the project's roadmap and its foundation reference, and `aiview.sqlite`, the index and the active project | Never in a project repo. May be its own git repo, to sync between machines |
| Your project repository | `AGENTS.md`, grown by write-conventions. README and architecture docs, written by technical-writing | Yes, by you |

Charrette stores its documents outside the repository to avoid doc rot: outdated documents influence the agent badly. Boards, plans, mockups and PR analyses are obsolete when the PR merges, so by default none is versioned and none lives in a project repository. For some types of documents, an architecture doc, an ADR, a spec the team keeps current, the codebase can be considered, and it is allowed: the index only points at files, and aiview serves a document from where it is.


## Updating

The plugin takes three steps. The third is not optional: an update applies only to a session started after it.

```
/plugin marketplace update charrette
/plugin update charrette@charrette
```

Then restart Claude Code. `/plugin marketplace update` alone refreshes the catalogue without touching the installed copy.

A checkout takes a prompt, because three things move and only one is `git pull`:

> Update Charrette in `<the checkout>`: pull, restart the viewer's server if one is
> running, and repair skill discovery: links made against an older layout of `skills/`
> dangle, most skills now sit one folder down, under their group. Leave the data home alone.
> Then tell me the aiview URL and the skills you can reach by name.

A running server keeps serving the copy it started with. Skills are linked, not copied, so they update with the pull, but links made against an older layout dangle.

## License

MIT: see [LICENSE](LICENSE). One reference of the design-prototype skill adapts material from Anthropic's skills repository under the Apache License 2.0. Its notice is in that file and the licence in `licenses/`.

# The tracker

The **tracker** is the plan's phasing diagram, and the single record of where the work stands.

## Markers

- **The tracker is the first thing in the plan**, under the header and above every other section and diagram: it is what a reader opens the plan for, to see where the work stands. `aiview tracker check` holds it.
- **`%% tracker`** as the first line inside the fence, under `flowchart TB`, so the block names itself among the plan's diagrams.
- **`SL<n>` as a slice's subgraph id**, matching the `S<n>.<step>` of the steps inside it (`subgraph SL3[...]` holds `S3.1`, `S3.2`), so a step pasted into the wrong slice is caught.

## Slices and steps

- **A slice is a `subgraph`**, its title carrying the stories it serves and its `👤` mark when it needs a person (`Slice 2 · US3 · 👤 decision`).
- **A slice's done-when is its last node's**, or the join's where its arms meet.
- **Every step is a node** at the granularity someone would pause at, with its dependency edges and decision gates.
- **Node ids are `S<slice>.<step>`** (`S2.3`); a step discovered between `S2.3` and `S2.4` is `S2.3b`. Insert, never renumber: plans, boards and commits cite the old ids.
- **A node whose done-when is a story's acceptance criterion carries the story's id**, and the observed criterion is its `went on` line when met.
- **A line stays only while a resumer would act on it.** An overturned finding keeps one line, and only to stop someone walking it again; the rest goes when the finding is settled.
- **A step carrying two glyphs is already two steps.** Split it where the glyphs part.

## The step's shape

**The person reads a step to see where the run stands, and the orchestrator to decide what comes next; neither reads it to learn what was built.** Its lines are fixed: **three at most, each under 80 characters**, and `aiview tracker check` holds both.

```
⬜ S2.1 <what an observer of the system could tell> · <US id when it is a story's criterion>
done when: <the command that exits 0, or what is observed>
```

- **The first line names what an observer of the system could tell**: a behaviour gained or, for a rework, the structure reached and the invariant held (`the hand-written loop is gone, every walk unchanged`). No identifier from the code: it is renamed before the plan ends, and the slice document holds it.
- **The second line is the verdict, and the glyph names it.** It says what made the orchestrator go on, pause or drop the step, in one line:

| Glyph | Second line |
|---|---|
| ⬜ ▶ | `done when: <the command that exits 0, or what is observed>` |
| ✅ | `went on: <what was observed here> · <sha> · #<pr>`, in place of the done-when |
| ⏸ | the done-when kept, then `paused: <on whom, for what, asked <date>>` |
| ✖ | `dropped: <what happened> · <the decision id, or the step that replaces it>`, in place of the done-when |

- **`here` is this session's own observation**, never what the subagent reported: `went on: suite and e2e green here · a1b2c3d · #41`. Another observer is named: `went on: the person's word, 2026-01-01`.
- **`went on` names the result, never its numbers**: test counts, greps and file names are the pull request's.
- **A last line, `run:`, only when the orchestrator changed the route**: a steer, a fix of its own, a retry, a slice drawn mid-run (`run: steered a rename after lint refused it`). One event, the one a reader would ask about.
- **Everything else has a home, and the step never cites it:**

| What | Its home |
|---|---|
| What changed and where: files, line counts, greps, the road there | the pull request |
| A decision made on the way | a row in the plan's decisions |
| Tests or work owed to a later slice | the receiving slice's heading and document, and a dotted edge to the step that pays: `S1.1 -.->\|"owes: the specs it broke"\| S4.1` |
| Something a person should look at in a later step | a criterion in that step's slice document, and the same dotted edge |
| A subagent's claim, not yet re-run | the watch report; the step stays ▶ |

## Status

Each label opens with its glyph:

| Glyph | Means |
|---|---|
| ✅ | Done: its done-when was met, and `went on` says what was observed |
| ▶ | In progress, the one place work is happening |
| ⏸ | Blocked on someone else: `paused` says on whom, for what, and when it was asked |
| ⬜ | Not started |
| ✖ | Failed or abandoned: `dropped` says what happened and what changed because of it |

- **One ▶ at a time**; where the plan forks, one ▶ per arm.
- **A step that stalls on something outside your control becomes ⏸** and ▶ moves to whatever can proceed.

## Forks

- **A fork is between slices, never inside one**: two or more arrows leaving one node and joining at a later one, each labeled with its area; a slice is one agent's work.
- **Arms are disjoint**: they touch different files or areas, and neither needs the other's result before the join.
- **Two slices that touch one file are one arm.** So are two that touch one cloud account, one deployed environment, one database or one registry, however disjoint their files.
- **The join node's done-when covers what the arms produced together.**
- **A fork's arms are slices, each on its own branch off the plan's**; *branch* means a git branch, nothing in the diagram.

## Slots

The `roadmap` skill draws its tracker to this protocol with one difference: **the nodes are slots, one subgraph per iteration, and a slot's glyph is derived from the documents that carry its tag**, never from evidence observed in a step.

- ⬜ empty or in design.
- ▶ the slot whose pieces of work are being drawn, planned or run, one per iteration.
- ⏸ blocked on a foundation row or on another slot.
- ✅ landed, on the person's evidence that the feature is delivered and working.
- ✖ dropped, with the reason.

The state node's fields are the iteration, the slot in progress, next, blocked, and the foundation rows still open for the slot ahead.

## The state node

**One node carries the resume state**, drawn apart from the flow and connected to nothing. **Its fields are fixed and overwritten, never appended**: the node describes now.

```
📍 state · <date>
branch   <branch> @ <sha>, pushed / not pushed
deployed <where and which version>
next     <the one step to start on>
blocked  <what and on whom, or nothing>
parked   <side work, stashes, environments left behind, or nothing>
```

- **Add a field only when a resumer would act on it**: a rename, a version bump, an environment quirk.
- **The mandate is not state**: pace, steps, model and verify live in the plan's *Mandate* section.
- **A line that is history leaves the tracker**: the pull request holds it.

## Layout

- **One column**: `flowchart TB`, steps chained linearly, only the gates and the parallel arms sideways.
- **Pin the state node above the flow with an invisible edge**, `ST ~~~ S1.1`; connected to nothing, it would be parked beside the column.
- **Keep every `<br/>` line short**; long labels set node width, and a step's lines are held under 80 characters.
- **A dotted edge is a debt, a solid one a dependency.** A node that a dotted edge leaves has two arrows, so its solid one takes a label too (`then`).
- **Leave `direction` out of a subgraph that is itself an edge endpoint**; it fights the outer layout.

## Styling

- **Styling repeats what the glyph says, never replaces it.**
- **Eight-digit hex, never `rgba()`**, whose commas break a `classDef`:

```
classDef done stroke:#4a9d5f,stroke-width:2px,fill:#7f7f7f1a
classDef next stroke:#d08b28,stroke-width:2px,fill:#7f7f7f1a
classDef todo stroke-dasharray:4 3
classDef state stroke:#8a8a8a,stroke-width:1px,fill:#7f7f7f12
```

- **`aiview tracker sync <plan>` writes the `class` lines from the glyphs**; written by hand they drift.

## The skeleton

**A new tracker starts from `references/tracker-skeleton.md`**, which passes both checks as it stands.

## Checks

- **Run `aiview mermaid-check <plan>` and `aiview tracker check <plan>` after every edit.** Mermaid fails quietly; a broken `classDef` still renders, wrong.

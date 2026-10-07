# The tracker

The **tracker** is the plan's phasing diagram and the single record of where the work stands.
Run `aiview mermaid-check <plan>` and `aiview tracker check <plan>` after every edit; Mermaid
fails quietly. A new tracker starts from `references/tracker-skeleton.md`.

## Markers

- **First thing in the plan**, under the header, above every other section and diagram.
- **`%% tracker`** as the first line inside the fence, under `flowchart TB`.
- **A slice is a `subgraph` with id `SL<n>`**, holding steps `S<n>.<step>`; its title carries the stories it serves and `👤` when it needs a person (`Slice 2 · US3 · 👤 decision`).
- **A step is a node at the granularity someone would pause at.** A step found between `S2.3` and `S2.4` is `S2.3b`: insert, never renumber. A step carrying two glyphs is two steps.

## The step

**A step says where the run stands and what decided it, never what was built.** Three lines at
most, each under 80 characters.

```
⬜ S2.1 <what an observer of the system could tell> · <US id when it is a story's criterion>
done when: <the command that exits 0, or what is observed>
```

| Glyph | Means | Second line |
|---|---|---|
| ⬜ | not started | `done when: …` |
| ▶ | in progress; one at a time, one per fork arm | `done when: …` |
| ✅ | done, re-run here | `went on: <what was observed here> · <sha> · #<pr>` |
| ⏸ | blocked on someone | the done-when, then `paused: <on whom, for what, asked <date>>` |
| ✖ | dropped | `dropped: <what happened> · <decision id, or the step replacing it>` |

- **The first line names an observable outcome**, no identifier from the code.
- **`went on` is this session's own observation**, never the subagent's claim, and names the result, not its numbers.
- **A last line `run:`** only when the orchestrator changed the route: a steer, a retry, a slice drawn mid-run. One event.
- **Everything else has a home elsewhere**: what changed and where is the pull request's; a decision is a row in the plan's decisions; work owed to a later slice is a dotted edge to the step that pays (`S1.1 -.->|"owes: its tests"| S4.1`); a subagent's unchecked claim keeps the step ▶.

## Forks

- **A fork is between slices, never inside one**: arrows leaving one node and joining at a later one, each labeled with its area.
- **Arms are disjoint**: different files, and neither needs the other's result before the join. Two slices sharing a file, a cloud account, an environment, a database or a registry are one arm.
- **The join's done-when covers what the arms produced together.**
- **A plan in swarm mode draws every slice as an arm from one start**, not proved apart: `references/swarm.md`.

## The state node

**One node, connected to nothing, pinned above the flow (`ST ~~~ S1.1`). Its fields are overwritten, never appended.**

```
📍 state · <date>
branch   <branch> @ <sha>, pushed / not pushed
deployed <where and which version>
next     <the one step to start on>
blocked  <what and on whom, or nothing>
parked   <side work, stashes, environments left behind, or nothing>
```

Add a field only when a resumer would act on it. **The mandate is not state**: it is one line right
under the diagram, `mandate: run through · one for the plan · …`, or `mandate: not asked yet`.

## Layout and styling

- **One column**, `flowchart TB`; only gates and fork arms go sideways. Short `<br/>` lines.
- **Dotted edge is a debt, solid a dependency.** A node a dotted edge leaves labels its solid one too (`then`).
- **No `direction` in a subgraph that is itself an edge endpoint.**
- **`aiview tracker sync <plan>` writes the `class` lines from the glyphs**; never by hand. Colours are eight-digit hex, never `rgba()`.

## Slots

The `roadmap` skill draws its tracker to this protocol, with one difference: **the nodes are
slots, one subgraph per iteration, and a slot's glyph is derived from the documents carrying its
tag**: ⬜ empty or in design, ▶ being drawn, planned or run (one per iteration), ⏸ blocked on a
foundation row or another slot, ✅ landed on the person's evidence, ✖ dropped with the reason.
The state node holds the iteration, the slot in progress, next, blocked and the open foundation
rows. No verdict lines and no mandate line.

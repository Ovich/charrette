# The tracker

The diagram is the record of where the work stands, not an illustration of a record
kept elsewhere.

A plan is read twice: once to agree on it, then by whoever resumes the work, often a
later session with none of the conversation in context. The second reader needs state,
and slices alone do not carry it. So the phasing diagram does double duty: it is the
tracker, the single place that says where the work stands.

## Slices and steps

A slice is a `subgraph`, its title carrying the stories it serves and its `👤` mark
when it needs a person (`Slice 2 · US3 · 👤 decision`). Its steps are the nodes
inside it, and the slice's done-when is the done-when of its last node, or of the
join where its branches meet. Every step is a node, at the granularity someone would
pause at, with the dependency edges and decision gates that belong in a phasing
diagram. Node ids are `S<slice>.<step>` (`S2.3`); a step discovered between `S2.3`
and `S2.4` is `S2.3b`: insert, never renumber, since specs, boards and commit
messages cite the old ids. A node whose done-when is a story's acceptance criterion
carries the story's id in its label, and the observed criterion is written there
when it is met. Each label opens with its status:

| Glyph | Means |
|---|---|
| ✅ | Done: its done-when was met, and the evidence is written into the step below |
| ▶ | In progress, the one place work is happening |
| ⏸ | Blocked on someone else: the node says what it waits on and when it was asked for |
| ⬜ | Not started |
| ✖ | Failed or abandoned: the step says what happened and what changed because of it |

One ▶ at a time, or the diagram stops answering "where am I"; where the plan forks into
parallel branches, one ▶ per branch. ⏸ keeps that rule honest:
a step that stalls on something outside your control becomes ⏸ and the frontier moves
to whatever can proceed. A step parked as ▶ for days claims attention it is not getting.

A step whose first half can finish while the second waits on someone else is two
steps; drawn as one, it guarantees a hole in the tracker the day it happens.

Steps that are independent may be drawn as parallel branches: two or more leaving one
node and joining at a later one (`S2.1 -->|api| S2.2a`, `S2.1 -->|ui| S2.2b`, both
`--> S2.3`), each arrow out of the fork labeled with its branch's area. The test is
disjointness: the branches touch different files or areas, and neither needs
the other's result before the join. Two steps that touch one file are one branch. The
join node's done-when covers what the branches produced together.

## Slots, when the tracker is a roadmap's

The `roadmap` skill (`../roadmap/SKILL.md` in this collection) draws its
tracker to this protocol with one difference: the nodes are slots, one subgraph per
iteration, and a slot's glyph is derived from the documents that carry its tag,
never from evidence observed in a step. ⬜ empty or in design, ▶ the slot whose
pieces of work are being drawn, planned or run (one per iteration, as one ▶ per
branch here), ⏸ blocked on a foundation row or on another slot, ✅ landed on the
person's evidence that the feature is delivered and working, ✖ dropped with the
reason. The state node's fields are the iteration, the slot in progress, next,
blocked, and the foundation rows still open for the slot ahead.

## The state node

One node carries the resume state, drawn apart from the flow and connected to nothing.
Its fields are fixed, and they are overwritten, never appended to: the node describes
now, never how now was arrived at.

```
📍 state · <date>
branch   <branch> @ <sha>, pushed / not pushed
deployed <where and which version>
next     <the one step to start on>
blocked  <what and on whom, or nothing>
parked   <side work, stashes, environments left behind, or nothing>
pace     <run through | stop at each slice, as the person answered when the run began>
```

Add a field only when a resumer would act on it, such as a fact the work has earned
that a fresh session would otherwise rediscover the hard way: a rename, a version bump,
an environment quirk. If a line is history, it belongs in the step that produced it.
The failure this prevents is accretion: within a day an appended node holds three
deployed versions, a fixed bug and a deleted file, and the resumer has to work out
which lines are still true.

## Keeping it readable

One column. A tracker is scanned, not studied, and width ruins the scan. `flowchart
TB`, steps chained linearly, only the gates and the parallel branches sideways. Three
things widen it:

- The state node is connected to nothing, so the layout parks it beside the flow. Pin
  it above with an invisible edge, `ST ~~~ S1.1`, and the column starts at the top.
- Long labels set node width. Keep every `<br/>` line short; the state node is the
  usual offender.
- `direction` inside a subgraph that is itself an edge endpoint fights the outer
  layout. Leave it out.

Styling repeats what the glyph already says, never replaces it. Eight-digit hex, never
`rgba()`, whose commas break a `classDef` (the `write-diagrams` skill has the reasons):

```
classDef done stroke:#4a9d5f,stroke-width:2px,fill:#7f7f7f1a
classDef next stroke:#d08b28,stroke-width:2px,fill:#7f7f7f1a
classDef todo stroke-dasharray:4 3
classDef state stroke:#8a8a8a,stroke-width:1px,fill:#7f7f7f12
```

Parse the diagram, do not eyeball it. Mermaid fails quietly, a broken `classDef` still
renders, just wrong. Run `aiview mermaid-check <plan>` after every edit.

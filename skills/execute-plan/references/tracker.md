# The tracker

The diagram is the record of where the work stands, not an illustration of a record
kept elsewhere.

A plan is read twice: once to agree on it, then by whoever resumes the work, often a
later session with none of the conversation in context. The second reader needs state,
and phases alone do not carry it. So the phasing diagram does double duty: it is the
tracker, the single place that says where the work stands.

## Steps

Every step is a node, at the granularity someone would pause at, with the dependency
edges and decision gates that belong in a phasing diagram. Each label opens with its
status:

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
node and joining at a later one (`S03 --> S04a`, `S03 --> S04b`, both `--> S05`). The
test is disjointness: the branches touch different files or areas, and neither needs
the other's result before the join. Two steps that touch one file are one branch. The
join node's done-when covers what the branches produced together. Insert
numbers, never renumber: a step discovered between 0.2 and 0.3 is `0.2b`, since specs,
boards and commit messages cite the old numbers.

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
pace     <run through | stop at phases, as the person answered when the run began>
mode     <inline | subagents, as the person answered when the run began>
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
  it above with an invisible edge, `ST ~~~ S01`, and the column starts at the top.
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

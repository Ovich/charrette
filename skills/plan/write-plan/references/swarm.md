# A plan in swarm mode

Read when the mode is `swarm`. Everything else in this skill holds; this changes the cut, the
tracker and the order the documents are written in.

## The cut

- **No fork proof.** Slices may share a file: their runners settle it on the board (the `swarm`
  skill). Cut thin and vertical as the `write-slice` skill's `references/cutting.md` says; its
  fork rule and the disjoint arms of `references/tracker.md` do not apply.
- **Three phases, no chains.** An optional ground slice first, only when the others need its
  merged result (a shared contract, a move, a rename); then every other slice at once, settling
  what they share on the board; then the test slice. No slice waits on another between the ground
  slice and the tests: a dependency short of the ground is settled on the board, never drawn as a
  blocker.
- **The riskiest unknown is still Slice 1**, so its runner meets it first and the others hear of
  it on the thread.
- **Every slice document is written before the run**, with the `write-slice` skill, the test
  slice of `tests: at the plan end` excepted. The orchestrator dispatches them all at once.

## The tracker

**The slices are arms of one start node, joined at the trial**: the step whose done-when is the
full check on the branch every slice merged into.

```mermaid
flowchart TB
  %% tracker
  ST["📍 state · 2026-01-01<br/>branch: feat/topic @ 0000000, not pushed<br/>deployed: nothing yet<br/>next: S1.1, S2.1<br/>blocked: nothing<br/>parked: nothing"]
  GO(["the run opens · every slice document written"])

  subgraph SL1["Slice 1 · US1 · the riskiest part"]
    S1.1["▶ S1.1 the outcome · US1<br/>done when: the command exits 0"]
  end

  subgraph SL2["Slice 2 · US2 · the api"]
    S2.1["▶ S2.1 the outcome · US2<br/>done when: the command exits 0"]
  end

  subgraph SL3["Slice 3 · US2 · the screen"]
    S3.1["⬜ S3.1 the outcome<br/>done when: the command exits 0"]
  end

  subgraph SL4["Slice 4 · US1, US2 · the trial"]
    S4.1["⬜ S4.1 every slice merged, the full check green<br/>done when: the full check exits 0 on the merged branch"]
  end

  ST ~~~ GO
  GO -->|"arm A · the riskiest part"| S1.1
  GO -->|"arm B · api"| S2.1
  S2.1 -->|"arm C · after S2"| S3.1
  S1.1 -->|"arm A joins"| S4.1
  S2.1 -->|"arm B joins"| S4.1
  S3.1 -->|"arm C joins"| S4.1

  classDef done stroke:#4a9d5f,stroke-width:2px,fill:#7f7f7f1a
  classDef next stroke:#d08b28,stroke-width:2px,fill:#7f7f7f1a
  classDef todo stroke-dasharray:4 3
  classDef state stroke:#8a8a8a,stroke-width:1px,fill:#7f7f7f12
  class S1.1,S2.1 next
  class S3.1,S4.1 todo
  class ST state
```

- **One arm per slice, labelled with its area.** A slice with a blocker hangs from its blocker's
  last step, its label naming it (`after S2`), never from the start.
- **One ▶ per arm**: every running slice shows it at once.

## The mandate

**`mode: swarm` is the first field**, in the *Mandate* section and first in the line under the
tracker: `mandate: mode swarm · run through · …`. The other fields are asked as for any plan.

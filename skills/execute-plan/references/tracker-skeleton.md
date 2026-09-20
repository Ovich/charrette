# The tracker's skeleton

Copy the block, replace every phrase, delete what the plan has no use for. Keep the caption
line above the fence and the mandate line under it. Under a `tests:` other than *at the
plan end*, delete the test slice and the dotted edges that owe it.

Phasing diagram: the slices, the fork, and what each step has to show before the next begins.

```mermaid
flowchart TB
  %% tracker
  ST["📍 state · 2026-01-01<br/>branch: feat/topic @ 0000000, not pushed<br/>deployed: nothing yet<br/>next: S1.2<br/>blocked: nothing<br/>parked: nothing"]

  subgraph SL1["Slice 1 · US1 · what it delivers"]
    S1.1["✅ S1.1 what an observer could tell<br/>went on: check green and the story walked here · a1b2c3d · #41<br/>run: steered a rename after lint refused it"]
    S1.2["▶ S1.2 the outcome · US1<br/>done when: the acceptance criterion, observed"]
  end

  subgraph SL2["Slice 2 · US2 · the api arm"]
    S2.1["⬜ S2.1 the outcome<br/>done when: the command exits 0"]
  end

  subgraph SL3["Slice 3 · US2 · the web arm"]
    S3.1["⏸ S3.1 the outcome<br/>done when: the command exits 0<br/>paused: the registrar, for the DNS record, asked 2026-01-01"]
    S3.2["✖ S3.2 the outcome<br/>dropped: the library cannot stream · D14, replaced by S3.2b"]
    S3.2b["⬜ S3.2b the outcome that replaces it<br/>done when: the command exits 0"]
  end

  subgraph SL4["Slice 4 · US1, US2 · the tests"]
    S4.1["⬜ S4.1 the arms joined, every named case a test, the broken ones repaired<br/>done when: the full check exits 0 on the joined branch"]
  end

  subgraph SL5["Slice 5 · US1, US2 · the check on dev · 👤"]
    G5{"the person: does it do what US2 says?"}
    S5.1["⬜ S5.1 the person looked at dev · 👤 · US2<br/>done when: their word, quoted"]
  end

  ST ~~~ S1.1
  S1.1 -->|"then"| S1.2
  S1.2 -->|"arm A · api"| S2.1
  S1.2 -->|"arm B · web"| S3.1
  S3.1 --> S3.2 --> S3.2b
  S2.1 -->|"arm A joins"| S4.1
  S3.2b -->|"arm B joins"| S4.1
  S4.1 --> G5
  G5 -->|"yes"| S5.1
  G5 -->|"no: back to the plan"| S3.2b
  S1.2 -.->|"owes: its tests"| S4.1
  S2.1 -.->|"owes: its tests"| S4.1
  S3.2b -.->|"owes: its tests"| S4.1

  classDef done stroke:#4a9d5f,stroke-width:2px,fill:#7f7f7f1a
  classDef next stroke:#d08b28,stroke-width:2px,fill:#7f7f7f1a
  classDef todo stroke-dasharray:4 3
  classDef state stroke:#8a8a8a,stroke-width:1px,fill:#7f7f7f12
  class S1.1 done
  class S1.2 next
  class S2.1,S3.1,S3.2,S3.2b,S4.1,S5.1 todo
  class ST state
```

mandate: run through · one for the plan · delegated · opus · tests at the plan end · verify off

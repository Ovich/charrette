# The tracker's skeleton

Copy the block, replace every phrase, delete what the plan has no use for. The caption
line above the fence stays: `aiview mermaid-check` warns without one.

Phasing diagram: the slices, the fork, and what each step has to show before the next begins.

```mermaid
flowchart TB
  %% tracker
  ST["📍 state · 2026-01-01<br/>branch: feat/topic @ 0000000, not pushed<br/>deployed: nothing yet<br/>next: S1.1<br/>blocked: nothing<br/>parked: nothing"]

  subgraph SL1["Slice 1 · US1 · what it delivers"]
    S1.1["✅ S1.1 what an observer could tell<br/>went on: suite green here · a1b2c3d · #41<br/>run: steered a rename after lint refused it"]
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

  subgraph SL4["Slice 4 · US1, US2 · the check on dev · 👤"]
    S4.1["⬜ S4.1 the arms joined, and what they owe each other<br/>done when: pnpm test:e2e exits 0 on the joined branch"]
    G4{"the person: does it do what US2 says?"}
    S4.2["⬜ S4.2 the person looked at dev · 👤 · US2<br/>done when: their word, quoted"]
  end

  ST ~~~ S1.1
  S1.1 -->|"then"| S1.2
  S1.2 -->|"arm A · api"| S2.1
  S1.2 -->|"arm B · web"| S3.1
  S3.1 --> S3.2 --> S3.2b
  S2.1 -->|"arm A joins"| S4.1
  S3.2b -->|"arm B joins"| S4.1
  S4.1 --> G4
  G4 -->|"yes"| S4.2
  G4 -->|"no: back to the plan"| S3.2b
  S1.1 -.->|"owes: the two specs it broke"| S4.1

  classDef done stroke:#4a9d5f,stroke-width:2px,fill:#7f7f7f1a
  classDef next stroke:#d08b28,stroke-width:2px,fill:#7f7f7f1a
  classDef todo stroke-dasharray:4 3
  classDef state stroke:#8a8a8a,stroke-width:1px,fill:#7f7f7f12
  class S1.1 done
  class S1.2 next
  class S2.1,S3.1,S3.2,S3.2b,S4.1,S4.2 todo
  class ST state
```

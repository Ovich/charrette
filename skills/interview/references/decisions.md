# Decisions rows

The core every decisions table shares, whatever document holds it:

```text
| id | Decision | Depends on | Status | Source |
```

- **id**: `D<n>`, one series per document.
- **Decision**: the decision, in one sentence.
- **Depends on**: the ids it rests on, or nothing.
- **Status**: `agreed` · `open` · `deferred` · `ruled (by whom)` · `for the person`.
- **Source**: where it was settled: `Q<n>` (a question), `#<seq>` (an agreement on the board),
  the person's words, or `agent, delegated`.

A document adds its own columns after these, never between them: a brainstorm board adds
`Log`, a plan adds `Kind` and `Slice`.

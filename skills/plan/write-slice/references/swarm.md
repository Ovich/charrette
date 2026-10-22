# Slices in swarm mode

Read when the plan's mandate says `mode: swarm`. Everything else in this skill holds.

- **The cut is the `write-plan` skill's `references/swarm.md`**: one slice per seat per phase,
  no fork proof, no blocker inside a phase.
- **A phase's slices are cut when it is about to open**, the first phase's with the plan. Read
  first what the phases before it left: their merges, the agreements and findings on the
  board's thread (the `swarm` skill's `thread <phase>`), each seat's report. A slice says what
  it builds on from them. A finding that changes the phase's goal is a pause, not a recut.
- **The heading names the seat and its role**: `P2.S3 · dev3 · tests · <title>`.
- **The modules table marks every file the slice will edit, `interface` or `inside`.** Its seat
  declares exactly these when it joins the board, so the others see from the start who touches
  what:

  ```text
  // <module> · deepened
  src/<module>/index.ts   interface   its export gains <name>; slices that import it rebase
  src/<module>/store.ts   inside
  ```

  *Interface* when another slice imports it or calls through it, *inside* when only this slice
  reads it. A file another slice of the phase also edits is marked in both documents; the two
  seats settle it on the board.

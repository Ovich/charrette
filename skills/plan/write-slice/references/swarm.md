# Slices in swarm mode

Read when the plan's mandate says `mode: swarm`. Everything else in this skill holds.

- **The cut is the `write-plan` skill's `references/swarm.md`**: no fork proof, blockers only for
  a merged result.
- **Every slice document exists before the run.** They are written one after another once the
  plan is approved, the test slice of `tests: at the plan end` excepted; none is drawn as slices
  come up.
- **The modules table marks every file the slice will edit, `interface` or `inside`.** Its runner
  declares exactly these when it joins the board, so the others see from the start who touches
  what:

  ```text
  // <module> · deepened
  src/<module>/index.ts   interface   its export gains <name>; slices that import it rebase
  src/<module>/store.ts   inside
  ```

  *Interface* when another slice imports it or calls through it, *inside* when only this slice
  reads it. A file another slice also edits is marked in both documents; the two runners settle
  it on the board.

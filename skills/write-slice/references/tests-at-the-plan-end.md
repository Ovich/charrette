# Slice documents under tests at the plan end

What the implementer does with them is the `execute-slice` skill's `references/tests-at-the-plan-end.md`.

## Every slice that is not the test slice

- **The acceptance criteria open with the proof that stands in for its tests**: a story of the verify skill, a walk of the screen, or a command with the output expected of it. No criterion says a test passes.
- **Its check is format, lint and types**, as a command.
- **The seams under test stay, every case named at planning against the design**, headed *owed to `<the test slice's node id>`*.
- **Test support gets no block here**: it belongs to the test slice.

## The test slice's document

- **Written when the orchestrator asks for it, once every other slice is done.** Never at planning.
- **What this delivers**: the suite as the plan's suite section describes it, over the code as the slices left it.
- **Blocked by**: every other slice.
- **Acceptance criteria**: every named case exists as a test at its seam; every test listed as broken is repaired, none skipped or deleted; each test guarding new behaviour was seen failing once; the full check exits 0.
- **Context carries, verbatim, every slice's seams-under-test blocks as the run left them**, each naming its slice document and date, then the plan's suite section, then the decisions the run added. From the finished code, only where each seam's entry now lives.
- **The modules are the test support**, one block each from the plan, and one block per module under test, state unchanged, its interface as its slice document signed it or as a decision of the run amended it. A module that cannot be tested through its seam is a finding.
- ***Tests the slices broke***, a heading of its own: every test the returns and pull requests listed, by name, with the slice that broke it.
- **Not in this slice**: any behaviour.

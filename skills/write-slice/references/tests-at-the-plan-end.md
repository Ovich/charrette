# Slice documents under tests at the plan end

The slices write code only, and the last slice before the plan's `👤` checks writes every
test. What each one does is the `execute-slice` skill's `references/tests-at-the-plan-end.md`.

## Every slice that is not the test slice

- **The acceptance criteria open with the proof that stands in for its tests**: a story of the verify skill, a walk of the screen, or a command with the output expected of it. The orchestrator re-runs it to tick the step, and dispatches no slice without one. No criterion says a test passes.
- **Its check is format, lint and types**, as a command. The suite's run is not its check: a test pinning the old shape is expected to break, and is listed.
- **The seams under test stay, every case named**, headed *owed to `<the test slice's node id>`*. They are written now, against the design, because they are what the test slice writes from: a case named after the code exists describes the code.
- **Test support gets no block here.** A fixture is a module, and it belongs to the slice that writes the tests.

## The test slice's document

- **Written last, once every other slice's document exists**, and read again against them before its dispatch: a slice amended mid-run moves its cases.
- **What this delivers**: the suite as the plan's suite section describes it, over the code as the slices left it.
- **Blocked by**: every other slice.
- **Acceptance criteria**: every named case exists as a test at its seam; every test a slice listed as broken is repaired, none skipped or deleted; each test guarding new behaviour was seen failing once; the full check exits 0.
- **Context carries, verbatim, every slice's seams-under-test blocks**, each naming its slice document and date, then the plan's suite section. Carried, not linked: the agent works from this document alone.
- **The modules are the test support**, one block each from the plan, and one block per module under test, state unchanged, its interface as its own slice document signed it. The test slice designs no production module: one it cannot test through its seam is a finding.
- **The broken tests are not known when this is written.** The document holds the heading *Tests the slices broke*, empty, and the orchestrator fills it from each slice's return before the dispatch.
- **Not in this slice**: any behaviour. A case the code does not meet is a small fix with its failing test as evidence, or a report.

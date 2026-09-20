# The testing instructions a slice carries

**The mandate's `tests` answer decides the block, and every slice document carries it
verbatim in its *Tests* section, its commands filled for the project.** Nothing else about
tests is written anywhere else in the document.

## at the plan end

Two kinds of document.

**Every slice that is not the test slice.** Its acceptance criteria open with the proof
that stands in for its tests: a story of the verify skill, a walk of the screen, or a
command with the output expected of it. No criterion says a test passes. Its check is
format, lint and types. Its seams under test stay, every case named at planning against
the design, headed *owed to `<the test slice's node id>`*. Test support gets no block.

```markdown
**Tests: at the plan end. This slice writes none; `<the test slice's node id>` writes them.**

- Write no test, and touch none. While working, run format, lint and types only.
- At the end, run the suite once and list every test the change breaks, by name, in the pull request and in the return. Not repaired, not skipped, not deleted. Any other failure is this slice's to fix.
- Run the proof in the acceptance criteria once, and return its output.
- Leave every entry this document names exported as signed.

The slice's check: `<format, lint and types>` · the suite: `<command>` · the proof: `<command, story or walk>`
```

**The test slice.** Its document is written when the orchestrator asks for it, once every
other slice is done, never at planning.

- *What this delivers*: the suite as the plan's suite section describes it, over the code as the slices left it.
- *Blocked by*: every other slice.
- *Acceptance criteria*: every named case exists as a test at its seam; every test listed as broken is repaired, none skipped or deleted; each test guarding new behaviour was seen failing once; the full check exits 0.
- *Context* carries, verbatim, every slice's seams-under-test blocks as the run left them, each naming its slice document and date, then the plan's suite section, then the decisions the run added. From the finished code, only where each seam's entry now lives.
- *The modules* are the test support, one block each from the plan, and one block per module under test, state unchanged, its interface as its slice document signed it or as a decision of the run amended it. A module that cannot be tested through its seam is a finding.
- *Tests the slices broke*, a heading of its own: every test the returns and pull requests listed, by name, with the slice that broke it.
- *Not in this slice*: any behaviour.

```markdown
**Tests: at the plan end. This is the test slice.**

- Write from the cases this document carries, never from the code.
- Repair the tests listed under *Tests the slices broke*, then write the owed ones, at the seams named, running each test file alone.
- See each test that guards new behaviour fail once: break the line it guards, run that test alone, restore the line.
- Where the code disagrees with a named case: a small bug is fixed in place, in its own commit, the failing test as its evidence. Anything that changes a decision is a stop and a report. Never bend a case to pass.
- Run the full check once, at the end, and again only after a fix. Land with it at 0.

One test file: `<command>` · one end-to-end spec: `<command>` · the full check: `<command>`
```

## at the slice end

```markdown
**Tests: at the slice end.**

- Write the production code first. While writing it, run types and the tests of the files you touch, adjusted only where the slice changes a shape.
- Then write the tests this document names, at the seams it names, running each test file alone.
- See each test that guards new behaviour fail once: break the line it guards, run that test alone, restore the line.
- Run the slice's check once, at the end, and again only after a fix. Land with it at 0.
- Never weaken a test to make a suite green: not loosened, not deleted, not skipped.

One test file: `<command>` · one end-to-end spec: `<command>` · the slice's check: `<command>`
```

## commit only at green

```markdown
**Tests: commit only at green.**

- One named case at a time: the test, its failure for the reason the case names, the code that passes it, that test file run alone.
- Commit only with types and the tests at this slice's seams green.
- An attempt that will not go green is dropped back to the last commit, never patched forward.
- No refactor phase. One tidy inside the module before the last commit.
- Run the slice's check once, at the end, and again only after a fix. Land with it at 0.
- Never weaken a test to make a suite green: not loosened, not deleted, not skipped.

One test file: `<command>` · the tests at this slice's seams: `<command>` · the slice's check: `<command>`
```

## commit per phase (red/green/refactor)

```markdown
**Tests: commit per phase (red/green/refactor).**

- One named case at a time, three commits: the failing test, its message opening `[RED]`; the code that passes it; the refactor, inside the module. Each is judged on types and the tests at this slice's seams, that test file run alone for the red.
- The red fails for the reason the case names; a red on a missing import is fixed before it is committed.
- Push a `[RED]` commit only with the green that follows it.
- Run the slice's check once, at the end, and again only after a fix. Land with it at 0.
- Never weaken a test to make a suite green: not loosened, not deleted, not skipped.

One test file: `<command>` · the tests at this slice's seams: `<command>` · the slice's check: `<command>`
```

# The testing prompt

The slice runner knows nothing about testing; what it does about tests is only what its brief
says. The orchestrator puts one of these in the brief, its commands filled for the project, and
copies it from here rather than rewriting it. The seams and cases are the slice document's.

## at the plan end

Every slice but the test slice:

```markdown
**Tests**: write none and touch none. At the end, run the suite once (`<command>`) and list every test your change breaks, by name, in the return; do not repair, skip or delete them. The proof in your acceptance criteria is not a test: whatever drives it is scratch, outside the repository, never under a name the suite collects.
```

The test slice:

```markdown
**Tests**: write the cases this document names at the seams it names, from the document, not the code. Repair the tests listed as broken first. A small bug the tests expose is fixed in its own commit; anything that changes a decision is a stop. Never bend a case to pass. Land with `<the full check>` at 0.
```

## at the slice end

```markdown
**Tests**: code first, then the tests this document names, at its seams. Never weaken a test to go green. Land with `<the slice's check>` at 0.
```

## none

```markdown
**Tests**: write none. Run `<the slice's check>` at the end and return its output.
```

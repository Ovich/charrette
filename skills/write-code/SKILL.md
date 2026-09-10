---
name: write-code
description: Use when about to write or change code, as the practice a slice, a task or a request in chat is carried out with. Produces the test, the code and the runs as evidence. Not for deciding what to build.
---

# Write code

The repository's `AGENTS.md` binds. Read it before the first edit: a runner that does not
inject it never sees it otherwise.

Code here is written test-first, the TDD cycle: a failing test, the code that passes it,
then the next one.

<rules>

- **Test first.** Write the test that proves the behaviour, run it, watch it fail, then
  write the code that makes it pass. A test that never failed proves nothing.
- **Two commits**: the test, then the implementation, and the second does not touch the
  test file. That is what lets anyone check afterwards that the test was not fitted to
  the code.
- **Never weaken a test to make a suite green**: not loosened, not deleted, not skipped.
  The one skip allowed is a case that cannot run until something outside the repository
  exists, marked with what it waits on, and the slice that gets there unskips it.
- **Report the runs, not the conclusion.** The failing run and the passing run, with what
  they said. "It works" is not evidence.

</rules>

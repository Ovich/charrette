# Tests at the plan end

The plan's last slice before its checks is the test slice. The slice document says which of the two this slice is.

## A slice that is not the test slice

- **Write no test, and touch none.** The production code, then format, lint and types at 0.
- **Run the suite as it stands and list every test the change breaks**, by name, in the pull request and in the return, as owed to the test slice. Not repaired, not skipped, not deleted. A failure that is not a test pinning the old shape is this slice's to fix.
- **Run the proof the document names** in place of the tests, a verification story, a walk or a command, and return it as evidence: it is all that says this slice works until the test slice runs.
- **Leave every entry the document names exported as signed**: the test slice crosses there, and a seam closed now is reworked at the end.

## The test slice

- **Write from the cases the slice documents and the plan's suite section name, never from the code.** A test read off the code asserts what the code does, its bugs included.
- **Repair the tests the slices listed as broken**, then write the owed ones, at the seams named.
- **See each test that guards new behaviour fail once**, by breaking the line it guards and restoring it.
- **Where the code disagrees with a named case**: a small bug is fixed in place, in its own commit, the failing test as its evidence. Anything that changes a decision is a stop and a report. A case is never bent to pass.
- **Land with the full check at 0**: the pull request's check may have been red since the first slice, and goes green here.

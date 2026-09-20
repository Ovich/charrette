# Tests at the plan end

The slice document says which of the two this slice is.

## A slice that is not the test slice

- **Write no test, and touch none.** While working, run format, lint and types only.
- **At the end, run the suite once and list every test the change breaks**, by name, in the pull request and in the return. Not repaired, not skipped, not deleted. Any other failure is this slice's to fix.
- **Run the proof the document names once**, in place of the tests, and return its output.
- **Leave every entry the document names exported as signed.**

## The test slice

- **Write from the cases the document carries, never from the code.**
- **Repair the tests listed as broken**, then write the owed ones, at the seams named, running each test file alone.
- **See each test that guards new behaviour fail once**: break the line it guards, run that test alone, restore the line.
- **Where the code disagrees with a named case**: a small bug is fixed in place, in its own commit, the failing test as its evidence. Anything that changes a decision is a stop and a report. Never bend a case to pass.
- **Run the full check once, at the end**, and land with it at 0.

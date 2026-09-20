# Commit only at green

- **One named case at a time**: the test, its failure for the reason the case names, the code that passes it, that test file run alone.
- **Commit only with types and the tests at the slice's seams green.**
- **An attempt that will not go green is dropped back to the last commit**, never patched forward.
- **No refactor phase.** One tidy inside the module before the last commit.
- **Run the slice's check once, at the end**, and land with it at 0.

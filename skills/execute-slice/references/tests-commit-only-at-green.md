# Commit only at green

- **One named case at a time**: the test, its failure for the reason the case names, the code that passes it.
- **Commit only with the suite green.**
- **An attempt that will not go green is dropped back to the last commit**, never patched forward.
- **No refactor phase.** One tidy inside the module before the last commit.
- **Land with the check at 0.**

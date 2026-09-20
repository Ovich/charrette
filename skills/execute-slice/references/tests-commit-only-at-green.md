# Commit only at green

- **One named case at a time**: the test, its failure for the reason the case names, the code that passes it.
- **Commit only with the suite green.** Every commit is a state to fall back to.
- **An attempt that will not go green is dropped back to the last commit**, never patched forward: the second fix on top of a wrong first one is where the hour goes.
- **No refactor phase.** One tidy inside the module before the last commit.
- **Land with the check at 0.**

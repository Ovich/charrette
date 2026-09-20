# Commit per phase (red/green/refactor)

- **One named case at a time, three commits**: the failing test, its message opening `[RED]`; the code that passes it; the refactor, inside the module, the suite green before and after.
- **The red fails for the reason the case names**; a red on a missing import is fixed before it is committed.
- **Push a `[RED]` commit only with the green that follows it.**
- **Land with the check at 0.**

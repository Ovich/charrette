# Commit per phase (red/green/refactor)

- **One named case at a time, three commits**: the failing test, its message opening `[RED]`; the code that passes it; the refactor, inside the module. Each is judged on types and the tests at the slice's seams, that test file run alone for the red.
- **The red fails for the reason the case names**; a red on a missing import is fixed before it is committed.
- **Push a `[RED]` commit only with the green that follows it.**
- **Run the slice's check once, at the end**, and land with it at 0.

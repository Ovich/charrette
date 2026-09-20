# Commit per phase (red/green/refactor)

- **One named case at a time, three commits**: the failing test, its message opening `[RED]`; the code that passes it; the refactor, inside the module, the suite green before and after.
- **A `[RED]` commit is pushed only with the green that follows it**: alone on the branch it fails the pull request's check.
- **The red fails for the reason the case names.** A test red on a missing import proves nothing: fix it before committing it.
- **Land with the check at 0.**

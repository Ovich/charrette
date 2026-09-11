---
name: write-code
description: Use when about to write or change code, as the practice a slice, a task or a request in chat is carried out with. Produces the test, the code and the runs as evidence. Not for deciding what to build.
---

# Write code

**Read the repository's `AGENTS.md` before the first edit**; it binds.

**The design aims at, when applicable:**

| | |
|---|---|
| **simplicity** | DRY · KISS · YAGNI |
| **responsibility** | SRP · High Cohesion |
| **extension** | OCP · LSP · ISP |
| **dependencies** | DIP · Low Coupling · Law of Demeter |

**When two of them pull against each other, the smaller change wins**: an abstraction earns its place with the second caller, not the first.

<rules>

- **Test first.** Write the test that proves the behaviour, run it, watch it fail, then write the code that makes it pass.
- **Two commits**: the test, then the implementation, and the second does not touch the test file.
- **Never weaken a test to make a suite green**: not loosened, not deleted, not skipped. The one skip allowed is a case that cannot run until something outside the repository exists, marked with what it waits on, and the slice that gets there unskips it.
- **Report the runs, not the conclusion**: the failing run and the passing run, with what they said.

</rules>

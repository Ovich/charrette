# Tests at the slice end

- **Write the production code first.** Validate it with the project's check and the suite as it stands, adjusted only where the slice changes a shape.
- **Then write the tests the document names**, at the seams it names, in one pass.
- **See each test that guards new behaviour fail once**, by breaking the line it guards and restoring it: written after the code, it has never been red.
- **Land with the check at 0.**

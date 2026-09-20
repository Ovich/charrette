# Tests at the slice end

- **Write the production code first.** While writing it, run types and the tests of the files you touch, adjusted only where the slice changes a shape.
- **Then write the tests the document names**, at the seams it names, running each test file alone.
- **See each test that guards new behaviour fail once**: break the line it guards, run that test alone, restore the line.
- **Run the slice's check once, at the end**, and land with it at 0.

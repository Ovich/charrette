# Code design checklist

The sourced rule set behind `code-design-review`, one section per lens. Each rule is
a **checkable assertion** — a one-line *smell* a reviewer can spot in the code —
followed by its `source`. Language-agnostic: "class" means class, module, struct,
package, or file, whichever the language has.

Three standing rules for every lens:

- **Don't re-report what the project's linter, type checker, or formatter already
  catches.** The value here is the structural judgment those tools can't make.
- **Report over-application as loudly as under-application.** Each principle below
  ends with its **counterweight** — the failure mode of applying it too eagerly.
  A finding of "delete this abstraction" is worth as much as "extract one."
- **Name the cost, not the principle.** Every finding says which future change this
  makes expensive, or which edit will break something distant. A rule number is not
  a cost.

---

## Lens 1 — Simplicity (DRY · KISS · YAGNI)

### DRY — Don't Repeat Yourself

The rule is about *knowledge*, not characters: "every piece of system knowledge
should have one authoritative, unambiguous representation."
`https://www.artima.com/intv/dry.html`

- **One rule, one home.** A business rule, magic constant, validation, status string,
  or format expressed in 2+ places. Smell: the same threshold / regex / enum-ish
  string literal grepped in several modules; a rule changed in one place and missed
  in another (check the diff for exactly this). `https://www.artima.com/intv/dry.html`
- **Knowledge duplicated across artifacts, not just code** — a shape declared in the
  schema, again in a type, again in a validator, again in a fixture, all
  hand-maintained and free to drift. `https://www.artima.com/intv/dry.html`
- **Parallel structures that must be edited together** — add a case to enum A and you
  must remember switch B, map C, and doc D. Shotgun surgery: one logical idea spread
  across many classes.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **Copy-paste with a small edit** — the most expensive kind, because the diff between
  the copies *is* the undocumented rule.

**Counterweight — duplication is cheaper than the wrong abstraction.** Two blocks
that merely *look* alike and change for different reasons are not duplication;
merging them couples unrelated callers. Abstract at the third occurrence, once the
shared thing is obvious and stable. Smell of the over-applied version: a "shared"
helper carrying boolean/mode flags and `if` branches to serve divergent callers —
report that, and say to inline it back.
`https://kentcdodds.com/blog/aha-programming`

### KISS — Keep It Simple

Kent Beck's rules of simple design, in priority order: passes the tests, reveals
intention, no duplication, **fewest elements**. Anything that doesn't serve the first
three should go. `https://martinfowler.com/bliki/BeckDesignRules.html`

- **The code doesn't reveal its intention** — you must simulate it line by line to
  learn what it does. Smell: deep nesting, a boolean parameter that flips the meaning
  of a function, a condition needing a comment to be readable.
  `https://martinfowler.com/bliki/BeckDesignRules.html`
- **Elements that earn nothing** — a wrapper that only forwards, a layer that only
  renames, a class holding one method called once, a config knob with one value ever
  used. `https://martinfowler.com/bliki/BeckDesignRules.html`
- **A clever construct where a plain one reads better** — nested ternaries, dense
  one-liner chains, reflection or metaprogramming standing in for three explicit
  cases.
- **Special-case creep** — a function whose body is mostly guards for situations that
  a better-chosen signature or data shape would make impossible.

**Counterweight — "simple" is not "short."** Don't report a well-named extraction as
excess indirection, and don't recommend collapsing distinct concepts into one
function to cut line count.

### YAGNI — You Aren't Gonna Need It

"Building presumptive features costs the work itself, delays the features that pay
now, and adds complexity that slows everything else."
`https://martinfowler.com/bliki/Yagni.html`

- **Generality with exactly one caller and no second one in sight** — a config system,
  strategy registry, or plugin point built for a variation that does not exist.
  `https://martinfowler.com/bliki/Yagni.html`
- **Parameters, options, or branches nothing passes** — every caller uses the default.
  Smell: a flag argument that is `false` at every call site.
- **Dead or speculative code kept "for later"** — commented-out blocks, unreferenced
  exports, a v2 path behind a flag nobody flips. Version control remembers it; delete.
- **Premature layering** — an abstract base, repository interface, or event bus
  introduced before a second implementation or consumer exists.
  `https://martinfowler.com/bliki/Yagni.html`

**Counterweight — YAGNI is about presumptive *features*, not about skipping design.**
Don't use it to argue against error handling, tests, naming, or a seam that a
concrete, already-scheduled requirement needs. `https://martinfowler.com/bliki/Yagni.html`

---

## Lens 2 — Responsibility (SRP · High Cohesion)

### SRP — Single Responsibility

"Each software module should have one and only one reason to change" — and reasons to
change are *people*: different stakeholders asking for different things.
`https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html`

- **Two stakeholders can force a change to the same class.** Smell: business rules and
  persistence, or policy and transport, edited in one file — the DBA's change and the
  accountant's change collide.
  `https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html`
- **Divergent change** — a class that gets modified in different ways for different
  reasons. Look at its recent history: unrelated commit subjects touching one file is
  direct evidence.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **The purpose needs "and" to state** — "validates the order **and** emails the
  customer." A name you can't write without a conjunction is the finding.
- **A vague name covering anything** — `Manager`, `Handler`, `Util`, `Helper`,
  `Service`, `Data`, `Common`. A name that excludes nothing describes nothing.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **A function mixing decision and effect and I/O** at one level — the pure rule can't
  be tested without the database.

### High Cohesion

Cohesion is how closely a module's data and methods relate to each other. Test: is
everything in it directly described by its name?
`https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`

- **A subset of methods and fields that only talk to each other** and never to the
  rest — that subset is a class trying to be born. Extract it.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **Grab-bag modules** — `utils`, `helpers`, `common`, `misc`: unrelated functions
  sharing a file only because none had a home. Move each next to its one real user.
- **Things that change together live apart**; things that change independently are
  bolted together. Colocation by *reason to change* beats grouping by technical kind
  (all controllers here, all types there).
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **Size as a signal, not a rule** — a very long file or function is a prompt to look
  for a seam, never a finding on its own. Split by responsibility, not by line count.

**Counterweight — don't shatter a cohesive unit.** Extracting a helper used once, by
one caller, that must be read together with its caller to make sense, lowers cohesion
while looking like progress.

---

## Lens 3 — Extension (OCP · LSP · ISP)

### OCP — Open/Closed

"You should be able to extend the behavior of a system without having to modify that
system."
`https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html`

- **Adding a variant means editing existing, working code** — a `switch`/`if-else` on
  a type tag, kind, or role that must be found and extended in several places for one
  new case. The finding is the *repetition* of that switch, not its existence.
  `https://blog.cleancoder.com/uncle-bob/2014/05/12/TheOpenClosedPrinciple.html`
- **Behavior varies by consulting a type** — `if (isinstance(x, Foo))` /
  `x.type === "premium"` where polymorphism or a lookup table would let a new case
  arrive without touching the old path.
- **A stable module edited on every feature** — check history: if one file changes in
  nearly every PR, its extension points are in the wrong place.

**Counterweight — closing against a variation that never comes is YAGNI wearing a
suit.** One `switch` in one place is fine and often clearer than a plugin
architecture; only make the seam once the second and third variants are real.
`https://martinfowler.com/bliki/Yagni.html`

### LSP — Liskov Substitution

"Let φ(x) be a property provable about objects x of type T. Then φ(y) should be true
for objects y of type S where S is a subtype of T." Substituting a subtype must not
break a caller written against the supertype.
`https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf`

- **An override that throws, no-ops, or returns a sentinel** for part of the contract
  — `ReadOnlyList.add()` raising `Unsupported`. The subtype is announcing it isn't one.
  `https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf`
- **An override strengthening what it demands or weakening what it delivers** —
  narrower accepted inputs, extra ordering requirement, wider or nullable return,
  a new exception type callers don't catch.
  `https://www.cs.cmu.edu/~wing/publications/LiskovWing94.pdf`
- **Callers that type-check their way around a subtype** — an `if (x instanceof B)`
  special case in code written against A is the polymorphism failing in public.
- **Inheritance used for code reuse where the "is-a" is false** — a subclass that
  inherits a parent's fields but violates its invariants. Prefer composition.

### ISP — Interface Segregation

"Keep interfaces small so that users don't end up depending on things they don't need."
`https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html`
Original: `https://www.cs.utexas.edu/~fares/papers/ISP.pdf`

- **Implementors forced to supply methods they have no meaning for** — the stubs and
  `NotImplemented`s are the evidence.
  `https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html`
- **A consumer depending on a wide type to use two members of it** — take the narrow
  interface (or just the function) instead, so the consumer stops recompiling and
  re-mocking on unrelated changes.
- **Test setup as the tell** — a mock that must stub eight methods to exercise one is
  the interface telling you it's too fat.
- **A "god" interface** aggregating unrelated capabilities so callers can reach
  everything from one handle.

**Counterweight — one interface per method is its own disease.** Split along the lines
real consumers actually use; if every implementor implements the whole thing and every
consumer uses most of it, it's already right-sized.

---

## Lens 4 — Dependencies (DIP · Low Coupling · Law of Demeter)

### DIP — Dependency Inversion

"Depend in the direction of abstraction. High level modules should not depend upon low
level details." `https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html`
Original: `https://www.cs.utexas.edu/~downing/papers/DIP-1996.pdf`

- **Policy importing a mechanism** — domain or business logic importing the SQL client,
  HTTP library, cloud SDK, or file system directly. Swapping the mechanism edits the
  policy. `https://blog.cleancoder.com/uncle-bob/2020/10/18/Solid-Relevance.html`
- **Dependencies constructed inside the thing that uses them** — `new SqlConnection(...)`
  in a business method, a module-level singleton client read at import. The caller can
  no longer choose, and neither can a test.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **Import direction points inward-to-outward** — an inner layer naming an outer one
  (domain importing controllers, core importing the web framework). Cycles between
  modules are the acute form.
- **The abstraction is owned by the low-level side** — an interface that mirrors the
  vendor's API one-for-one isn't an abstraction, it's a rename. The consumer should
  define the interface it wants in its own vocabulary.
- **Untestable without infrastructure** — needing a live database or network to
  exercise a pure rule is the diagnostic.

**Counterweight — an interface with one implementation and no seam it enables is
indirection, not inversion.** It costs a jump-to-definition on every read. If nothing
substitutes it — not a test double, not a second backend, not a boundary you must
defend — say to collapse it.

### Low Coupling

Coupling is how much modules must know about each other's internals; the cost is that
changes ripple. `https://martinfowler.com/ieeeSoftware/coupling.pdf`

- **Reaching into another module's internals** — private-by-convention fields,
  `_internal` attributes, a class's data manipulated from outside instead of asking it
  to act. Inappropriate intimacy.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **Feature envy** — a method more interested in another object's data than its own;
  it belongs over there, next to the data it keeps asking for.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **A leaky return type** — handing back a database cursor, ORM entity, raw framework
  response, or mutable internal collection, so every caller is now coupled to that
  choice. Return a type you own.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **Shared mutable state as the interface** — globals, singletons, or a shared dict
  two modules coordinate through. Nothing in the signatures records the dependency.
- **Temporal coupling** — call A must precede call B or the object misbehaves, and
  only a comment says so. Fold the order into the API.
- **Wide blast radius on a small change** — if the diff for a one-line behavior change
  touches five modules, the coupling is the finding.
  `https://martinfowler.com/ieeeSoftware/coupling.pdf`

### Law of Demeter

Only talk to your immediate friends: a method should call methods on its own object,
its parameters, objects it creates, and its direct components — not on objects those
hand back. `https://www2.ccs.neu.edu/research/demeter/papers/law-of-demeter/oopsla88-law-of-demeter.pdf`

- **Reaching through an intermediate to get work done** —
  `repository.innerService.findClaims(customer)`, `order.getCustomer().getAddress().getZip()`.
  The caller is now coupled to the whole chain's shape; ask the direct neighbor for
  what you want instead.
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **Ask-then-decide-then-tell** — pulling an object's state out, branching on it, and
  writing a result back. Move the decision to the object that owns the data
  (Tell, Don't Ask / Information Expert).
  `https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`
- **A test that must build three nested objects** to call one method — the setup depth
  is the chain depth.

**Counterweight — don't count the dots.** Fluent builders, chained collection
pipelines, and navigation of a plain data structure you own are not violations; the
law is about *behavioral* dependence on strangers. And delegation has a price: if
removing a chain means writing a stack of forwarding methods against a stable type,
say so and leave it.
`https://learn.microsoft.com/en-us/archive/msdn-magazine/2008/october/patterns-in-practice-cohesion-and-coupling`

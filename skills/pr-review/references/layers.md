# The layers: jurisdiction, the brief, the return

## Jurisdiction: who owns a question

Two agents that cannot see each other, given the same question, both answer it in
full. The cost is not one duplicated file read: it is one agent's entire
investigation run twice. So jurisdiction is settled **before** dispatch, by one rule
and one table, and **no two agents in a review ever hold the same question**: that
holds between layers and inside one, if a layer is ever split.

**The altitude rule.** A layer owns the questions answerable at its altitude without
descending. L2 never reads function bodies; L1 never reasons about deployment; L3
reads the model, not the code that queries it.

**The seam table**: the known cases where altitudes touch:

| Seam | Owner | Why |
|---|---|---|
| Function in the wrong module | L2 | Placement is organisation |
| Type mirroring a DB column | L3 | The schema is the truth |
| Consumers in another repo | L4 | Blast radius owns reach |
| Race inside a function body | L1 | Visible at line altitude |
| Migration deploy/execution order | L4 | A deploy question, not a model question |
| Coverage of the stated behaviour | L5 | An intent question |
| README, catalogs, discovery surfaces | L4 | They are consumed surfaces; L5 checks claims against the code, not the catalog |
| Duplicated content within one file / between files | L1 / L2 | Same evidence, two altitudes: split it before both agents find it |
| Test code quality / test placement | L1 / L2 | Tests are just code at those altitudes |
| Big file: real change or churn? | You, before dispatch | Established once, handed to every brief as fact |

A seam the table does not list is yours to assign before dispatch, and the winning
brief says it was assigned. A defect that genuinely spans altitudes: a transaction
bug touching code, model and deploy: comes back as facets, one per layer, and joins
into one finding at merge, citing every contributing return.

## The brief

**A brief contains exactly four things, in this order:** where to read the diff; the
layer's jurisdiction: its row of the layer table, plus any seam assigned to it; the
facts you have already established, given as facts; the output contract.

The third slot is what saves the most time, and it is the one most often left empty.
Anything two layers would otherwise derive independently: the scope script's output
(base, head, file list), which branch the sibling repos are on, whether a 300-line fixture diff is two real lines under an
encoding rewrite: **you establish once and hand over as a stated fact.** A
normalize-and-diff that costs you twenty seconds costs an agent minutes, and with five
agents you would be paying for it five times.

**A brief names a surface, not a suspicion.** *"Check the FK on the new collection table
against how the sync deletes its parent"* is a surface. *"This is the highest-value thing
in the diff"* is your hypothesis, and an agent handed a hypothesis spends its budget
confirming it: including when it is wrong, which is exactly when you needed the budget
spent elsewhere.

Sizing follows from this: a brief with more numbered surfaces than its layer has
jurisdiction for is two agents' work in one and will run like it. Splitting a layer is
allowed, on a huge diff, L1 by area, say, but the sub-briefs obey the same
disjointness rule as everything else.

## The return

A layer reports **evidence and consequence, never severity**: ranking needs the whole
picture, and a layer has only its own altitude. Every finding cites the `file:line` of
the evidence, both sides where there are two. *"Nothing in jurisdiction"* is a valid
return and is recorded as such. Expect one layer to raise what another refutes: that
is the design working, and the refutation is worth as much as the finding: it becomes
a *checked and clear* entry.

**Separate what this PR introduces from what it inherits.** A defect that predates the
branch is noted, attributed as pre-existing, and told to the author: it is never a
reason to withhold approval, and it never feeds the recommendation. Holding a PR
hostage to the state of the code it landed in is how review stops being useful. Say
which it is for every finding: the diff answers it, and *"this PR does not create the
exposure, it increases it"* is a third, honest answer that belongs in Decision points.

L4's search does not stop at the repo under review: the consumer in another repo or
another service is the one the diff can never show you, and the repo docs say where to
look. Then ask what the system **already does about it**. A change that looks
destructive is often repaired by something that re-runs: a full rebuild, a scheduled
job, a retry, a reconciliation pass. Read the recovery path before pricing the damage.
What survives is the case that path misses: the persistent failure rather than the
transient one, the window before it next runs, the state nothing re-derives.

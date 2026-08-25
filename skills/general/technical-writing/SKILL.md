---

name: technical-writing

description: Use when writing or reworking technical documentation or any technical document whose purpose is to make a system, procedure, design, or decision understood. Apply principles derived from established technical and engineering writers: conceptual integrity and engineering judgment, explicit boundaries and information hiding, precise reasoning, concrete evidence, operational usefulness, and economical prose. Draw the system before explaining it, make constraints and trade-offs explicit, and remove prose that does not reduce the reader's uncertainty.

---

# Technical writing

A technical document is an instrument for transferring understanding.

The reader arrives with a question. The document should reduce the uncertainty around that question until the reader can understand the system, make the relevant decision, or perform the required action.

Do not write to demonstrate how much the author knows.

Do not make the reader reconstruct the author's reasoning from implementation details.

**Make the structure, constraints, decisions, evidence, and consequences visible.**

The writing should make the engineering easier to understand without making the engineering appear simpler than it is.

## Writing principles

### 1. Start with the important question

Name the reader and their question before writing.

A developer asking:

> How do I run this?

needs a different document from an engineer asking:

> Why does this service depend on this database?

and from an operator asking:

> What do I do when this deployment fails?

One document should have one primary question.

Organise the document around that question.

Answer first. Background follows.

### 2. Find the conceptual structure

Before writing prose, determine the smallest set of concepts needed to understand the subject.

Do not begin with implementation details.

Ask:

* What are the important things?
* What depends on what?
* Where are the boundaries?
* What can change independently?
* What must remain consistent?
* Where does information enter and leave?
* Where can the system fail?

Then draw it.

If the structure cannot be drawn, the author's understanding is probably still too entangled.

### 3. Draw before explaining

The structural diagram is part of the reasoning, not decoration. It comes before the
prose, because drawing is where the author finds out the structure is wrong.

This skill does not own diagrams and does not restate their rules.

**Diagrams: use the `write-diagrams` skill (`../write-diagrams/SKILL.md` in this
collection). Pick from its catalog by the reader's question, follow its discipline.**

The catalog entry each document type usually needs is in § Document types.

A technical concept that has a structure — components, ordering, states, ownership,
dependencies, trust boundaries — is illustrated from the catalog, not narrated. Reach
for prose only when the concept has no structure to draw.

### 4. Explain boundaries

A good technical document tells the reader not only what a component does, but **where its responsibility ends**.

For each significant component, make clear:

* what it owns;
* what it consumes;
* what it produces;
* what it depends on;
* what it deliberately does not do;
* what can change without affecting it.

Prefer explicit boundaries over vague descriptions such as "handles" or "manages."

The question is not only:

> What does this module do?

but also:

> What does it keep the rest of the system from having to know?

### 5. Start decisions from constraints

Architecture is a response to constraints.

For every consequential choice, identify:

**Problem → constraints → alternatives → decision → consequences.**

Do not present the selected technology as the explanation.

For example:

> Data cannot leave the organisation. Therefore inference runs inside the organisation's infrastructure.

is useful.

> The system uses Kubernetes and llama.cpp.

is only inventory.

Technology is evidence of a design, not the design itself.

### 6. Preserve engineering judgment

A technical document should preserve the reasoning that future engineers would otherwise have to rediscover.

For important decisions, record:

* what problem existed;
* what options were plausible;
* which constraint mattered;
* what was chosen;
* what was rejected;
* what the choice costs;
* what the choice makes possible;
* what remains unresolved.

Do not document every decision.

Document the decisions whose reversal would require understanding the reasoning again.

### 7. Distinguish fact, assumption, decision, and consequence

Do not collapse them into authoritative-sounding prose.

**Fact**

> The service stores session state in PostgreSQL.

**Constraint**

> The application must continue operating when the identity provider is temporarily unavailable.

**Decision**

> Session state is therefore kept independently of the identity provider after authentication.

**Consequence**

> Existing sessions can continue during an identity-provider outage, but session invalidation becomes an application responsibility.

This separation makes technical reasoning inspectable.

### 8. Prefer evidence to adjectives

Never rely on words such as:

* robust;
* scalable;
* reliable;
* secure;
* performant;
* elegant;
* production-ready;
* enterprise-grade.

State what happened.

Instead of:

> The system is reliable.

write:

> The system has operated through every examination session since its deployment.

Instead of:

> The service scales to many users.

write the observed or required scale.

If there is no evidence, do not manufacture confidence.

### 9. Make complexity visible, but do not dramatise it

Complexity should appear through relationships and constraints.

Show:

* external dependencies;
* independent authorities;
* state ownership;
* data flows;
* failure modes;
* deployment boundaries;
* compatibility requirements;
* operational procedures;
* competing requirements.

Do not create the impression of sophistication by listing technologies.

A system with three technologies and five difficult boundaries may be more complex than a system with twenty technologies and no meaningful constraints.

### 10. Explain consequences

A design is not fully explained when the reader knows how it works.

The reader should also know what the design commits them to.

For significant choices, explain consequences such as:

* operational burden;
* failure modes;
* dependencies;
* coupling;
* reversibility;
* cost;
* testing requirements;
* deployment constraints;
* future migration cost.

A future engineer often needs these consequences more than the implementation history.

### 11. Use examples to expose the general rule

When an abstract rule is difficult to understand, show one concrete case.

Prefer:

> When `OrderService` calls `PaymentService`, it receives a payment identifier rather than a database entity. This keeps the payment service's persistence model private.

over a paragraph defining "loose coupling."

Concrete examples should clarify the rule, not replace it.

Use the smallest example that makes the concept obvious.

### 12. Write for maintenance, not admiration

Documentation is part of the system.

A maintainer should be able to determine:

* what is true now;
* what is assumed;
* what must not change;
* what can change safely;
* what breaks when it changes;
* where to look when something fails.

Do not write a historical narrative unless history explains a current constraint.

Do not preserve implementation trivia merely because it took effort to discover.

The document is not a record of the author's journey.

It is a tool for the next engineer.

## Flow

1. **Identify the reader and question.**
2. **Choose the document type.**
3. **Define the system or decision boundary.**
4. **Identify the important constraints.**
5. **Find the conceptual structure.**
6. **Draw it** with the `write-diagrams` skill.
7. **Identify consequential decisions.**
8. **Build the skeleton around the reader's question.**
9. **Write facts and examples.**
10. **Add reasoning, trade-offs and consequences.**
11. **Render in `aiview`.**
12. **Verify actionable claims.**
13. **Cut unnecessary prose.**
14. **Read it again as the intended reader.**

## Register

Plain language is a technical requirement.

Use:

* concrete nouns;
* active verbs;
* present tense;
* short sentences where possible;
* precise terminology;
* explicit subjects;
* exact commands and paths.

Avoid:

* inflated vocabulary;
* unnecessary abstraction;
* passive constructions when the actor matters;
* vague nouns such as "functionality", "capability", or "solution" when a concrete noun exists;
* promotional language;
* unnecessary qualifications;
* metaphors that obscure the mechanism.

Prefer:

> The worker retries the request three times.

over:

> The system provides a robust retry capability.

Prefer:

> `Scheduler` writes jobs to the queue. `Worker` consumes them.

over:

> The scheduler is responsible for facilitating asynchronous processing.

### Cut words that carry no information

Remove words such as:

* simply;
* just;
* basically;
* obviously;
* generally;
* highly;
* very;
* in order to;
* it should be noted that;
* as mentioned above.

Do not remove necessary qualification merely to make prose shorter.

Conciseness is not omission of important information.

It is omission of information that does not change understanding.

## Document types

| Type | Reader's question | Shape | Diagram, from the `write-diagrams` catalog |
| --- | --- | --- | --- |
| README | "What is this and how do I run it?" | What it is → requirements → run → repository map | Usually none. A README that needs one is an architecture doc under the wrong name |
| Architecture / system doc | "How does this work?" | Constraints → structural diagram → components → flows → decisions → consequences | Container. Add a dependency graph when the document asserts a layering rule |
| ADR | "Why is it like this?" | Context → constraints → alternatives → decision → consequences | Option comparison: the alternatives side by side, deciding trade-off beneath |
| Runbook | "It's broken. What do I do?" | Preconditions → procedure → expected result → failure branches → rollback | User flow for the operator's path; sequence when several systems take turns. The unhappy path is why it exists |
| Onboarding | "Where do I start?" | System map → reading path → first task → deeper references | System context or container as the map; user flow when the product itself needs explaining |
| API guide | "How do I call this?" | Working example → interaction flow → authentication → errors → reference | Sequence, for any handshake: auth, retries, webhooks, pagination |
| Migration note | "What changed and what must I do?" | What changes → before/after → migration order → failure/rollback | Phasing: what moves first, what blocks what |

## Verification

Every actionable claim must be verifiable.

Verify:

* commands;
* paths;
* ports;
* configuration;
* API behaviour;
* deployment procedures;
* dependencies;
* version-specific behaviour;
* operational assumptions.

Verify at writing time.

Do not write:

> The service runs on port 8080.

because that is what it used to do.

Check.

If the claim cannot be verified, qualify it or remove it.

A precise falsehood is worse than an obvious omission.

## Maintenance

Durable documentation lives next to what it describes.

Use stable names for evergreen documents:

`README.md`
`docs/architecture.md`
`docs/runbook.md`

Use dated names for point-in-time material:

`YYYY-MM-DD-….md`

Documentation changes with the system.

When an architectural or operational change invalidates the document, update the document in the same change.

Render through `aiview` while writing and inspect the rendered result.

## Tightening

Make two passes.

### First pass: remove waste

Cut:

* repetition;
* unnecessary history;
* technology inventory;
* unsupported adjectives;
* introductory throat-clearing;
* explanations of obvious syntax;
* prose that duplicates a diagram.

### Second pass: test every paragraph

Ask:

> What does the reader know after this paragraph that they did not know before?

If the answer is unclear, rewrite it.

Then ask:

> Does this information change the reader's understanding, decision, or action?

If not, remove it or move it elsewhere.

## Red flags

| Thought                                  | Reality                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| "I'll add the diagram later."            | The diagram is part of understanding the structure.                       |
| "The architecture is clearer in prose."  | Structure and relationships belong in diagrams.                           |
| "I'll explain this concept in a paragraph." | If it has components, ordering, states, ownership or dependencies, it has a structure. Draw it from the catalog. |
| "The catalog has no entry for this document type." | Pick by the reader's question, not by document type. That is what the catalog indexes. |
| "I'll restate the diagram rules here."   | `write-diagrams` owns them. Reference the skill; do not copy its discipline. |
| "The technology explains the design."    | Constraints and decisions explain the design.                             |
| "This is the best solution."             | Explain the deciding trade-off.                                           |
| "We use Kubernetes."                     | Explain why Kubernetes is part of the solution.                           |
| "The system is robust."                  | Provide evidence of the property.                                         |
| "The reader will infer the boundary."    | State the boundary.                                                       |
| "The implementation is interesting."     | Explain its consequence or remove it.                                     |
| "More detail makes the document better." | Detail is useful only when it reduces uncertainty.                        |
| "The reader knows the context."          | Include the minimum context needed to understand the decision.            |
| "The comments explain it."               | Documentation should tell the reader where the important structure lives. |
| "This claim is probably still true."     | Verify it or delete it.                                                   |
| "I'll polish the prose later."           | Structure and reasoning come before prose polish.                         |
| "It sounds technical."                   | Technical writing is precise reasoning, not technical vocabulary.         |

## Core test

Before publishing, ask:

**Can a competent engineer who did not build this system understand its structure, boundaries, constraints, important decisions, consequences, and next action without asking the author?**

If not, the document is not finished.

---

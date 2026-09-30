# Harness: a microservice or an event-driven service

**The consumer is another service, or a producer and a consumer of messages. Drive the service through the transport it is deployed behind, with real messages on the real broker the environment provides.**

## Setup

- **Launch the dependencies the skill names as the repository does**: its compose file, its dev script, its local broker. A service verified against an in-memory stand-in for its broker is verified against a different system.
- **Readiness** on every dependency, then the service: a health route, a consumer group that has joined, a topic that exists. Polled, each with its own signal.
- **The contract**: the schemas the service publishes and consumes, its synchronous endpoints when it has any. A story is one business outcome across them: a message in, the state that results, the messages out.
- **Tooling**: the repository's clients first. Otherwise the broker's own CLI or a small script under the scratch directory, producing and consuming with the same serialisation the service uses.

## Driving

- **Produce the message a real producer would**, with its headers, its key, its schema version. A malformed message tests robustness, which is a different story: run it only when the design says what should happen.
- **Call the synchronous surface as its consumer service would**, with the authentication between services that the deployment uses.
- **One correlation id per story**, carried in the message and used to find everything the story caused.

## Observing

- **The messages out**: consume from the topics the design names, from a fresh consumer group started before the action, filtered by the correlation id, bounded by a timeout the design justifies.
- **The state**: through the service's own read surface, or the downstream service's, never its database.
- **What did not happen**: a message the design says must not be emitted is asserted by its absence within the bound, the bound written into the evidence.
- **Evidence**: the messages produced and consumed verbatim, the consumer group and offsets, the service's logs for the correlation id.

## Cleanup

- **Delete the consumer groups and the topics the run created**, never the ones the environment provides. Messages produced onto shared topics stay: say so in the document, with their correlation id.
- **Stop what the run started**, the compose stack included when the run started it, by its project name.

## Gotchas

- **At-least-once delivery**: a duplicate on the topic is not a failure unless the design promised exactly-once. Assert the state, then count.
- **A dead-letter topic** is a side effect. Check it is empty for the correlation id when the story succeeds.
- **Clock skew and retries** widen the bound. A bound of a second is a flaky story waiting to happen.

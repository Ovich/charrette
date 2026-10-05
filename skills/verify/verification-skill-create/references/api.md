# Harness: an HTTP or gRPC API

**The consumer is a client. Drive the API exactly as its documented contract says, over the network, with the authentication a real client would carry.**

## Setup

- **The contract is the first half of the specification**: OpenAPI, a `.proto`, a Postman collection, the repository's own client. A journey is a sequence of calls a client makes for one outcome, never one endpoint.
- **Readiness** by the health route the skill names, polled. A base URL and port from the launch section.
- **Authentication as the client does it**: obtain the token through the real flow (a login call, a client-credentials grant, a signed request). A token pasted from configuration skips the journey's first step.
- **Tooling**: the repository's client or SDK first. Otherwise a small script per run (`fetch` in Node, `grpcurl` for gRPC) under the scratch directory. `curl` is fine for a single call, not for a journey.

## Driving

- **Every call as the contract writes it**: method, path, headers, body, and the content type it declares. A call the contract does not describe is a finding, not a workaround.
- **Chain by the responses**: the id returned by the create is the id the read uses. Never an id guessed or read from the database.
- **Idempotency and ordering are part of the design**: repeat the call the design says is safe to repeat, and check the second result.

## Observing

- **The outcome through the API itself**: the read call after the write, the list that should now contain the record, the status that should have changed. The database is the application's, not the verifier's.
- **Side effects at their production boundary**: the email in the mail sink the environment already provides, the message on the queue, the webhook received by a listener the run starts. A side effect with no observable boundary is reported as unverifiable, not assumed.
- **Evidence**: every request and response verbatim (secrets redacted), status codes, timings when the design promises one.

## The roles of this surface

Written into the role prompt the skill opens on, each in the product's own terms, with what it answers for:

- **The client developer** answers for a contract that reads and behaves as documented, its examples running as written, its errors saying what was wrong and how to fix it, with the status their kind deserves.
- **Its contract steward** answers for names, shapes, dates, pagination and errors alike from one endpoint to the next, and for timings the documentation promises.

## Cleanup

- **Delete through the API** what the run created, in reverse order of creation, when the journey does not already end by deleting it.
- **Revoke or let expire** the token the run obtained.

## Gotchas

- **A 200 with an error in the body** is the API's convention in some codebases. Read the body.
- **Pagination and eventual consistency**: a list that does not yet contain the record is a wait on the read, bounded, then a finding. Never an assertion on `length > 0`.
- **A dry-run flag or a sandbox mode**: verify what it skips before trusting its name.

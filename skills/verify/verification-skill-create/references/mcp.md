# Harness: an MCP server

**The consumer is an agent. Drive the server through a real MCP client over the transport it ships with, and judge the result by what the agent would see.**

## Setup

- **The transport the server declares**: stdio launched with its documented command, or streamable HTTP at the URL the skill names. Never the server's handler functions imported directly.
- **A real client**: the repository's own when it has one, otherwise a small script on the official MCP SDK under the scratch directory, or the MCP inspector's CLI mode. Initialise, then `tools/list`, `resources/list`, `prompts/list` as the first observation: the surface the agent gets.
- **Configuration and credentials** exactly as the documented install says, in an environment isolated from the person's.

## Driving

- **A story is what an agent would do for one outcome**: read a resource, call a tool with the arguments its schema declares, call the next with the result. A tool called with arguments the schema forbids tests robustness, a different story.
- **Arguments from the schema, never from the implementation.** A required argument the schema does not declare is a finding.
- **Concurrency and sessions** when the design promises them: two clients, or one client's two calls in flight.

## Observing

- **The response as the agent receives it**: content blocks, `isError`, structured content when declared. An error inside a successful envelope is an error.
- **The outcome beyond the response**: the file the tool wrote, the record it created, read back through another tool or resource the server offers, or through the system the tool acts on.
- **Notifications** the server emits, list-changed and progress, when the design names them.
- **Evidence**: the initialise handshake, every request and response verbatim, the server's stderr.

## Cleanup

- **Close the client and end the server process** you launched, by handle. Delete what the tools created during the run when the story does not already end by deleting it.

## Gotchas

- **stdio servers write logs to stdout** by mistake and break the protocol. That is a finding, and the story fails on it.
- **A tool description is a promise to the agent.** A tool that does more or less than its description says is a design finding even when the call succeeds.
- **Large results** may be truncated by the client. Assert on the server's response, not the client's rendering.

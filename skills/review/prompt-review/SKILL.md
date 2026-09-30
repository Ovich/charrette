---
name: prompt-review
description: "Use when a model call or a chain of them has to be judged from what the model was actually sent and what it returned: a system prompt with its tools and data, a structured answer, an agentic walk of tool calls, a re-judging. Produces one prompt document in aiview, the request as sent, the reply as returned, and the checks the prompt's own rules imply with what each hit. Any agent, any stack. Not for designing a screen (design-prototype), not for recording or mocking replies, and not for reviewing the code that builds the prompt."
---

# Prompt review

**The request as sent, the reply as returned, the rules as checks. Nothing retyped, nothing eyeballed.**

## Mindset

- **The rules in the prompt are the checks.** "Never add a fact the data does not hold" is a verbatim check against the data. "One question at a time" is a count. A prompt sentence with no check is a wish, and the review says so.
- **Record and judgment stay apart.** The page shows the prompt, the tools and the data exactly as the app sent them, then judges. A reader who cannot see the raw request does not trust the verdict.
- **A check is a function over the embedded data**, with the hits listed and each one clickable to the thing it hit. A check the reader has to eyeball is done differently each time.
- **A failed check changes the prompt or the data, never the reply.** The run is recorded again from the first call the change affects, and the page is re-embedded.

## Flow

1. **Get the request as sent**: the app's log, a held mock request, a trace. System message, tools with their schemas, the conversation with every tool call and result, the response format. A prompt file read from the repository is not the request: the app may compose it differently.
2. **Get the reply as returned**, and for a walk every call of the chain in order: which tool, with what arguments, and what the model said between calls.
3. **Derive the checks.** One per rule the prompt states, one per property the data promises (a shape, a limit, a language), one per thing the person is worried about. Name each by the rule's own words. Severity: what the prompt forbids is bad, what it prefers is warn, what is only worth seeing is info.
4. **Write the page** to the contract in `references/page.md`, read before the first line. Embed the raw files by a script that is rerun after every recording, never by pasting.
5. **Register through the `aiview` skill**: kind `prompt` (from the filename), tags = project + the agent's name, the group of the piece of work. Tell the person the URL.
6. **Walk the hits with the person**, worst first. Each hit ends in one of three: a change to the prompt, a change to the data, or a check that was wrong. A change to the prompt is proposed as the sentence to add or replace, in the prompt's own voice.

## Red flags

| Thought | Reality |
|---|---|
| "The reply looks right" | Right against which rule? Every judgment is a check with hits, or it is not on the page. |
| "I'll paste the prompt from the source file" | The app composes the request. Only the request as sent shows what the model read. |
| "The check found nothing, so the rule holds" | A check with no hits on one run holds for that run and that data. Say which run. |

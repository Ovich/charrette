# The prompt document

One self-contained HTML file, `YYYY-MM-DD-<topic>.prompt.html`, in the project's folder in the data home at the path the `aiview` skill gives. Inline `<style>` and `<script>`, no CDN, no build, no fetch: the viewer runs it sandboxed. Light and dark from `prefers-color-scheme`.

## The embedded data

One `<script id="data" type="application/json">` holding the raw material, written by an embed script kept next to the recordings, never by hand:

- `request`: the request as the app sent it, whole. At least the system message, the tools with their schemas, the messages with every tool call and result, and the response format when one was set.
- `reply`: the reply as returned, or for a walk an array of `{ call, tool, arguments, said }` in order.
- `data`: the documents or records the model read, when the checks quote them.
- `stands_for`: one sentence saying which prompt version, which model and which run this is. Shown on the page.

The page reads only this block. A file picker may replace it for a local file, so a reader can drop a newer recording on the same page.

## The sections, in this order

1. **Verdict**: one line per check, its severity, its hit count, clickable. Bad first.
2. **Given**: the system prompt as prose, each tool collapsed with its description open and its schema behind a click, then the conversation as the model read it, tool results included.
3. **Returned**: the reply rendered as the person would meet it in the product, a card as a card, a table as a table, then the raw JSON behind a click. For a walk, one numbered step per call: the tool, the arguments, what the model said.
4. **Checks**: each check with its rule quoted from the prompt, the function that decides it in one sentence, and its hits, each linking to the item, the step or the sentence it concerns.

## Checks

A check is `{ label, rule, severity, hits }`, computed in the page's script from the embedded data. `hits` is a list of `[target, text]`, the target an element id on the page. A check that needs the data it cannot have (the source document text is absent) says so in its label and counts no hits, never a pass.

Typical checks, named by the rule that gives them: quotes verbatim in the source, fixed shape per kind, no field the data does not hold, one question per turn, options drawn from the data, limits (count, length, language), a settled item left alone, the forbidden tool never called.

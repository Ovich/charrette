# The shape of the feature map

Its sections, in this order, every one read by the verify skill and kept true by the agent running it:

1. **`proven at <commit> on <date>`**, the second line, under the title: the commit the last complete pass ran against.
2. **Navigation**: one mermaid flowchart from the entry point through the features to their sub-features and hidden parts, each edge labelled with the consumer's action that takes it (a click, a command, a call, a message). Drawn to the `write-diagrams` skill, parsed with `aiview mermaid-check` after every edit.
3. **Features**, one section each, every one a journey crosses or the person names: what it does for the consumer; how they reach it (the features before it, the state it needs); its hidden parts, what shows only after a sequence of actions or in a given state (a menu, a dialog, a second step, an error, an empty or a long state), each with the way to bring it out; the observable state that says it was reached; gotchas and failure modes. How the harness drives it is the skill's, not the map's.
4. **Journeys**, a table: id, the journey in the consumer's words, the features on its path in order, the starting state, what it promises the consumer, its source (a plan's story id, a slot, a README promise).

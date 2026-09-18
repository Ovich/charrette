# Investigate

**Research** (`research: yes`). Read the official source: the specification, the package
as published, its types and its changelog. Read how reputable projects solve the same
problem, from their sources. State the version read and the date. A search result or a
blog is where reading starts, never where it stops.

**Experiments** (`experiments: yes`). A very small proof of concept with the library,
built before recommending it, in a sandbox outside the repository: installed against the
project's own versions, doing one real case of ours and nothing else. What it shows is
reported with its number: a version mismatch, a bundle size, a missing export. It is
thrown away. What stays is its recipe.

**Prefer a reputable existing tool to a rebuild** unless the proof of concept shows a major
compromise.

**Hand the caller the recipe of what ran**: the install, the exact input, the exact
output, the check that proved it, what is still unproven.

**When the proof of concept contradicts the recommendation, reverse it and say so.**

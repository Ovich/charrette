---
name: execute-slice
description: Use when handed one slice document to carry out, as the agent doing the work rather than the one holding the plan. Shapes the code around the slice, does the slice, and returns the evidence and the branch. Not for writing the slice document (write-slice) and not for running a plan (execute-plan).
---

# Execute a slice

**The slice document is the design; the brief is the mandate.** Where the brief asks for something, it wins over any habit, this skill's included.

**When the brief names a run on the board, load the `swarm` skill, runner side, before the work.** It changes nothing else here.

## When to stop

Each is a report, never an improvisation.

- **The acceptance criteria already pass.**
- **The document names something that does not exist**: a module, a command, a fact the work depends on.
- **The work would change a decision the plan took**: a module's interface, a schema, a contract, a dependency the document did not name. Say what and where.

## The work, in order

1. **Shape the ground.** Before writing the slice, look at the code it lands in and ask what would make it fit: a module to split or merge, a responsibility in the wrong place, a duplicate to fold, dead code, a name that misleads. See who depends on what with the `dependency-graph` skill's script on the modules the slice touches (`--focus`, one or two hops), without `--out`: the graph is for you, not a document. On a stack the script cannot parse, read the imports. Refactor that neighbourhood so the slice slots in cleanly, behaviour unchanged, in its own commits ahead of the slice's. Stay in the neighbourhood the slice touches; a rework that would change a decision is a stop.
2. **Do the slice.** The acceptance criteria and nothing beyond them. Tick each criterion in the slice document as its evidence lands; the document is yours to edit, the plan is not.
3. **Name for purpose.** Every identifier you add or touch (module, file, function, type, variable) says what it is for, readable at the call site without opening its body. No generic names (`data`, `handle`, `utils`, `manager`, `info`), no names left from what the code used to do. Rename what step 1 surfaced, in its commits.

Commit small, push as the brief's pull request line says, and open the draft it names on the first commit.

## The return

- **The branch, its base, and the commits on it**, the shaping commits apart from the slice's.
- **What changed and where**, and what the shaping changed around the slice, and why.
- **The check's last run**, verbatim.
- **Each criterion with its evidence**, and what the brief asked for beyond them.
- **Anything the document did not predict.**

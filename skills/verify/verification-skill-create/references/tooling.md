# The tooling's speed and ergonomics

The scripts a skill hands an agent (a verify skill's harness, a workbench's feed and operating scripts) are operated many times in a session and in every session the project will have. A second lost in a step is paid at every step, and an output the agent must read twice is paid in its context. Each rule below is measured before handover and kept by the agent that owns the skill.

## Fast

- **Set up once, act many times.** The browser, the client or the broker connection starts once per pass. A part's starting state is made once, and every action and look reuses it.
- **Independent parts run side by side**, one context or client each, when the system under test takes the load.
- **Never a wait on time.** Each wait is on a signal with a bound, and the bound fails loud. A default timeout is set to what the system needs, not the tool's generous default: a missing element is known in seconds, not half a minute.
- **The cheapest evidence that answers**: a screenshot where a trace would only repeat it, a trace kept for what may be doubted.
- **No wrapper in the hot path**: the runtime runs the script directly (a loader flag, not a package-manager runner that resolves, warns and spawns on every call), no install or build per run.

## Easy for an agent

- **One command per thing the agent repeats**, named for what it does, its few arguments documented in the script's head.
- **Explore without rewriting.** Reaching a hidden part takes trial. The tooling keeps a live state the agent acts on in small steps (act, look, act again), never a whole scripted journey re-run per attempt.
- **Output short and parseable**: one line per result, JSON where the agent will read fields, nothing else on stdout, the toolchain's own warnings silenced at the source.
- **Fail fast, with the way out**: an error stops the step and names its cause and its fix in one line (the seed that no longer restores, and why), never a stack trace alone.
- **Idempotent and resumable**: a step run twice does no harm, and a pass that died is cleaned up by its id.

## Measured

Before handover, the time of each step the agent repeats (ready, a part's starting state, one action and its observation, a look at every width and theme, a part's close, the cleanup) and the number of tool calls the proving pass took. They are written into the skill's Harness section as its budget. A step over its budget is fixed before handover, or named with its reason.

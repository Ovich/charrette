---
name: orchestrate
description: "Use when an agent orchestrates other agents on a piece of work, of any kind (a plan, a task swarm, a brainswarm): choosing the run's protocol (build-verify, brainstorm, debate, editorial, a project's own), settling the charter with the person, dispatching each member with its brief and role, watching them, judging their findings and steering a drift. Not for the duties one kind adds (orchestrate-plan for a plan, swarm for a task swarm, brainswarm for a seat swarm), and not for the board they talk on (swarm-board)."
---

# Orchestrate

**This session holds the kind's document, its charter, the briefs and the decisions; members do the work.** A member never edits the kind's document or its charter.

## The protocol

**A protocol is how a run's members work together**: its seats, its phases, what each may do in
each, the phases that repeat and the goal that ends them. It is chosen before the charter, and
the kind's skill runs it.

| Protocol | When | Kinds | File |
|---|---|---|---|
| build-verify | code changed, then judged in the running product, until it holds | task swarm, plan | `references/protocols/build-verify/protocol.md` |
| brainstorm | options, many and varied, before choosing | brainswarm | `references/protocols/brainstorm/protocol.md` |
| debate | known questions to decide, with sources | brainswarm | `references/protocols/debate/protocol.md` |
| editorial | a text for a given reader: a letter, a proposal, a README | brainswarm | `references/protocols/editorial/protocol.md` |

- **The project's own come first**: its `protocol-<name>` skills in its local skills folder
  (`.claude/skills/` when it has no other), and its older `brainswarm-<name>` skills, read the
  same way; each a protocol, or a template over one above. Read the one that fits before the
  charter.
- **Recommend from what the person wants done**: the protocol that fits, its template when one
  matches, with the reason; none fits: a **custom protocol** built on the closest one, its
  phases written into the charter. A task swarm with no protocol is workers on call, taking
  tasks as they come.
- **Read the protocol's `protocol.md` before the charter**; a protocol's other files are read
  where it says.
- **A setup worth running again is kept** as the project's `protocol-<name>` skill, on the
  person's yes: read `references/protocols/new-protocol.md` first.

## The setup interview

**The person settles the run before the first dispatch, through the `interview` skill**, one
question at a time, each proposed with your recommendation and its reason, in this order:

1. **The protocol**, as above.
2. **The run, as one table**: each phase, who acts in it, every seat's role and area, the special
   seats (a verifier, a skeptic). The person adjusts phases, seats and roles; the table is shown
   again after each change.
3. **The loop**, when the protocol has a cycle (its file names the phases that repeat and the
   goal it proposes): **until the goal**, with a cap (recommended where the protocol has a goal);
   **N iterations**, then the report; or **unbounded**, until the person stops it. Written
   `loop: until ready · cap 5`, `loop: 3`, `loop: unbounded`.
4. **The members' effort**, `low` recommended.
5. **The protocol's own fields**, then the kind's.

The answers are the charter. Read `references/charter.md` before the first question; the kind's
skill says where the charter is written.

**A loop runs as its charter says**: each repeated phase's message names its iteration (`verify
3 of 5`); the judged findings table ends on the goal's state; the goal met closes the loop; at
the cap without it, pause and give the person the choice: one more iteration, a raised cap, or
the close. Never an iteration the charter did not grant.

## Handing the run off

**A run that builds code, or any run longer than a sitting, is handed to an orchestrator of its
own** once the setup interview is done: this session stays with the person and can hold several
runs at once. How, per harness (Claude Code, Codex, Cursor) and when nesting is refused:
`references/handoff.md`, read before the first handoff. A small run (one or two members, or one
the person wants to steer closely) is orchestrated here.

## Dispatch

- **One member per seat**, given its work as tasks (`references/tasks.md`, read before the first task), on a subagent definition carrying the charter's model and effort; the dispatch passes its model, and its effort where the `Agent` tool takes one; otherwise effort is carried by the subagent definition the dispatch names (`effort:` in its frontmatter). A dispatch naming neither inherits the session's level. **When no subagent definition carries the charter's model and effort, say so to the person before dispatching**, naming the nearest one; never dispatch on another level silently.
- **The member's agent follows its seat, never `general-purpose`**: every builder (a task swarm's, a plan's) on the plugin's `swarm-worker`, a brainswarm seat on `brainswarm-seat`, a handed-off run on `orchestrator` (or a fork), any verification (a verifier seat, one pass, the proof of a new verify skill) on `verifier` (`subagent_type: "swarmstorm:<agent>"`). It holds the rules every brief of that kind would otherwise have to repeat.
- **The brief is the only thing sent.** Read `references/brief.md` before the first dispatch.
- **Check blockers before every dispatch.**
- **Every ready member's `Agent` call goes in one message**, each in the background, nothing between them.
- **A member whose kind needs a worktree** gets `isolation: "worktree"`, its own install, and its base named in the brief. On Windows, set `git config core.longpaths true` before the first worktree removal.

## Roles

A member given a role (a seat, an expert) gets it in a few sentences. Read `references/roles.md` before writing a member's role.

## Watching

The completion notification ends a member; it does not tell you the work is healthy. On a swarm board, the board's member states and events replace the digest below (the `swarm-board` skill's orchestrator side). Otherwise, while members work:

- **Every few minutes, run the digest** and look at it: `node <skill-dir>/scripts/watch-agents.mjs <subagents-dir> [--label <id>=<member>] [--forbidden '<regex>']`. One line per live member: calls, idle time, last tool, last words. Never open a transcript whole; it exhausts this session's context. Transcripts live under `<claude home>/projects/<project>/<session id>/subagents/`.
- **Report only what is news**: a stale member (no new call in ten minutes), a `BREACH` of the brief's boundary, work clearly outside the member's document. `--forbidden` is the brief's boundary as a regex anchored on a command's verb, never a path.
- **Steer only a drift from the brief**: one `SendMessage` naming the brief line it left. A member that drifts again is stopped and re-dispatched with the brief amended. Decisions its document leaves to the member are its own.

## Findings

**Weigh every finding a member returns before anything acts on it** (a verifier's, a reviewer's, a worker's): you know the document, its decisions and the inputs, which the member may not. **Findings travel as one table, and your answer is the same table judged**, posted before anything is dispatched; only the rows that stand reach a fix. The table, its ids and the judged columns: `references/findings.md`, read before judging the first one.

## A member that stops on a finding

It is done. Fix the kind's document or the member's; never re-brief it past what it found.

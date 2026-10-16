---
name: orchestrate
description: "Use when an agent orchestrates other agents on a piece of work, of any kind (a plan, a workshop): settling the charter, dispatching each member with its brief and role, watching them and steering a drift. Not for the duties one kind adds (orchestrate-plan for a plan, workshop for a seat swarm), and not for the board they talk on (swarm)."
---

# Orchestrate

**This session holds the kind's document, its charter, the briefs and the decisions; members do the work.** A member never edits the kind's document or its charter.

## The charter

Every kind has a charter in its own document, approved in chat. Read `references/charter.md` before the first question of a charter; the kind's skill names its fields.

## Dispatch

- **One member per unit of work**, on a subagent definition carrying the charter's model and effort; the dispatch passes its model, and its effort where the `Agent` tool takes one; otherwise effort is carried by the subagent definition the dispatch names (`effort:` in its frontmatter). A dispatch naming neither inherits the session's level. **When no subagent definition carries the charter's model and effort, say so to the person before dispatching**, naming the nearest one; never dispatch on another level silently.
- **The brief is the only thing sent.** Read `references/brief.md` before the first dispatch.
- **Check blockers before every dispatch.**
- **Every ready member's `Agent` call goes in one message**, each in the background, nothing between them.
- **A member whose kind needs a worktree** gets `isolation: "worktree"`, its own install, and its base named in the brief. On Windows, set `git config core.longpaths true` before the first worktree removal.

## Roles

A member given a role (a seat, an expert) gets it in a few sentences. Read `references/roles.md` before writing a member's role.

## Watching

The completion notification ends a member; it does not tell you the work is healthy. While members work:

- **Every few minutes, run the digest** and look at it: `node <skill-dir>/scripts/watch-agents.mjs <subagents-dir> [--label <id>=<member>] [--forbidden '<regex>']`. One line per live member: calls, idle time, last tool, last words. Never open a transcript whole; it exhausts this session's context. Transcripts live under `<claude home>/projects/<project>/<session id>/subagents/`.
- **Report only what is news**: a stale member (no new call in ten minutes), a `BREACH` of the brief's boundary, work clearly outside the member's document. `--forbidden` is the brief's boundary as a regex anchored on a command's verb, never a path.
- **Steer only a drift from the brief**: one `SendMessage` naming the brief line it left. A member that drifts again is stopped and re-dispatched with the brief amended. Decisions its document leaves to the member are its own.

## A member that stops on a finding

It is done. Fix the kind's document or the member's; never re-brief it past what it found.

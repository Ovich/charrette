# Setup

**The board needs nothing installed beyond the plugin**: its hooks ship with it and call
`$S hook pre` and `$S hook post` on every tool call. They are Claude Code's; never call `hook`
yourself. With no run open, they exit at once.

## When a check fails

| Symptom | Cause | Fix |
|---|---|---|
| `$S status` shows `hooks   never seen`, or a time before the run opened | Claude Code reads hooks at startup: the plugin was installed or updated in a running session | restart Claude Code, then open the run again |
| A verb fails before it runs, on `node:sqlite` or the version | Node older than 22.5 | `node --version`; install 22.5 or later |
| A runner's call to the tool waits on a permission prompt, or auto mode blocks it | the session prompts for shell calls; a subagent cannot answer a prompt | the allow rule below |

## The allow rule

One rule in the project's or the user's `settings.json`, for sessions that prompt or run in
auto mode:

```json
{ "permissions": { "allow": ["Bash(node <skill-dir>/swarm.mjs:*)"] } }
```

`<skill-dir>` holds the plugin's version, so the rule is rewritten after each plugin update,
along with the restart.

## Harnesses that notify on a background task's end

The listener (`$S wait --mentions` in the background) needs a harness that tells the agent when
its background task ends. Read 2026-10-08:

| Harness | Background task's end | Source |
|---|---|---|
| Claude Code | built in: the Bash tool's `run_in_background`; the agent is told when it ends, working or idle. Unattended sessions (`-p`, the Agent SDK, CI, cloud) stop a background command after 30 minutes, or the `timeout` passed, up to 2 hours: give the wait a `--timeout` under it. A foreground subagent's background command ends with its run | [tools reference, Background commands](https://code.claude.com/docs/en/tools-reference#background-commands); [interactive mode, Background Bash commands](https://code.claude.com/docs/en/interactive-mode#background-bash-commands) |
| Kimi | built in: `Shell(run_in_background=true)`; completion is delivered to the model as a `<notification>` message at its next step. Waking an idle session is not documented | [MoonshotAI/kimi-cli #1477](https://github.com/MoonshotAI/kimi-cli/pull/1477) |
| Pi | with an extension, such as `pi-background-bash`, which injects a follow-up result and wakes the agent when a job ends | [pi-background-bash](https://pi.dev/packages/pi-background-bash); [pi-bg-run](https://pi.dev/packages/pi-bg-run) |
| Codex | not documented: its notify hook fires on a turn's end and on approvals, not on a background process's exit | [Codex notification pipeline](https://codex.danielvaughan.com/2026/04/13/codex-cli-notification-pipeline-osc9-hooks-alerts/) |

**No notification**: `$S deliver` between steps, and a foreground `$S wait --mentions --timeout <ms>`
when idle, the timeout under the shell call's own.

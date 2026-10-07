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

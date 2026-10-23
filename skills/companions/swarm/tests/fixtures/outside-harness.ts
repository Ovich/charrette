// The suite runs outside a harness session (swarm-relay D39), even when started from inside one: a verb then starts a
// detached link as before, instead of waiting 10 s for an agent's own. A test of the harness case sets the variable itself.
delete process.env.CLAUDE_CODE_SESSION_ID;

# Harness: a command-line or terminal program

**The consumer is a person at a shell. Drive the built binary as they would: arguments, stdin, a terminal, the working directory they would be in.**

## Setup

- **Build once per run**, the artefact the consumer gets: the compiled binary, the packed CLI, the script under its interpreter. Never the source through a test runner.
- **A fresh scratch directory per story** as its working directory, with the files the starting state needs, created there and nowhere else.
- **A terminal when the program needs one**: an interactive prompt, a spinner, colour. `node-pty`, `script`, or the repository's own PTY helper. A pipe where the program is non-interactive, and the story says which.
- **Environment isolated**: its own `HOME`, config directory and cache variables pointing under the scratch directory, so the run never reads or writes the person's.

## Driving

- **Arguments exactly as documented**, in the help text or the README. An undocumented flag that makes the story pass is a finding about the documentation.
- **Interactive input as keystrokes**, after the prompt appeared, never ahead of it. Wait on the prompt text.
- **Signals and exits** when the design describes them: `Ctrl-C` mid-operation, a closed stdin.

## Observing

- **Exit code, stdout and stderr**, captured separately, verbatim, and the terminal transcript when a PTY was used.
- **The outcome beyond the output**: the files written, their content, the state a second invocation reads back, the config that changed.
- **What the program printed is not what it did**: a "done" line is checked against the artefact it claims.

## Cleanup

- **Delete the scratch directory** and the isolated `HOME` after the evidence is copied out.
- **Kill by handle** a process the story left running, a daemon it started, a watcher.

## Gotchas

- **Colour and width**: output differs between a PTY and a pipe. Assert on content, or set `NO_COLOR` and a fixed `COLUMNS` and say so.
- **A global config the program reads** from the real home leaks into the story when the environment is not isolated.
- **Windows and POSIX**: line endings and path separators in the output. The story states which platform it was run on.

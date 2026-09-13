# Harness: a web front end

**Playwright, headless, one fresh browser context per run**, and nothing shares state with a person's browser.

## Setup

- **The repository's own Playwright wins** when it has one: its config, its fixtures, its base URL. Otherwise `npx playwright install chromium` once, and a script per run under the scratch directory, never committed.
- **Base URL from the launch section**, readiness by an HTTP probe on a route the skill names, polled, never a sleep.
- **Authentication is part of the journey** the first time: sign in as the consumer would. A storage state saved from that sign-in may seed later stories in the same run, and is deleted at cleanup.

## Driving

- **Semantic locators**: `getByRole`, `getByLabel`, `getByText`, in that order. A `data-testid` only where the repository already has one. Never a CSS chain, never coordinates.
- **Wait on the state, never on time**: `expect(locator).toBeVisible()`, `page.waitForURL`, `waitForResponse` on the request the action fires.
- **One action, one observation.** A story is a sequence of them, not one final assertion.

## Observing

- **The screen**: a screenshot after every consumer action, full page, named by story and step.
- **The outcome**: what the design promised, on screen, or on a second page the consumer would open to see it. A saved record is read back through the application, not the database.
- **The network**: `page.on("response")` for the calls the story triggers, kept in the evidence when the outcome is a call to somewhere else.
- **The trace**: `context.tracing.start({ screenshots: true, snapshots: true })` per story, stopped into the evidence directory. It is the evidence a person replays when a story fails.

## Cleanup

- **Close the context and the browser** you opened. Delete the storage state, the scratch script, the temporary profile.
- **Records the story created through the UI**: remove them through the UI or the API the consumer has, when the story does not already end by removing them.

## Gotchas

- **A dev server that hot-reloads** restarts mid-story on any file write. Do not write into the repository during a run.
- **Toasts and dialogs** disappear on their own timer. Assert them at once, or read the state they announce instead.
- **`networkidle` lies on pages with polling**. Wait on the specific response.

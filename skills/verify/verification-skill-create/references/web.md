# Harness: a web front end

**Playwright, headless, one fresh browser context per run**, and nothing shares state with a person's browser.

## Setup

- **The repository's own Playwright wins** when it has one: its config, its fixtures, its base URL. Otherwise `npx playwright install chromium` once, and a script per run under the scratch directory, never committed.
- **Base URL from the launch section**, readiness by an HTTP probe on a route the skill names, polled, never a sleep.
- **Authentication is part of the journey** the first time: sign in as the consumer would. A storage state saved from that sign-in may seed later stories in the same run, and is deleted at cleanup.

## Driving

- **Semantic locators**: `getByRole`, `getByLabel`, `getByText`, in that order. A `data-testid` only where the repository already has one. Never a CSS chain, never coordinates.
- **Wait on the state, never on time**: `expect(locator).toBeVisible()`, `page.waitForURL`, `waitForResponse` on the request the action fires.
- **One action, one observation.** A journey is a sequence of them, each looked at, never one final glance.

## Observing

- **The screen**: a screenshot after every consumer action, full page, named by part and step, at each width the product supports. A page that scrolls inside its columns, not the window, shows its fold only when the column is scrolled and shot again.
- **The outcome**: what the design promised, on screen, or on a second page the consumer would open to see it. A saved record is read back through the application, not the database.
- **The network**: `page.on("response")` for the calls the consumer's actions trigger, kept in the evidence when the outcome is a call to somewhere else.
- **The trace**: `context.tracing.start({ screenshots: true, snapshots: true })` per journey, stopped into the evidence directory. It is the evidence a person replays when a finding is doubted.
- **The console**: the errors and failed requests the page logs while the consumer acts are part of what they meet, read with `page.on("console")` and `page.on("requestfailed")`.
- **The reference**: when the scope takes a mockup as reference, its variant opened at the same width and screenshotted beside the app's, so a departure is seen, not guessed.

## The roles of this surface

Written into the role prompt the skill opens on, each in the product's own terms, with what it answers for:

- **Its art director** answers for a product that looks like itself, deliberate and finished against its design language: spacing, alignment, type and colour as its own screens set them, nothing clipped, overlapping or overflowing, at every width and in both themes.
- **Its interaction designer** answers for controls that say what they do, actions that answer, every state shown (empty, loading, error, long content, a second visit, a reload, the back button) and every motion settled.
- **Its accessibility advocate** answers for a product that holds with the keyboard alone, a screen reader, low vision and a narrow screen.

## Cleanup

- **Close the context and the browser** you opened. Delete the storage state, the scratch script, the temporary profile.
- **Records the run created through the UI**: remove them through the UI or the API the consumer has, when the journey does not already end by removing them.

## Gotchas

- **A dev server that hot-reloads** restarts mid-journey on any file write. Do not write into the repository during a run.
- **Toasts and dialogs** disappear on their own timer. Assert them at once, or read the state they announce instead.
- **`networkidle` lies on pages with polling**. Wait on the specific response.

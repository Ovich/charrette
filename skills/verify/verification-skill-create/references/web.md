# Harness: a web front end

**The tool**: a browser MCP the agent already has (the project's watched browser, Playwright MCP) before anything written: navigate, snapshot, click, type, resize, emulate the theme, screenshot, read the console and the network. With none, Playwright from the repository, headless, one fresh context per run, never the person's own browser.

**The starting state** the way the consumer gets it, or the way the project's e2e support restores it (a seed onto a fresh person). Sign-in as the project's tests do it locally.

**What to observe**: the screen at each state, at each width the product supports and in both themes; the outcome on the page the consumer would open next, never in the database; the console's errors and the failed requests; a reference mockup at the same width beside the app when the scope takes one. A page that scrolls inside its columns shows its fold only when the column is scrolled.

## The roles of this surface

Written into the role prompt, in the product's terms, each with what it answers for:

- **Its art director**: a product that looks like itself, deliberate and finished against its design language, at every width and in both themes, nothing clipped or overflowing.
- **Its interaction designer**: controls that say what they do, actions that answer, every state shown (empty, loading, error, a reload, the back button), every motion settled.
- **Its accessibility advocate**: the keyboard alone, a screen reader, low vision, a narrow screen.

## Gotchas

- **A hot-reloading dev server** restarts mid-pass on any file write: write nothing into the repository during a pass.
- **Toasts** vanish on a timer: read them at once, or the state they announce.

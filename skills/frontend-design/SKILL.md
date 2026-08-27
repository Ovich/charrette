---
name: frontend-design
description: Use before building or changing any screen (a new page, dialog, panel, or a visual rework) to design it first as an HTML mockup that follows the project's existing design language. Extracts the design language from the codebase (tokens, components, layouts, wording), writes it down once, then proposes mockups rendered live in aiview for the user to react to. Not for implementing the React code (that comes after approval) and not for reviewing code quality (frontend-review).
---

# Frontend design

The controller for visual work: **learn the project's design language → propose mockups
in that language → iterate live → hand off to implementation.** A mockup is a thinking
tool the user can look at and argue with cheaply, the same way a diagram is in
`brainstorm`. It is not the implementation.

<HARD-GATE>
No component code, no route, no CSS in the app for the screen being designed until a
mockup exists, has been rendered in aiview, and the user has approved it. A tiny change
gets a tiny mockup (a cropped HTML fragment of the affected region), but it exists and
it's approved.
</HARD-GATE>

## Flow

1. **Load or build the design language** (§ below). If the project's
   `design-language.reference.md` exists and is younger than the last change to the
   token/UI files, read it and skip to 2. Otherwise extract it now, write it, register
   it in aiview (kind `reference`), and ask the user to skim it: one message, "does
   this match how you see the product?".
2. **Frame the screen**: one question at a time, only what changes the layout: who uses
   it, the primary action, the data it shows, the states it must handle (empty, loading,
   error, permission-denied), where it sits in navigation. Reuse names from
   `nomenclature`/`AGENTS.md`; never invent product vocabulary.
3. **Plan, then critique, then build** (two passes, mostly in your head). First a
   compact plan: which existing screen this pattern-matches, the layout as a one-sentence
   description plus an ASCII wireframe, the components it will be made of, the one thing
   the screen must make obvious. Then read the plan against the brief and the design
   language: anything that could have come from *any* app rather than this one, or that
   introduces a token/pattern the codebase doesn't have, gets revised. Say what changed.
   Only then write the HTML. Show the ASCII wireframe to the user when a layout question
   is genuinely open ("actions in a header bar or per row?"); it settles that in one
   exchange, cheaper than a full mockup.
   One direction by default. Offer 2–3 *directions* only when the user asks or the
   screen is new territory (no sibling to pattern-match), and then draw them small and
   side-by-side, not three full pages.
4. **Render and iterate**: write the file, register + serve it with aiview, tell the
   user the URL, edit the same file as they react. Check every state and the three
   viewport presets before calling it done.
5. **Handoff**: an implementation note at the bottom of the mockup file (HTML comment) or
   in the mockup's sibling `.md`: which existing components each region maps to
   (`ui/…`, `custom/…`), which new named components are needed and where they live,
   copy strings, and the acceptance list (states × viewports). Then stop; implementation
   is a separate step the user starts.

## The design language (`design-language.reference.md`)

It lives in the project's folder in the data home like everything else, but it is the
one document here that does **not** retire when a PR merges: every future mockup builds
on it. It is a cache of what the codebase already says, so when the token or UI files
have moved on, re-extract rather than patch.

Extract, don't guess. Read in this order and cite the file for every claim:

| Look at | To learn |
|---|---|
| Global CSS / theme file (`app.css`, `globals.css`, `theme.css`), Tailwind config | color tokens (both themes), radii, shadows, font stacks, type scale, spacing rhythm |
| Generated UI kit folder (`components/ui/`) | which primitives exist (Button, Dialog, Badge, Card, Table…) and their variants |
| Custom/wrapped components (`components/custom/`, `layout/`, `typography/`, `shell/`) | the project's *named vocabulary*: layout primitives, chips, pills, hints, state chips, dialogs, the words the codebase already uses for visual things |
| 2–3 representative existing screens (pages/routes) | page skeleton (shell, header, content width, section spacing), density, how lists/cards/tables are used, empty and loading states, where actions sit |
| Copy in those screens, `nomenclature.md`, `AGENTS.md` | tone, capitalization, button verbs, how errors are phrased |
| Existing mockups for this project (`aiview list --kind mockup --tag <project>`) | what has already been proposed and accepted or rejected |

Write it as the template in `design-language-template.md`: tokens (as CSS custom
properties, light + dark), type scale, spacing/radius/shadow, component vocabulary (name
→ purpose → where defined), layout patterns, states & feedback, voice, and an explicit
**"don't"** list (things the codebase avoids). Keep it to what a designer needs to draw
a new screen that looks native. Register it via the `aiview` skill: kind `reference`,
tags = project + design.

## Mockups

- **File:** `YYYY-MM-DD-<screen>.mockup.html` in the data home (ask the `aiview`
  skill for the path). One screen per file; variants as
  `…-<screen>-b.mockup.html`.
- **Self-contained:** inline `<style>` and, if needed, inline `<script>`; no CDN, no
  build. Start the `<style>` with the design-language tokens as `:root` custom properties
  (light) plus the dark overrides under `@media (prefers-color-scheme: dark)`, and use
  only those tokens. A new token is allowed only if flagged in the handoff note as
  "new token: needs a name in the theme".
- **Native look:** every region should be recognisably one of the project's components
  (annotate with `data-component="Pill"` etc. so the handoff maps 1:1). Real copy in
  the product's voice, never lorem. Real-looking data (names, counts, dates).
- **States:** default, empty, loading, error, and any permission/role state the screen
  has, as separate sections or a small state switcher in the mockup. Responsive at the
  aiview presets (mobile 390 · tablet 820 · laptop 1280).
- **Register + serve** via the `aiview` skill (`../aiview/SKILL.md` in this collection):
  kind `mockup` (from the filename), tags = project + feature, and when the mockup
  belongs to a brainstorm's piece of work, the board's group, so they share a
  container. Tell the user the URL it prints. aiview renders `.html` in a sandboxed
  iframe with viewport presets and live reload.

## Copy is design material

Write from the user's side of the screen: name things by what people control and
recognise, not by how the system is built (a teacher manages *graders*, not
*lab_graders rows*). Active voice; a control says exactly what happens ("Run graders",
then a toast "Graders queued"); an action keeps the same name through the whole flow.
Empty states invite the next action; errors say what went wrong and how to fix it, no
apology, no vagueness. Sentence case, plain verbs, the product's language(s). Every
element does one job: a label labels, an example demonstrates.

## Quality floor (built in, not announced)

Responsive down to the mobile preset; visible keyboard focus; `prefers-reduced-motion`
respected; contrast legible in both themes; touch targets not smaller than the
codebase's own buttons. Before calling a mockup done, look at it once more and remove
one thing: decoration that doesn't serve the job goes.

## Judgment calls

- **Pattern-match before inventing.** If a sibling screen already solves the same
  problem (a list of things with actions, a form in a dialog), the mockup uses that
  shape. Deviate only with a stated reason.
- **Density and hierarchy over decoration.** The product's screens are operated, not
  read: surface the summary before the detail, encode state in form (chip, opacity,
  stripe) not only in text. Semantic color (ok / warning / danger) stays separate from the
  accent.
- **Don't design the framework in.** The mockup describes the look; it does not
  prescribe Tailwind classes or React structure. The handoff note maps to *named*
  components, and rule "if you must read an element's classes to know what it is, it
  needs a name" applies to what gets built afterwards.
- **One question per message** while framing; **one mockup, then react** while
  iterating. Files created before approval get defended instead of discarded. Keep the
  mockup cheap to throw away.

## Red flags

| Thought | Reality |
|---|---|
| "I know this codebase's style" | Styles drift; re-read the token file and one screen. Cite them. |
| "I'll mock it up in React directly" | Then it's implementation, and the gate is gone. HTML first. |
| "This screen is too small for a mockup" | A cropped fragment takes five minutes and catches the wrong pattern before it's coded. |
| "Let me add a nicer color/font here" | New tokens are design-system changes; flag them, don't smuggle them. |
| "The user said 'make it pretty'" | Ask what job the screen does; prettiness follows from hierarchy in the existing language. |
| "A cream background and a serif display would look distinctive" | Distinctive-for-the-web is wrong here: the target is *native to this product*. Distinctiveness was decided when the design language was; a mockup inherits it. |
| "I'll skip the plan and just draw" | The plan is where "could be any app" gets caught. Sixty seconds of thinking, then draw. |

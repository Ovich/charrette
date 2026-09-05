---
name: frontend-design
description: Use before building or changing any screen (a new page, dialog, panel, or a visual rework) to design it first as a mockup or prototype in the project's own design language. Extracts the design language from the codebase (tokens, UI libraries, components, layouts, wording), writes it down once, then proposes mockups the user reacts to in the viewer. Not for implementing the screen (that comes after approval) and not for reviewing code quality (frontend-review).
---

# Frontend design

The controller for visual work: **learn the project's design language, propose mockups
in that language, iterate live, hand off to implementation.** A mockup is a thinking
tool the user can look at and argue with cheaply, the same way a diagram is in
`brainstorm`. It is not the implementation.

<HARD-GATE>
No component code, no route, no CSS in the app for the screen being designed until a
mockup exists, has been rendered in aiview, and the user has approved it. A tiny change
gets a tiny mockup (a cropped HTML fragment of the affected region), but it exists and
it's approved.
</HARD-GATE>

## Mindset

Approach the screen as a design lead with a point of view: every choice, palette,
type, layout, wording, is specific to this product and the people who use it, never the
default any app would get.

- **Native when a language exists.** The product's own tokens, primitives and words.
  Distinctiveness was decided when the design language was; a mockup inherits it and
  does not reopen it. Distinctive-for-the-web is the wrong target here.
- **Grounded in the subject.** Who uses the screen, what it is for, what those people
  already read every day. A nurse's roster and a trader's dashboard share nothing but
  the browser.
- **Pattern-match before inventing.** A sibling screen that solves the same problem, a
  list with actions, a form in a dialog, gives the shape. Deviate only with a stated
  reason.
- **Density and hierarchy over decoration.** Screens are operated, not read: the summary
  before the detail, state encoded in form (a chip, an opacity, a stripe) and not only in
  text, semantic colour apart from the accent.
- **Spend boldness in one place.** One element is the memorable thing, the rest quiet.
  Before calling a mockup done, remove one thing: decoration that does not serve the job.
- **The quality floor is built in, never announced.** Responsive to the mobile preset,
  visible keyboard focus, `prefers-reduced-motion` respected, contrast legible in both
  themes, touch targets no smaller than the codebase's own buttons.
- **Copy is design content.** Written from the person's side: things named by what
  people control and recognise (a teacher manages *graders*, not *lab_graders rows*),
  a control saying exactly what happens, the same name through the whole flow, empty
  states inviting the next action, errors saying what went wrong and how to fix it, no
  apology. Sentence case, plain verbs, the product's language. Each element does one job.
- **Don't design the framework in.** The mockup describes the look; it does not
  prescribe Tailwind classes or React structure. The handoff maps to named components.

## Flow

1. **Load or build the design language** (below). If the project's
   `design-language.reference.md` exists and is younger than the last change to the
   token and UI files, read it and skip to 2. Otherwise extract it now, write it,
   register it in aiview (kind `reference`), and ask the user to skim it in one message:
   "does this match how you see the product?". No codebase, or a codebase with no
   language of its own yet: `references/greenfield.md`.
2. **Frame the screen**: one question at a time, only what changes the layout: who uses
   it, the primary action, the data it shows, the states it must handle, where it sits in
   navigation. Reuse names from `nomenclature`/`AGENTS.md`; never invent product
   vocabulary.
3. **Plan, then critique, then build.** First a compact plan: which existing screen this
   pattern-matches, the layout in one sentence plus an ASCII wireframe, the components it
   is made of, the one thing the screen must make obvious. Then read the plan against the
   brief and the design language: anything that could have come from any app, or that
   introduces a token or pattern the codebase lacks, is revised, and the change is said.
   Only then write the HTML. Show the wireframe when a layout question is genuinely open
   ("actions in a header bar or per row?"); it settles that in one exchange. One
   direction by default; two or three only when asked or when the screen has no sibling
   to pattern-match, drawn small and side by side.
4. **Render and iterate**: write the file, register and serve it via the `aiview` skill,
   tell the user the URL, edit the same file as they react. Hand it over as something
   to change, not something finished: say the mockup is live and ask what they would
   change, spacing, wording, order, a region that feels off. Every answer is an edit to
   the same file, visible on save. A mockup is a working prototype, not a picture: the
   behaviour is mocked in the file so the flow can be walked through. When the ask is
   purely visual, or once the visual pass is approved, ask one question about the flow
   ("what happens when they press Apply?", "what does the empty state lead to?") and
   mock it. Check every variant and the three viewport presets before calling it done.
5. **Handoff**: an implementation note at the bottom of the mockup file (HTML comment):
   which existing components each region maps to, which new named components are needed
   and where they live, copy strings, and the acceptance list (variants times viewports).
   Then stop; implementation is a separate step the user starts.

## The design language (`design-language.reference.md`)

It lives in the project's folder in the data home like everything else, but it is the
one document here that does not retire when a PR merges: every future mockup builds on
it. It is a cache of what the codebase already says, so when the token or UI files have
moved on, re-extract rather than patch.

Extract, don't guess. Read in this order and cite the file for every claim:

| Look at | To learn |
|---|---|
| `package.json` (or the stack's equivalent): the UI libraries and their versions (shadcn, Radix, spartan, MUI, Angular Material, Bootstrap, Tailwind, a design system package) | which primitives the app already speaks, their sizes, radii, variants and names; the mockup uses those, never a look-alike of its own |
| Global CSS / theme file (`app.css`, `globals.css`, `theme.css`), Tailwind config | colour tokens (both themes), radii, shadows, font stacks, type scale, spacing rhythm |
| Generated UI kit folder (`components/ui/`) | which primitives exist (Button, Dialog, Badge, Card, Table) and their variants |
| Custom/wrapped components (`components/custom/`, `layout/`, `typography/`, `shell/`) | the project's named vocabulary: layout primitives, chips, pills, hints, state chips, dialogs, the words the codebase already uses for visual things |
| 2 to 3 representative existing screens (pages/routes) | page skeleton (shell, header, content width, section spacing), density, how lists, cards and tables are used, empty and loading states, where actions sit |
| Copy in those screens, `nomenclature.md`, `AGENTS.md` | tone, capitalisation, button verbs, how errors are phrased |
| Existing mockups for this project (`aiview list --kind mockup --tag <project>`) | what has already been proposed and accepted or rejected |

Write it as the template in `design-language-template.md`: tokens (as CSS custom
properties, light and dark), type scale, spacing, radius and shadow, the UI libraries
with versions, component vocabulary (name, purpose, where defined), layout patterns,
states and feedback, voice, and an explicit "don't" list. Keep it to what a designer
needs to draw a new screen that looks native. Register it via the `aiview` skill: kind
`reference`, tags = project + design.

## Mockups

- **File:** `YYYY-MM-DD-<screen>.mockup.html` in the data home (ask the `aiview` skill
  for the path). One screen per file. Its variants (states, steps, alternatives of that
  screen) live inside the file, never as sibling files.
- **Self-contained:** inline `<style>` and, if needed, inline `<script>`; no CDN, no
  build. Start the `<style>` with the design-language tokens as `:root` custom
  properties (light) plus the dark overrides under `@media (prefers-color-scheme: dark)`,
  and use only those tokens. A new token is allowed only if flagged in the handoff note
  as "new token: needs a name in the theme".
- **Native look:** every region is recognisably one of the project's components,
  annotated `data-component="Pill"` so the handoff maps one to one. Real copy in the
  product's voice, never lorem. Real-looking data.
- **Shared between mockups:** a component drawn once is bound by every other mockup
  that needs it, and a screen's variants are declared as buttons the viewer mirrors.
  How to declare, bind, keep a component bindable, and when to propose splitting a
  screen: `references/binding.md`. The first mockup of a project needs none of it.
- **Register and serve** via the `aiview` skill (`../aiview/SKILL.md` in this
  collection): kind `mockup` (from the filename), tags = project + feature, and when the
  mockup belongs to a brainstorm's piece of work, the board's group. Tell the user the
  URL it prints.

## Red flags

| Thought | Reality |
|---|---|
| "I know this codebase's style" | Styles drift; re-read the token file and one screen. Cite them. |
| "I'll mock it up in React directly" | Then it's implementation, and the gate is gone. HTML first. |
| "This screen is too small for a mockup" | A cropped fragment takes five minutes and catches the wrong pattern before it's coded. |
| "Let me add a nicer color/font here" | New tokens are design-system changes; flag them, don't smuggle them. |
| "The user said 'make it pretty'" | Ask what job the screen does; prettiness follows from hierarchy in the existing language. |
| "A cream background and a serif display would look distinctive" | Distinctive-for-the-web is wrong here: the target is native to this product. And with no language yet, that look is the first tell in `references/greenfield.md`. |
| "I'll skip the plan and just draw" | The plan is where "could be any app" gets caught. Sixty seconds of thinking, then draw. |
| "It looks right, we're done" | A picture leaves every state and transition to be guessed at coding time. Ask about the flow and mock it. |

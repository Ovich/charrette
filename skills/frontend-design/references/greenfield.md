# No design language yet

Read when there is no codebase to extract a design language from, or when the codebase
has no language of its own yet (a scaffold, a template, defaults never chosen). The
design language is then decided, not extracted, and this is how.

Adapted from the `frontend-design` skill in `github.com/anthropics/skills`, copyright
Anthropic, licensed under the Apache License 2.0 (a copy: `LICENSE-Apache-2.0.txt`,
beside this file). Changed here: rewritten in this collection's voice, shortened to the
greenfield case, the tells kept, a questions section added, the process folded into the
skill's own flow.

## Ask before drawing

Five questions at most, one message each, multiple choice where the options are
knowable. Their answers are the first lines of the design language, so they are asked
before any token is chosen and never guessed. Not deeper than this: the plan below is
where the design is argued, not the questionnaire.

1. **The stack and the UI library.** What the screens will be built with, and which
   component library or design system, if any: shadcn, Radix, spartan, MUI, Angular
   Material, Bootstrap, Tailwind alone, a house system, or none yet. The library's
   primitives are the vocabulary every mockup will speak, so this answer shapes all of
   them. "None yet" is an answer, and then the mockup's own components become the
   proposal.
2. **The subject and the people.** What the product is, who uses it, in what setting,
   with what they already read every day.
3. **What is being designed.** The screen, flow or component the person has in
   mind, and the one thing it must make obvious. Not assumed to be the entry page.
4. **Constraints already fixed.** A logo, brand colours, a typeface, an existing site
   or app it must sit beside, a platform (desktop, mobile first, both), a language.
5. **The reference point.** One or two products whose feel is right, and one whose feel
   is wrong. Not to copy, but to place the direction.

Anything else is decided in the plan and shown, not asked.

## The brief before the plan

The answers above are the brief. The subject's world is where distinctive
choices come from: its materials, its vernacular, what its people already read every
day. A roster for nurses and a dashboard for traders share nothing but the browser.

## The plan is a token system

Before any HTML, write the compact plan the skill's step 3 asks for, here as a design
brief:

- **Colour**: the base palette as four to six named hex values, one accent, semantic
  colours apart from it.
- **Type**: one family, or two clearly distinct, with their roles; a type scale with
  intentional weights and spacing; line lengths under 80 characters.
- **Layout**: one sentence and an ASCII wireframe; alignment stated.
- **Principles**: what makes this product's screens its own, in three lines.

Then read the plan against the tells below. Anything that could have come from any
similar brief gets revised, and the revision is said out loud. Only then write
`design-language.reference.md` from the plan, and every later mockup inherits it.

## The tells of a generated page

Generated design clusters around a few looks. Each is legitimate for some brief; none
is a choice when it appears regardless of subject. Where the brief pins a direction,
follow it. Where it leaves an axis free, do not spend the freedom on one of these:

- A warm cream background with a high-contrast serif display and a terracotta accent.
- A near-black background with one acid-green or vermilion accent.
- The broadsheet: hairline rules, zero radius, dense newspaper columns.
- The SaaS card kit: content chopped into identical rounded cards, one radius on
  everything, the same soft grey shadow under each, gradient washes as decoration.
- Template chrome whatever the subject: a tracked-out all-caps eyebrow above every
  heading, meta strings joined with middle dots, labels of the form "WORD, fragment",
  tinted near-black standing in for black, a monospace face for small data labels, an
  arrow appended to every link and button.
- Typographic tells: one word of a headline in italic or another colour, all caps for
  labels, a label above content that needs none, numbered markers on content that is
  not a sequence.
- Motion tells: fade-and-slide entrances on every section, a hover transition on every
  card. One orchestrated moment lands; motion that answers the person's action is
  welcome.

## Restraint

Spend boldness in one place: one element is the memorable thing, everything around it
quiet. The quality floor is built in, never announced. Before calling the plan done,
remove one thing.

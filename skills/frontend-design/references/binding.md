# Binding: components shared between mockups

## Declaring a component

A region another mockup may want carries `data-component="Name"` and styles itself
under that selector, `[data-component="Name"]` and descendants, never through element
or `body` rules, so it can be placed into another page without leaking.

**Bindable means static.** A bindable component is markup in the file, never the
output of the file's script. It carries no `id` and no inline handler, because it may
be placed more than once and into pages that do not define the handler. Parts a script
must reach are marked `data-part="name"` and found inside the bound element; clicks are
wired by delegation on `data-action`, never inline.

## Binding

To reuse a component from another mockup of the same project, place
`<div data-bind="file#Name"></div>` where it goes, `file` being the sibling's bare
file name. aiview replaces the placeholder with the component, no wrapper, the
placeholder's `class` and `style` merged on. Bound copies are markup and style: keep
behaviour in the source mockup, or write it in the host against the bound markup.
Editing the source reloads every open host.

Before writing a placeholder, ask the sibling what it offers: `aiview components
<file>` lists names, tags, and the ids or inline handlers that would break a component
once bound. After writing one, run `aiview check <host>` and read the errors as text.
Never grep a sibling for `data-component`.

**Components a host shows by script**, such as a dock of tools opened one at a time:
keep their placeholders in a hidden container of the host and let the host's script
clone the bound node's inner html when it needs it. A source that shows the same
components in place moves them out of its library at load, so the file stays static
markup.

**A bound mockup is seen through aiview.** Opened as a plain file it shows a notice,
not the page. Never hand one over as standalone HTML.

## Variants

Default, empty, loading, error, any permission or role state, the steps of a flow, the
alternatives of a layout: declare them as static buttons in one
`<div data-component="MockupBar">`, `data-aiview-variant="name"` on each,
`aria-pressed` on the one shown first; the mockup's script switches on a click of that
button. A plain button the person may press (reset, toggle a warning) carries
`data-aiview-action="name"` instead. aiview hides the bar and mirrors both in its own
toolbar above the frame, which is what makes a variant reachable in Composition and
keeps the chosen one across live reloads. Buttons a script adds later are invisible to
the viewer, by design.

## Decomposition is proposed, never done

When a region is drawn in two files, or a mockup grows a second screen's worth of
components, propose splitting in one line ("the tools could live in their own mockup
and be bound here, want that?") and wait. Never split a mockup on your own.

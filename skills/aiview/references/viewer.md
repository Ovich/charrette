# What the person sees

**Left, the sidebar.** Documents newest-activity first: a search field, kind chips (one
colour per kind, click to filter), tag chips (multi-select), grouped documents inside
collapsible containers (display title and member count, members in reading order),
ungrouped documents flat, missing files struck through. The active project scopes the
list; the selector at the top switches it, and the agent's `use` does the same.

**Right, the document.** Title, absolute local path (click to copy), kind, started,
tags, updated, then the rendered document: Markdown with GFM and mermaid, an HTML
mockup in a sandboxed frame, a PDF in the browser's viewer. Every save re-renders.
Above the content, one card per unit of work the document still waits on, appearing
and disappearing live (`pending`).

**A mockup's toolbar.** Three groups above the frame. *Viewport*: mobile 390, tablet
820, laptop 1280, full. *View*: Rendered is the page; Composition outlines every region
bound from another mockup in indigo, "pulled", with its source and component on hover
and a click opening that source at that component, every component the mockup offers
in green, "offered", and the rest of the page receding under a veil. In Composition
the page takes no mouse: it is looked at, not operated. *Variant*: the variants and
actions the mockup declares in its `MockupBar` (the `frontend-design` skill), mirrored
here; the in-page bar is hidden, the chosen variant persists across reloads.

**Bindings.** An html mockup that pulls components from siblings (`data-bind`) is
composed at serve time; the file on disk never changes. Opened as a plain file it shows
a notice, not the page. Saving a source reloads every open host.

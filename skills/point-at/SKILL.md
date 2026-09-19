---
name: point-at
description: "Use when about to ask the person a question, or explain something to them, about a screen, a region or a component of the interface: in an interview, a plan, a board, a review or plain chat. Also when the person says they do not see what is meant on a screen. Finds the screen's mockup and points the person's viewer at the components concerned, so the question is asked in the mockup's own names with the thing lit in front of them. Not for designing or changing a mockup (frontend-design), and not for a question with no screen in it."
---

# Point at it

**A question about a screen is asked with the screen in front of the person, in the mockup's own names.** A region named in the agent's words ("the door", "shell middle") comes back as "what is that?", and the question is lost with it.

1. **Find the mockup before writing the question**, through the `aiview` skill: `list --kind mockup --tag <project>`, or the one the person named. Read the mockup that draws the screen, the screen's own file and never the library it pulls from, and run `components` on it. Its `page` and `variants` lines are the vocabulary: every name the person can be shown on that page.
2. **What the mockup already answers is stated and confirmed, not asked.** Point at it all the same.
3. **Write the question in those names only.** A region with no name of its own is placed by the named component it sits in. Where the code differs from the mockup, say both: the mockup's name, then the code's `file:line`. A comparison with another screen points at the screen the decision changes, and names the other by its mockup and component.
4. **Point, then ask**: one `show <mockup>` with `--component <Name>` once per component, and `--variant` when they exist only in one. Three components at most, the ones the question is about. A name the command refuses is not on that page: go back to 1, never rephrase around it. `show` writes each name on the component it outlines, so the question uses the same names, and carries the link the command prints.
5. **One pointer per question**: each `show` replaces the last. Questions about different regions are asked one at a time, the one the others depend on first.
6. **No mockup draws it**: say so in the question and cite the screen's `file:line`. A layout that exists nowhere is never described in prose for the person to choose in: it goes to the `frontend-design` skill first.

`tabs: 0` in the command's answer means no viewer is open: the link in the question is how the person gets there.

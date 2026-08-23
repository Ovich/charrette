# Frontend review checklist

The sourced rule set behind `frontend-review`, one section per lens. Each rule is
a **checkable assertion** — a one-line *smell* a reviewer spots — `source`.

Two standing rules for every lens:

- **Don't re-report what biome / `eslint-plugin-react-hooks` / `react/jsx-key`
  already catch** (hooks-in-conditionals, missing `key`, unused vars). The value
  here is the *semantic* rules those tools can't see. Mention a lint-catchable
  issue only if it's slipping through.
- **Flag over-application, not just under.** Gratuitous memoization, a premature
  abstraction, a wrapper that earns nothing — say "consider removing." Less code
  is a finding.

---

## Lens 1 — Render correctness (purity · hooks · effects · state shape)

The highest-value lens: these are the bugs and confusions lint can't see. Weight
the **effects** rules heaviest — "a `useEffect` whose body is essentially a
`setState`" is the single highest-yield smell.

**Purity**
- **Render is pure** — no `fetch`, DOM writes, timers, subscriptions, or external
  logging in the component body; those belong in handlers/effects. Smell: `fetch(`,
  `document.`, `localStorage.`, `setTimeout(` at the top level of a component.
  `https://react.dev/learn/keeping-components-pure`
- **Nothing mutated that pre-existed this render** — props, state, context, or any
  object/array from before are read-only. Smell: `props.x =`, `.push/.sort/.reverse`
  on a prop or state value. `https://react.dev/learn/keeping-components-pure`
- **No outer-scope mutable reads/writes in render** (module `let` reassigned in
  render). Local mutation of in-render values is fine.
  `https://react.dev/learn/keeping-components-pure`

**Effects — you might not need one**
- **Derived values are computed in render, not stored in state + synced by effect.**
  Smell: `useState` + a `useEffect` whose only job is `setX(...)` from other
  state/props (`fullName`, `filteredList`). `https://react.dev/learn/you-might-not-need-an-effect`
- **Reset state on a prop change with a `key`, not an effect** that setStates on
  `[propId]`. `https://react.dev/learn/you-might-not-need-an-effect`
- **Event-specific logic lives in the handler, not an effect** — a POST on submit, a
  toast on click, notifying a parent. Smell: `useEffect(() => onChange(value), [value])`;
  an effect guarded by `if (submitted)`. `https://react.dev/learn/you-might-not-need-an-effect`
- **No effect chains** — effect B depending on state only effect A sets. Compute the
  cascade in one handler. `https://react.dev/learn/you-might-not-need-an-effect`
- **Fetching effects cancel stale responses** (`ignore` flag or `AbortController` in
  cleanup). Smell: `useEffect(() => { fetch(...).then(setState) }, [query])` with no
  cleanup. `https://react.dev/learn/you-might-not-need-an-effect`
- **External/browser stores via `useSyncExternalStore`**, not an effect mirroring an
  `online`/`resize`/`storage` value into state. `https://react.dev/learn/you-might-not-need-an-effect`

**Effect dependencies**
- **Never suppress exhaustive-deps** — fix the code to remove the dep, don't lie about
  the array. Smell: `// eslint-disable-next-line react-hooks/exhaustive-deps`.
  `https://react.dev/learn/removing-effect-dependencies`
- **Remove deps with updater functions / Effect Events**; no render-created
  objects/functions in a dep array. Smell: `const options = {…}` used as `[options]`;
  re-subscribing on every keystroke. `https://react.dev/learn/removing-effect-dependencies`

**State shape**
- **No redundant or mirrored state** — don't store what you can compute; don't seed
  `useState(props.value)` unless it's an `initial*`/`default*`. `https://react.dev/learn/choosing-the-state-structure`
- **Selection as an id/index, not a duplicated object; group always-together values;
  model status as one enum, not contradictory booleans** (`isLoading`+`isError` →
  `status`). Normalize deeply nested state. `https://react.dev/learn/choosing-the-state-structure`

---

## Lens 2 — Rendering & performance

- **Static data used in render is a module-level constant, not rebuilt each render.**
  Smell: an options list / config object / default style literal declared inside the
  component body when nothing in it depends on props or state.
  `https://react.dev/reference/react/useMemo`
- **List keys are stable data ids** — never the array index for a list that can
  reorder/insert/delete, never generated in render (`Math.random()`,
  `crypto.randomUUID()`). Index is fine only for static lists. `https://react.dev/learn/rendering-lists`
- **Route components are lazy-loaded** so the initial bundle ships only the active
  route, each behind a `<Suspense>` with a real fallback. Smell: every route imported
  statically; a `lazy()` with no boundary. `https://www.patterns.dev/vanilla/route-based/`
- **Very long lists (thousands of rows) are virtualized**, not all rendered.
  `https://www.patterns.dev/vanilla/virtual-lists/`
- **No cargo-cult memoization** — `memo`/`useMemo`/`useCallback` only for a genuinely
  expensive calc, referential stability for a `memo`'d child, or a hook dependency.
  Smell: `useMemo(() => a + b, …)`, blanket `memo()`, a `useCallback` consumed only by
  plain DOM. "There is no benefit… and code becomes less readable." `https://react.dev/reference/react/useMemo`
- **`memo` isn't defeated by new-every-render props** — a `memo`'d child receiving
  `person={{…}}`, `onClick={() => …}`, `items={[...]}` inline gains nothing. Stabilize
  or pass `children`/primitives. `https://react.dev/reference/react/memo`
- **If the React Compiler is on, drop manual `useMemo`/`useCallback`/`memo`** for the
  same optimization — redundant and less readable. `https://react.dev/learn/react-compiler`
- **Memoization is perf-only, never a correctness crutch** — if removing a `useMemo`
  causes a loop/bug, fix the underlying cause. `https://react.dev/reference/react/useMemo`

---

## Lens 3 — Structure, simplification & reuse

- **One main component per file, name matching the filename**; small helper
  subcomponents sit below it or in a sibling. Smell: two top-level components in a
  file. `https://github.com/airbnb/javascript/tree/master/react`
- **A component does one thing — statable in a single sentence.** Smell: a vague name
  (`Section`, `Wrapper`, `Main`) or a purpose needing "and". Extract a subcomponent
  once a chunk grows its own state/handlers or repeats. `https://react.dev/learn/thinking-in-react`
- **Split by responsibility, not line count** — but treat ~500+ lines as a strong
  signal to look for extractions. `https://medium.com/geekculture/how-many-lines-of-code-until-i-need-to-refactor-a-react-component-c1b8d16f5a5b`
- **Presentation is separated from logic** — data fetching / non-trivial state live in
  a custom hook or container; a presentational component takes data via props and
  doesn't massage it in render. `https://www.patterns.dev/react/presentational-container-pattern/`
- **Composition over prop-drilling** — a prop threaded unchanged through 2+ layers that
  don't read it becomes `children`/slots; Context only for genuinely wide data (auth,
  theme). Smell: "passenger" props forwarded through middles. `https://react.dev/learn/passing-data-deeply-with-context`
- **AHA — prefer duplication over the wrong abstraction.** Abstract when the pattern is
  obvious and stable (~3rd occurrence), not the 1st/2nd. Smell: a "reusable" component
  drowning in boolean/enum props and `if` branches to serve divergent callers.
  `https://kentcdodds.com/blog/aha-programming`
- **Reuse the existing primitives** rather than rebuilding — the layout (`Stack`,
  `Row`), typography (`Text`), and `ui/` dialog/button primitives already exist. Smell:
  hand-rolled flex/gap/text markup duplicating a primitive.
- **Simplify what's there** — dead code left behind, a wrapper (`Stack`/`Row`/`div`)
  now wrapping a single child, derivable state, needless nesting. Less code is the win.

---

## Lens 4 — Organization, naming, styling & typing

**Organization**
- **Colocate** — a component's helpers, hooks, and types live in/near its folder, not
  in distant `utils/`/`types/` mirrors. Extract to a shared location only when a
  *second* consumer appears. `https://kentcdodds.com/blog/colocation`
- **Unidirectional deps** — shared modules (`components/ui`, `components/custom/layout`)
  never import from features; features don't import each other's internals; composition
  happens at routes/pages. Smell: `ui/*` importing from `custom/classes/hub`; two
  sibling feature folders importing each other. `https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md`
- **No speculative folders; prefer direct imports over barrel `index.ts`** (better
  tree-shaking, honest dependencies). `https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md`

**Naming**
- **PascalCase components; filename matches, consistent case within a folder**
  (`ui/` is kebab-case here). `https://github.com/airbnb/javascript/tree/master/react`
- **Intent-revealing names** — `is/has/should` booleans, `handle*` internal handlers /
  `on*` handler props, `use*` hooks. No generic `data`/`temp`/`info`/`item2`. Smell: a
  boolean prop named `open`; `const data = …`. `https://www.sufle.io/blog/naming-conventions-in-react`
- **One concept, one name** — consistent domain vocabulary across files (e.g. always
  `class`/`hub`, not `course` here and something else there). `https://www.sufle.io/blog/naming-conventions-in-react`

**Styling (Tailwind + shadcn)**
- **Long raw `className` strings are wrapped into named primitives** (`Stack`/`Row`/
  `Text`), not left inline in feature code — the house convention, and Tailwind's own
  "extract a component for reuse" guidance. `https://tailwindcss.com/docs/styling-with-utility-classes`
- **Conditional/merged classes go through `cn()`** (clsx + tailwind-merge), never string
  concatenation or template literals — else conflicting Tailwind classes don't dedupe.
  `https://ui.shadcn.com/docs`
- **UI primitives expose a `className` prop merged last via `cn()`** so callers can
  override without wrapping. `https://ui.shadcn.com/docs`
- **Conditional classes are readable** — discrete `cn()` args or a variants map, not a
  nested-ternary pile-up. `https://ui.shadcn.com/docs`
- **No arbitrary values when a token exists** (`mt-[13px]`, `text-[#3b82f6]`) — reserve
  brackets for genuinely one-off cases. `https://tailwindcss.com/docs/styling-with-utility-classes`

**TypeScript**
- **Prefer inferred types over hand-modeled** — let Hono RPC (`InferResponseType`) and
  Drizzle models flow through rather than re-declaring shapes that then drift.
- **`children: React.ReactNode`; avoid `React.FC`; no `any`/`{}`/`object` props; typed
  event handlers; union types for enumerable props** (`variant: "primary" | "secondary"`,
  not `string`). `https://react-typescript-cheatsheet.netlify.app/docs/basic/getting-started/basic_type_example`

---
name: slidecraft-components
description: Create or extend Slidecraft slide components (`defineComponent` in `src/components/slides/`). Use for a new component, a new prop or variant on one, or a change to how a component renders or animates.
---

# Slidecraft slide components

A slide component is a React component a deck uses inside `<Slide>`. Each is created with
`defineComponent({ Component, registry, toolbar })`, and that registry entry is the single source
of truth: the gallery, the editor's palette, toolbar, help panel and completions, the docs-site
catalogue and the skills' component catalogue all read it. Register once; everything follows.

## Workflow

1. **Study a neighbour.** Find the closest existing component (the table in
   [`references/building.md`](references/building.md) says which one teaches what) and read it.
   Done when you know which hooks and variants yours will use.
2. **Write it** in `src/components/slides/<Name>.tsx` with `defineComponent`, meeting every
   requirement below. Put geometry and parsing in pure functions.
3. **Export** it from `src/components/slides/index.ts`. The MDX scope is built from that barrel, so
   decks can use it at once. There is no other list to update.
4. **Regenerate the catalogue:** `bun run skills`. Done when
   `skills/slidecraft-presentations/references/components.md` shows the new entry.
5. **Test:** `bun test tests/registry.test.ts` (exported, named, in the MDX scope, metadata
   complete, `snippet` and `previewCode` compile), pure-function tests in
   `tests/componentMath.test.ts`, render tests in `tests/components.test.tsx`, then `bun test` and
   `bun run build`. Done when all are green.
6. **Check it in the running app** (`bun run dev:status` first; reuse the server, never restart
   it): find it in `/gallery` and check the preview and props table; insert it in a deck's
   workspace with `⌘K` and change props from the toolbar; present it in dark and light schemes, in
   a framed theme, with steps, and as a thumbnail. Done when each of those looks right.
7. **Show it:** if authors should know about it, add a finished slide for it to the `welcome`
   deck in `content/`.

## Requirements

- **Motion:** the root is a `motion.*` element using the shared variants
  (`src/animations/variants.ts`), so the slide's entry stagger orchestrates it. Timings come from
  `src/animations/springs.ts`.
- **Fixed pixels:** every size in px on the 1920 × 1080 stage; the content area is about
  1760 × 920, so full-width components are 1760 px wide. No `%`, `vw`, `vh`, `rem`, `clamp()`.
- **Inline styles** (style objects); no global stylesheet for slide components.
- **Theme variables for colour:** `var(--text)`, `var(--muted)`, `var(--bg)`,
  `var(--font-display)`, `var(--font-body)`, accents through `accentColors[accent]` and
  `tint(accent, alpha)` from `accents.ts`. Themes and schemes then work with no extra code.
- **Accent inheritance:** take `accent?: AccentColor` and resolve it with `useAccent(accent)`, so a
  missing accent means the slide's.
- **Steps and morphs:** a component that can be staged takes `step?: number` and `morph?: string`
  and spreads `useStepMotion(step, morph)` on its root, so staging never wraps it and it keeps its
  place in a grid.
- **Thumbnails:** `useInThumbnail()` is true in rails, overviews and handouts; anything timed or
  interactive (count-up, auto-scroll, video) renders its final state there.
- **Typed props:** export a `<Name>Props` interface; no `any` in public props.
- **Registry entry:** `description` is one sentence ending with a period; every prop an author may
  write is in `props`, with `default` equal to what the code does; `snippet` is the smallest useful
  usage; `previewCode` is a `<Slide>` that looks good at thumbnail size; `toolbar` lists the props
  the editor's toolbar may change (leave out structured values). Field by field:
  [`docs/component-registry.md`](../../docs/component-registry.md).

The full worked example, the definition type, the animation building blocks and the components
worth studying are in [`references/building.md`](references/building.md).

## Scope

Work in `src/components/slides/`, the shared animations in `src/animations/`, and the component
tests. The editor, language service, server, parser and themes belong to the `slidecraft-dev`
skill: a component that seems to need one of them is a framework task, so hand it over.

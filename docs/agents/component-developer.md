# Component developer guide

You add or extend **slide components**: the React components a deck uses inside `<Slide>`. Every
one is registered, and the registry feeds the gallery, the editor's palette, toolbar, help panel
and completions, the docs-site catalogue, the chat prompt and the `AGENTS.md` the server writes
into content folders. Register it once and all of those pick it up.

Not your job: deck content (the [author guide](presentation-author.md)) or the editor, parser,
server and runtime (the [framework guide](framework-developer.md)).

## The workflow

1. **Create** `src/components/slides/<Name>.tsx` with `defineComponent({ Component, registry, toolbar })`.
   The registry metadata and toolbar configuration live inside the definition, next to the code.
2. **Export** it from `src/components/slides/index.ts`. The MDX scope is built from that barrel,
   so the component is immediately usable in decks.
3. **Run** `bun test tests/registry.test.ts`, then the full `bun test` and `bun run build`.

There is no third list to update: no hand-written docs table, no separate palette entry.

## Technical requirements

- **Motion:** the root is a `motion.*` element using the shared variants
  (`src/animations/variants.ts`), so the slide's entry stagger orchestrates it.
- **Fixed pixels:** every size in px on the 1920 × 1080 stage. No `%`, `vw`, `vh`, `clamp()`,
  `rem`. The content area is about 1760 × 920; full-width components are 1760 px wide.
- **Inline styles** (CSS-in-JS objects). No new global stylesheet for slide components.
- **Theme variables, never hex colours:** `var(--text)`, `var(--muted)`, `var(--bg)`,
  `var(--font-display)`, `var(--font-body)`, and accents through `accentColors[accent]` and
  `tint(accent, alpha)` from `accents.ts`. Themes and schemes then work without extra code.
- **Explicit TypeScript:** export a `<Name>Props` interface; no `any` in public props.
- **Accent inheritance:** take `accent?: AccentColor` and resolve it with `useAccent(accent)`, so
  an omitted accent means the slide's.
- **Steps and morphs:** if the component can be staged, take `step?: number` and `morph?: string`
  and spread `useStepMotion(step, morph)` on the root. Staging then never wraps the element, so
  it keeps its place in a grid.
- **Thumbnails:** `useInThumbnail()` is true in rails, overviews and handouts. Anything
  interactive or timed (auto-scroll, count-up, video) must render its final state there.

## A complete component

```tsx
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepMotion } from '../../animations/stepMotion'
import { itemVariants } from '../../animations/variants'
import { accentColors, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface BadgeProps {
  children?: ReactNode
  label: string
  /** Defaults to the slide accent. */
  accent?: AccentColor
  step?: number
  morph?: string
}

function BadgeComponent({ children, label, accent: accentProp, step, morph }: BadgeProps) {
  const accent = useAccent(accentProp)
  return (
    <motion.div
      variants={itemVariants}
      {...useStepMotion(step, morph)}
      style={{ display: 'flex', gap: 24, alignItems: 'center', padding: '24px 40px', borderRadius: 12, background: tint(accent, 0.15) }}
    >
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 48, color: accentColors[accent] }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 32, color: 'var(--text)' }}>{children}</span>
    </motion.div>
  )
}

export const Badge = defineComponent<BadgeProps>({
  Component: BadgeComponent,
  registry: {
    id: 'badge',
    name: 'Badge',
    category: 'component',
    description: 'A large label with a short line of text beside it.',
    props: [
      { name: 'label', type: 'string', description: 'The large label' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
      { name: 'morph', type: 'string', description: 'Shared-element id' },
    ],
    snippet: '<Badge label="v2">Ships in March</Badge>',
    previewCode: '<Slide scheme="dark">\n  <Badge label="v2">Ships in March</Badge>\n</Slide>',
    keywords: ['badge', 'label', 'version'],
    useCases: ['A version or status next to one line of text'],
  },
  toolbar: [{ prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] }],
})
```

## The definition

```ts
interface ComponentDefinition<P> {
  Component: FC<P>
  registry: {
    id: string            // unique kebab-case: 'two-column'
    name: string          // PascalCase, equal to the export name: 'TwoColumn'
    category: 'component' | 'template'
    description: string   // one sentence, ending with a period
    props: { name: string; type: string; default?: string; description?: string }[]
    snippet: string       // MDX inserted at the cursor from the palette
    previewCode: string   // MDX wrapped in <Slide>, rendered live in the gallery and palette
    keywords?: string[]   // extra search terms
    useCases?: string[]   // shown in the gallery and the help panel
  }
  toolbar?: { prop: keyof P; type: 'boolean' | 'select' | 'number' | 'image'; options?: string[]; min?: number; max?: number; step?: number }[]
}
```

- `props` documents what authors may write. Keep `default` equal to what the code does, as a
  string of the literal (`'"teal"'`, `'false'`, `'1600'`).
- `snippet` must be the smallest useful usage; `previewCode` must look good at thumbnail size.
- `toolbar` lists the props the editor's contextual toolbar can change on a selected element.
  Leave out props that need structured values (arrays of objects); authors edit those in code.
- Templates are whole-slide snippets: `defineTemplate({ id, name, description, snippet, previewCode })`
  in `templates.ts`. They have no props and appear in the palette and "Add slide".

More detail and conventions per field: [`docs/component-registry.md`](../component-registry.md).

## Animation building blocks

| Export | File | Use |
|---|---|---|
| `itemVariants` | `animations/variants.ts` | the default entry of an element (fade and rise) |
| `staggerContainer` | `animations/variants.ts` | a parent whose children enter one after another |
| `scaleInVariants` | `animations/variants.ts` | an element that grows in (numbers, badges) |
| `springs` | `animations/springs.ts` | the shared spring presets; never invent new timings |
| `useStepMotion(step, morph, enter)` | `animations/stepMotion.ts` | step reveal and morph on the component's own root |
| `drawProps(order, dashed)` | `components/slides/draw.ts` | a connector that draws itself in source order |
| count-up helpers | `animations/countUp.ts` | parse a value like `"4.2 s"` and animate the number only |

## Components worth studying

| Component | Lesson |
|---|---|
| `Callout` | the minimal shape: accent inheritance, step and morph on the root, a toolbar |
| `Card` | a container that works in grids, `compact` variant, bare boolean `accent` |
| `Stat` | count-up that parses units and leaves labels alone; `countUp={false}` |
| `List` / `ListItem` | context between parent and children; per-item steps |
| `BlockDiagram` | layout computed from data (grid boxes, edge routing) and drawn connectors |
| `CycleDiagram` | ring geometry kept in pure functions that tests can check |
| `ScatterChart` | an interactive component: tabs, keyboard, a draggable threshold, a frozen thumbnail |
| `Code` | timed behaviour (auto-scroll) that stops in thumbnails |

## Files

- **Work in:** `src/components/slides/`, `src/animations/` (shared variants only),
  `tests/components.test.tsx`, `tests/componentMath.test.ts`.
- **Do not modify** for a component: the editor (`src/editor/`), the language service, the
  server, the parser, the themes. If a component seems to need one of those, it is a framework
  task; hand it over.

## Testing

1. `bun test tests/registry.test.ts`: the component is exported, named, in the MDX scope, its
   metadata is complete and its `snippet` and `previewCode` compile.
2. Put geometry and parsing in pure functions and test them in `tests/componentMath.test.ts`;
   render tests go in `tests/components.test.tsx`.
3. `bun run build`, then in the running app (`bun run dev:status` first; never restart it):
   - open `/gallery`, search for the component, check the preview and the props table;
   - open a deck in the editor, press `⌘K`, find it, insert it, change props from the toolbar;
   - present the deck and check light and dark schemes, a framed theme, steps and thumbnails.
4. If the component is a feature authors should know about, add a slide for it to the welcome deck.

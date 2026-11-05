# Building a component

A worked example, the definition type, the animation helpers, and the components whose code is
worth reading before you write your own.

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
    parent?: string       // for a part read by another component: listed inside that one
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

More detail and conventions per field: [`docs/component-registry.md`](../../../docs/component-registry.md).

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
| `List` / `ListItem` | context between parent and children; per-item steps; `ListItem` has `parent: 'List'` |
| `SignalFlow` / `SignalNode` | a parent that reads its parts' props and draws them itself; parts render nothing alone |
| `BlockDiagram` | layout computed from data (grid boxes, edge routing) and drawn connectors |
| `CycleDiagram` | ring geometry kept in pure functions that tests can check |
| `ScatterChart` | an interactive component: tabs, keyboard, a draggable threshold, a frozen thumbnail |
| `Code` | timed behaviour (auto-scroll) that stops in thumbnails |

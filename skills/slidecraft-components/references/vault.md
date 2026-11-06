# Vault components and templates

A vault can carry its own components and slide templates. They join the built-ins while the vault
is open in Slidecraft: its decks, the editor, the palette and the Component Gallery all see them,
and one with a built-in's name replaces that built-in in this vault only. The person usually watches
the gallery while you work: it shows your component live each time you save.

## A component

```
components/<Name>/
  index.tsx      the entry: defineComponent for <Name>, and for its parts
  *.ts, *.tsx    other files, imported relatively (optional)
  README.md      what it is for, for people and agents (optional; the app does not read it)
```

- `<Name>` is PascalCase and is exactly the `registry.name` and the JSX tag (`<FunnelBars>`).
- A part (an element used only inside it, like `FunnelStage` in `<FunnelBars>`) is defined in the
  same folder with `parent: '<Name>'`. Nothing else may be defined there.
- **Imports:** `slidecraft`, `react`, `react/jsx-runtime`, `motion/react`, and files in the folder.
  Anything else, an npm package or a file outside the folder, does not compile.
- `slidecraft` holds `defineComponent`, the accents, motion variants and springs, the step hooks,
  the layout hooks and every built-in component:
  [`slidecraft-api.md`](slidecraft-api.md). Compose built-ins (`Text`, `Card`) instead of
  redrawing them.
- The requirements in `SKILL.md` apply: motion root, pixels on the 1920 × 1080 stage, inline
  styles, theme variables, accent inheritance, steps, thumbnails, typed props, a complete registry
  entry.
- Call `defineComponent` only at the top level of the module.

```tsx
import { motion } from 'motion/react'
import { defineComponent, itemVariants, useAccent, accentColors, type AccentColor } from 'slidecraft'

export interface BadgeRowProps {
  items: string[]
  accent?: AccentColor
}

export const BadgeRow = defineComponent<BadgeRowProps>({
  Component: function BadgeRowComponent({ items, accent }) {
    const colour = accentColors[useAccent(accent)]
    return (
      <motion.div variants={itemVariants} style={{ display: 'flex', gap: 24 }}>
        {items.map((item) => (
          <span key={item} style={{ padding: '12px 28px', borderRadius: 999, border: `3px solid ${colour}`, fontFamily: 'var(--font-body)', fontSize: 32 }}>
            {item}
          </span>
        ))}
      </motion.div>
    )
  },
  registry: {
    id: 'badge-row',
    name: 'BadgeRow',
    category: 'component',
    description: 'A row of outlined badges in the accent colour.',
    props: [
      { name: 'items', type: 'string[]', description: 'The badge labels' },
      { name: 'accent', type: '"teal" | "yellow" | "red" | "navy"', description: 'Optional; defaults to the slide accent' },
    ],
    snippet: '<BadgeRow items={["Fast", "Safe", "Simple"]} />',
    previewCode: '<Slide scheme="dark">\n  <BadgeRow items={["Fast", "Safe", "Simple"]} />\n</Slide>',
    keywords: ['badges', 'tags', 'labels'],
    useCases: ['Three qualities of a product in one line'],
  },
})
```

## A template

```
templates/<id>/index.mdx
```

`<id>` is lower-case words joined by dashes. The file is frontmatter, then exactly one `<Slide>`:

```mdx
---
name: Funnel Slide
description: A conversion funnel with a one-line takeaway.
keywords: [funnel, conversion]
useCases:
  - Where people drop out of a sign-up flow
---
<Slide scheme="dark" layout="document">
  <Subtitle>Conversion</Subtitle>
  <Title>Most visitors leave before signing up</Title>
  <FunnelBars stages={[{ label: "Visited", value: 100 }, { label: "Paid", value: 9 }]} />
</Slide>
```

Each value is on one line; quote a value with ` #` in it. `theme: <id>` makes the gallery preview
it in that theme (for a theme's frames). A template named like a built-in template replaces it.

## A copy of a built-in

Editing a built-in in the gallery first copies it into the vault: its file, with every app import
pointed at `slidecraft`, in `components/<Name>/index.tsx` (or the template in
`templates/<id>/index.mdx`), beside a `.slidecraft-origin.json` that records which built-in and
which app version it came from. The copy replaces the built-in in this vault.

- Keep the name, the parts' names and every prop the built-in has: decks in the vault already use
  them. Add props rather than renaming them.
- Leave `.slidecraft-origin.json` alone. The gallery uses it to compare the copy with the built-in
  and to say when the app's built-in has changed.
- Resetting to the built-in deletes the folder. It is the person's button in the gallery, not
  something to do yourself.

## Workflow

1. **Read** [`slidecraft-api.md`](slidecraft-api.md), and the `slidecraft-presentations` skill's
   `references/components.md` for the built-ins you will compose. If the folder exists, read
   every file in it first.
2. **Write** only inside `components/<Name>/` or `templates/<id>/`. Nothing in decks changes
   unless the person asks for it.
3. **Validate** with `validate_component` (`name`: the component name or template folder) after
   every change, and fix every error: it compiles the folder with the import rule, loads it, checks
   the registry entry, and checks `snippet` and `previewCode` the way `validate_deck` checks a deck.
   Slidecraft runs the same check after your turn and tells you about errors in the next message.
4. **Report** in a few lines: the props, what the preview shows, and anything to decide. The
   person can undo your turn in the conversation.

There is no `bun test` and no `src/` in a vault: `validate_component` is the test. If the vault's
components are not allowed to run (Settings › Vaults in Slidecraft), it does not compile, load or
check the folder at all; say so, and leave the choice to the person.

Nothing else is needed for decks that use the component: the editor, the presenter, HTML and PDF
exports and the MCP tools all load it from the folder.

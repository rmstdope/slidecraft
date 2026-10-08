# Creating presentations

The condensed authoring guide. The full version, with the reasons behind each rule, is the
[presentation author guide](agents/presentation-author.md).

## Create a deck

1. Make a folder in the content directory, named in lower-case words joined by dashes:
   `quarterly-review/`.
2. Add `index.mdx`:

```mdx
import { Presentation, Slide, Title, Subtitle, Text, List, ListItem, Notes } from '@components'

<Presentation theme="slidecraft">

<Slide scheme="dark" accent="yellow">
  <Subtitle>Platform team</Subtitle>
  <Title>Quarterly review</Title>
  <Notes>0:00-0:30. Welcome, and what we will decide today.</Notes>
</Slide>

</Presentation>
```

3. Open `http://localhost:6100/quarterly-review` (or the port the binary prints). The page reloads
   on every save.

Agents can do the same with the `create_presentation` tool.

## Add slides

Each `<Slide>` is one slide; keep a blank line between them.

```mdx
<Slide layout="document">
  <Subtitle>Results</Subtitle>
  <Title>Builds dropped from 38 to 9 minutes</Title>
  <TwoColumn>
    <Stat value="38 min" label="before" />
    <Stat value="9 min" label="after" />
  </TwoColumn>
  <Notes>2:00-2:40. Measured over two weeks on the main repository.</Notes>
</Slide>
```

## Slide props

| Prop | Values |
|---|---|
| `scheme` | `dark` / `light` |
| `accent` | `yellow` / `red` / `teal` / `navy` |
| `layout` | `centered` (default) / `document` |
| `gradient` | `none` / `radial` / `radial-accent` / `diagonal` / `spotlight` |
| `frame` | a frame of the theme (`title`, `section`, `content` in folio) |
| `transition` | `slide` / `fade` / `morph` / `slide-up` / `zoom` / `push` / `flip` / `cube` |
| `canvas`, `camera` | slides on one plane |
| `hidden` | skipped when presenting |

## Common components

```mdx
<List>
  <ListItem>One point per line</ListItem>
  <ListItem step={1}>This one arrives on the first step</ListItem>
</List>

<TwoColumn>
  <Card title="Option A">Fast to add.</Card>
  <Card title="Option B">Safe to keep.</Card>
</TwoColumn>

<FourColumn>
  <Card compact title="Plan">Week 1</Card>
  <Card compact title="Build">Weeks 2 to 5</Card>
  <Card compact title="Test">Week 6</Card>
  <Card compact title="Ship">Week 7</Card>
</FourColumn>

<Stat value="72%" label="cache hit rate" />

<Callout label="Rule:">The one thing to remember.</Callout>

<Timeline color="teal" events={[
  { date: "Jan", title: "Kick-off" },
  { date: "Mar", title: "Beta" },
  { date: "Jun", title: "Launch", isDeadline: true },
]} />

<Quote author="Pilot team lead">Merges just go through.</Quote>
```

Every component, with its props and a live preview, is in the gallery at `/gallery`.

## Motion, short version

| Say | Write |
|---|---|
| this arrives now | `<Step at={1}>…</Step>`, or `step={1}` on a component in a grid |
| this is the same thing as before | `morph="id"` on both slides, `transition="morph"` on the second |
| this is a part of a whole | `canvas="name"` and `camera={{ x, y, scale }}` |
| this is a measurement | `Stat` counts up; `countUp={false}` for years |

Nothing else moves on purpose. Three or four steps per slide at most.

## Do and don't

| Do | Don't |
|---|---|
| use registered components | write `<div>`, `<p>`, `<ul>`, `<h1>`, `<br>`, `<img>` |
| size in pixels | use `%`, `vw`, `vh`, `clamp()` |
| one accent per slide; omit `accent` on children | give peers different colours |
| declare colour meanings in a `COLOUR LEGEND` comment | let a colour mean two things |
| eyebrow `Subtitle`, then a one-line `Title` | let a document title wrap |
| `<Notes>` with a time budget on every slide | leave the speaker guessing |
| stage content in speaking order | animate for interest |

## Why no raw HTML

Raw elements have no entry animation, ignore the theme and do not scale with the design system.

```mdx
{/* Bad */}
<div style={{ fontSize: '2vw' }}>
  <p>First point<br />Second point</p>
</div>

{/* Good */}
<List>
  <ListItem>First point</ListItem>
  <ListItem>Second point</ListItem>
</List>
```

## Images

```mdx
import chart from './images/chart.png'

<ContentImage src={chart} alt="Build time per week" width={1100} />
```

Put images beside the deck in `images/`. Supported: png, jpg, gif, webp, svg. Always write `alt`.

## Quick reference

- Stage: 1920 × 1080; content area about 1760 × 920.
- Sizes: Title 100–120 px, Subtitle 32–40, body 28–36, list items 28–32, padding 40–80, gaps 24–80.
- Keys while presenting: `→` next step, `↓` next slide, `M` overview, `D` dev mode, `P` presenter,
  `A` draw, `Esc` edit this slide, `?` all shortcuts.
- Example decks: `welcome` (everything), `folio-tour` and `folio-minimal` (frames), `motion`
  (every motion tool), `safe-retries` (a full talk with notes).

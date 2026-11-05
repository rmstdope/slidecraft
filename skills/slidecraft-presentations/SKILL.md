---
name: slidecraft-presentations
description: Create and edit Slidecraft presentations (MDX decks, `<name>/index.mdx`). Use for any change to a deck's slides, titles, notes, images, theme, colour or motion, and for writing a new deck.
---

# Slidecraft presentations

A deck is one MDX file, `<vault>/<name>/index.mdx`: a `<Presentation>` root whose children are
`<Slide>` elements built from registered components. Every slide is authored at a fixed
1920 × 1080 pixels and scaled as a picture, so nothing reflows.

## Workflow

1. **Read the house style.** The vault's own `AGENTS.md`, when it is hand-written, sets tone,
   language and required slides; on style it wins over this skill. Done when you know its rules,
   or know there is none.
2. **Read before you write.** Open the deck's `index.mdx` (or `read_presentation`). For a new
   deck, pick a folder name of lower-case words joined by dashes. Done when you can name the
   slide you will change and what is on it.
3. **Edit the file.** Change what was asked, slide by slide, following the rules below. Reach for
   the references when a branch needs them:
   - which component fits, its props, code and images → [`references/components.md`](references/components.md)
     (every component, generated from the registry) and [`references/choosing.md`](references/choosing.md);
   - themes, frames, "official" or branded decks, colour beyond the accent → [`references/themes-and-colour.md`](references/themes-and-colour.md);
   - steps, morphs, canvases, count-ups → [`references/motion.md`](references/motion.md);
   - a whole new deck or a framed deck → [`references/examples.md`](references/examples.md).
4. **Validate.** Run `validate_deck` on the deck after every edit and fix every error it reports.
   Done when it reports none.
5. **Look.** Run `screenshot_slide` on each slide you changed and compare it with what you meant:
   nothing cut off, the title on one line, one accent. Done when every changed slide looks right.
   Without the `slidecraft` tools (some agents, or an organisation's policy, block them), skip
   steps 4 and 5: Slidecraft checks every deck you changed after your turn and passes any
   problem back to you with the next message.
6. **Report** in a sentence or two what changed. Inside Slidecraft the person already sees the
   deck; give a URL only when you work from a terminal (`http://localhost:<port>/v/<vault>/<name>`).

## Rules

1. **Components only.** Never raw HTML (`div`, `p`, `ul`, `h1`, `br`, `img`): use `Text`,
   `List`/`ListItem`, `ContentImage`. Raw elements bypass the theme and the entry animation.
2. **Registered components and props only**, imported from `@components` on the first line.
3. **Fixed pixels.** Any size is pixels on the 1920 × 1080 stage; the content area is about
   1760 × 920. Never `%`, `vw`, `vh`, `rem`, `clamp()`, `min()`, `max()`.
4. **One accent per slide.** Every item takes the slide's accent; a second colour only when it
   means something the deck's colour legend declares.
5. **Motion carries meaning** or does not happen: arrives now, same thing as before, part of a
   whole, a measurement.
6. **Document titles are single-line assertions.**

## The file

```mdx
import { Presentation, Slide, Title, Subtitle, Text, List, ListItem, Notes } from '@components'

<Presentation theme="slidecraft">

<Slide scheme="dark" accent="yellow">
  <Subtitle>Platform team, October</Subtitle>
  <Title>Builds in under ten minutes</Title>
  <Notes>0:00-0:40. What to say on the opener.</Notes>
</Slide>

<Slide layout="document">
  <Subtitle>Today</Subtitle>
  <Title>Every branch starts from an empty cache</Title>
  <List>
    <ListItem>Two thirds of the work rebuilds unchanged code</ListItem>
    <ListItem>Queues grow in the afternoon</ListItem>
  </List>
  <Notes>0:40-2:00. The numbers come from last month's CI logs.</Notes>
</Slide>

</Presentation>
```

- A blank line between slides; slide content indented by two spaces; `<Notes>` last in the slide.
- Images sit next to the file and are imported: `import chart from './images/chart.png'`, then
  `<ContentImage src={chart} alt="…" width={1150} />`.
- YAML frontmatter at the top is kept byte for byte and never read. MDX comments `{/* … */}`
  render nothing; the colour legend lives in one.
- `<Slide hidden>` stays in the file and is skipped when presenting.

## Slide props

| Prop | Values | Notes |
|---|---|---|
| `scheme` | `dark` / `light` | `<Presentation scheme>` sets it for slides without one; some themes fix it |
| `accent` | `yellow` / `red` / `teal` / `navy` | the slide's one colour; `<Presentation accent>` for the deck |
| `gradient` | `none` / `radial` / `radial-accent` / `diagonal` / `spotlight` | never on a framed slide |
| `background` | any CSS background | wins over `gradient` |
| `layout` | `centered` / `document` | see Layout |
| `frame` | a frame of the theme, or `none` | see the themes reference |
| `transition` | `slide` / `fade` / `morph` / `slide-up` / `zoom` / `push` / `flip` / `cube` | `morph` pairs with `morph="id"` |
| `canvas`, `camera` | name; `{ x, y, scale, rotate }` | slides on one plane |
| `theme` | another theme for this slide only | rare |
| `hidden` | bare attribute | skipped when presenting |

## Layout

- **`centered`** (the default): openers, section breaks, statements, closers. Multi-line titles are
  fine here.
- **`document`**: the eyebrow `Subtitle` first, then the `Title`, then **one** body component (or
  one layout of peers), optionally followed by one `Callout` or `Text`. Pass `align="left"` to a
  `Text` in a document slide outside a frame.

## Titles

A document title is a single-line **assertion**: the point of the slide, not its topic. Two lines
is the ceiling; the guides (`G`) mark two lines amber and three red.

- A wrapping title is a signal to rewrite it shorter, never to shrink the text.
- The eyebrow carries the subject, so the title need not repeat it. Read the pair as one unit.
- Drop "is a", articles and qualifiers. The short title must still point the right way alone.

| Before | After |
|---|---|
| *Caching* · "Our current approach to caching build outputs is not working well" | *Caching today* · "Every branch starts from an empty cache" |
| *Results* · "The results of the pilot showed that build times went down" | *Pilot results* · "Builds dropped from 38 to 9 minutes" |

## Speaker notes

Every content slide gets `<Notes>`. The first line is a time budget (`4:00-4:50.`), then what to
say, then what the speaker needs that the slide does not show: sources, numbers, names. For
research, add a `Source:` line and mark estimates as estimates. Notes may use Markdown.

## Scope

Work with decks and their images. A deck that needs a component that does not exist is a task for
the `slidecraft-components` skill in the Slidecraft repository; say so instead of imitating the
component with other parts.

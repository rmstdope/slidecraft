# Presentation author guide

You write and edit Slidecraft decks. A deck is one MDX file, `<content-dir>/<name>/index.mdx`,
whose root is `<Presentation>` and whose children are `<Slide>` elements built from registered
components. Slides are authored at a fixed 1920 × 1080 pixels and scaled as a whole.

## Important rules

1. **No raw HTML.** Never `<div>`, `<p>`, `<ul>`, `<h1>`, `<br>`, `<img>`. Use components:
   separate `<Text>` elements instead of `<br>`, `List`/`ListItem` instead of `ul`.
   Raw elements have no entry animation, bypass the theme and do not follow the design system.
2. **Fixed pixels.** Any size you set is in pixels on the 1920 × 1080 stage. Never `%`, `vw`, `vh`,
   `clamp()`, `min()`/`max()`, `ch`. Usable content area: about 1760 × 920.
3. **Only registered components and props.** The component list (the gallery at `/gallery`, the
   generated `AGENTS.md` in the content folder, or the catalogue on the docs site) is the source
   of truth.
4. **One accent per slide**, and a deck-wide colour legend for any colour that means something.
5. **Motion only when it carries meaning.**
6. **Document titles are single-line assertions.**

## The file

```mdx
import { Presentation, Slide, Title, Subtitle, Text, Notes } from '@components'

<Presentation theme="slidecraft">

<Slide scheme="dark" accent="yellow">
  <Subtitle>Team, date</Subtitle>
  <Title>My talk</Title>
  <Notes>0:00-0:40. What to say.</Notes>
</Slide>

</Presentation>
```

- Import every component you use from `@components`. Images sit next to the file and are imported
  by relative path: `import diagram from './images/diagram.png'`, then `<ContentImage src={diagram} />`.
- Keep a blank line between slides and indent slide content by two spaces. Optional YAML
  frontmatter at the top is kept as is and never interpreted.
- `<Notes>` holds speaker notes; put it last inside the slide.
- `<Slide hidden>` keeps a slide in the file but skips it when presenting.
- MDX comments `{/* … */}` render nothing; they carry deck-level metadata such as the colour legend.

## Component families

| Family | Components |
|---|---|
| Text | `Title` (`size`: hero, standard, compact), `Subtitle` (all-caps eyebrow), `Text` (`align`, `size`, `muted`), `Accent`, `Highlight`, `Caption`, `CenteredStatement`, `Quote`, `Code`, `TagPill`, `Divider`, `Section` |
| Lists | `List` + `ListItem`, `ProConList` |
| Layout | `TwoColumn`, `FourColumn`, `Stack`, `ComparisonLayout`, `DefinitionLayout`, `Quadrants`, `ContentBox`, `SplitBackground`, `BackgroundImage` |
| Blocks | `Card`, `Callout`, `Stat`, `Legend`, `Spectrum`, `ProgressBar`, `PhaseRow`, `IconRow`, `Timeline`, `ComparisonTable`, `PersonCard`, `PersonRow` |
| Diagrams | `BlockDiagram`, `StackDiagram`, `CycleDiagram`, `PyramidDiagram`, `SequenceDiagram`, `ActivityDiagram`, `BracketDiagram`, `AppShellDiagram`, `DataModel`, `FeedbackLoops`, `Svg` |
| Data | `ScatterChart` |
| Media | `ContentImage`, `YouTube` |
| Motion and meta | `Step`, `Notes` |

Components that take `accent` (Card, Callout, Stat, ComparisonTable, PhaseRow, StackDiagram,
PyramidDiagram, CycleDiagram, AppShellDiagram) inherit the slide accent when you omit it.
`morph` works on Card, Callout, ContentBox, Stat and Text.

## Slide props

| Prop | Values | Notes |
|---|---|---|
| `scheme` | `dark` / `light` | some themes fix it; do not fight it |
| `accent` | `yellow` / `red` / `teal` / `navy` | the slide's single colour |
| `gradient` | `none` / `radial` / `radial-accent` / `diagonal` / `spotlight` | never inside a frame |
| `layout` | `centered` / `document` | see Layout |
| `frame` | a frame of the theme, or `none` | see Themes |
| `transition` | `slide` / `fade` / `morph` / `slide-up` / `zoom` / `push` / `flip` / `cube` | `morph` pairs with `morph="id"` |
| `canvas`, `camera` | name; `{ x, y, scale, rotate }` | slides on one plane |
| `theme` | another theme for this slide only | rare |
| `hidden` | bare attribute | skipped when presenting |

## Themes, schemes and frames

- **Theme** (`<Presentation theme="…">`): the deck's look — palette, fonts, logos and slide masters.
  Built-in: `slidecraft` (default), `paper`, `folio`. Content folders can add themes under
  `themes/<id>/`. Use `list_themes` (or the generated folder instructions) to see what exists.
- **Scheme** (`<Slide scheme="dark|light">`): the colour scheme of one slide.
- **Frame** (`<Slide frame="…">`): a slide master from the theme, e.g. the folio theme's
  `title`, `section` and `content`. A theme can give every slide a default frame (folio gives
  `content`), so most slides name no frame.

### Framed decks

When a deck is asked for as "official", "brand-compliant" or "from the template", or goes to
customers, management or outside the team, use the organisation's own theme from the content
folder on the `<Presentation>`. Without it the deck has Slidecraft's own look, which does not
read as the official template.

- Map the master one to one: `title` for opener and closer, `section` for dividers, `content` for
  everything else. Typical shape: title → section → content… → section → content… → title.
- The frame is decoration; the body is still ordinary components.
- Frames fix the scheme and turn gradients off: set no `scheme` or `gradient` on framed slides.
- The content frame implies `layout="document"`: eyebrow, then a single-line title.
- `Text` is already left-aligned inside a left-aligned frame.
- Section titles are short (about six words); they sit in a narrow column.
- The frame never scales. A crowded body shrinks to fit while the frame stays put.

```mdx
<Presentation theme="folio">

<Slide frame="title">
  <Title>Remote build caching</Title>
  <Subtitle>Platform team · plan for the next quarter</Subtitle>
</Slide>

<Slide frame="section">
  <Title>Where the time goes</Title>
</Slide>

<Slide>
  <Subtitle>Today</Subtitle>
  <Title>A clean build takes 38 minutes on every branch</Title>
  <List>…</List>
</Slide>
```

Reference decks: `folio-tour` (every frame around a broad set of components), `folio-minimal`
(the smallest framed deck), `safe-retries` (a full framed talk).

## Colour

**Rule:** every item on a slide takes the slide's `accent`. Headings and layout differentiate;
hue does not. The audience reads colour as information, so unmotivated colour reads as a grouping
or a meaning that is not there.

- Vary colour only when it encodes something, and make the encoding obvious or state it: a
  verdict (teal fine, yellow caution, red risk) or a key that recurs across the deck.
- To emphasise, colour one item among neutral ones, not several.
- **Anti-example:** four peer cards in four accents read as four groups that do not exist. The
  fix is four plain cards: omit `accent` on all of them.

Any deck that colours beyond the slide accent declares its vocabulary in a comment directly after
the imports:

```mdx
{/*
  COLOUR LEGEND — deck-wide, both directions binding.
  (Same concept → same colour on every slide; a colour is never reused for another meaning.)

  teal   = fine, works
  yellow = caution, needs a decision
  red    = risk

  Everything without one of these meanings takes the slide accent: omit the accent prop.
*/}
```

- If you cannot write a colour's line in a few words, it is decoration: remove the prop.
- When editing a deck with a legend, conform to it, and extend it *before* using a new meaning.
- A multi-coloured deck without a legend predates the rule: derive one, or ask the author.

## Motion

**Rule:** motion only when it carries meaning. Movement is read as information too; motion for
interest teaches the audience to ignore motion. There are four meanings, each with one tool.

**This arrives now.** Stage content in the order you will speak it:

```mdx
<Step at={1}><Text>First the problem.</Text></Step>
<Step at={2}><Text>Then the cause.</Text></Step>
<Step at={3} enter="scale"><Callout label="So:">the decision.</Callout></Step>
```

- `→` walks steps before advancing; `↓` skips them. Hidden steps keep their space.
- Inside a grid, use the `step` prop on the item (`<Card step={2}>`), not a wrapping `<Step>`,
  so the grid stays intact. `<Step at={1} stagger row>` lands a row one item at a time.
- `enter` can carry meaning: `left` = what came before, `right` = what replaces it, `fall` =
  a consequence. `rise` is the default and usually right.
- Stage only when the order of arrival is part of the argument; a glanceable list should arrive
  at a glance. More than three or four steps is usually two slides.

**The same thing as before.** Give an element the same `morph` id on two consecutive slides and
put `transition="morph"` on the second; it glides into its new place.

```mdx
<Slide transition="morph"><Stat value="72%" label="hit rate" morph="hit-rate" /></Slide>
```

Two different numbers that happen to share a position are not a morph.

**A detail inside a whole.** Slides with the same `canvas` lie on one plane; the camera moves
between them. Default placement is a left-to-right strip; `camera={{ x, y, scale, rotate }}`
places a slide. Keep `scale` near 1 on any slide you stay on (fractional scale and rotation make
text soft); use them for slides you pass through.

**A measurement.** `Stat` counts up by default. Years and versions are labels: `countUp={false}`.
`ScatterChart threshold` adds a draggable cut-off with a live count; add it only if you will drag it.

Automatic, no props: diagram connectors draw themselves in source order (dashed ones fade);
`prefers-reduced-motion` is honoured; thumbnails and handouts show every step at once.

**Ship checks for a moving slide:** can you say in one sentence what the movement tells the
audience? Does the slide still read with every step shown? Are there more than four steps?

Reference deck: `motion`.

## Layout

- `layout="centered"` (default): openers, section breaks, statements (`CenteredStatement`,
  `Quote`), closers. Multi-line titles are fine; `Title size` (`hero`, `standard`, `compact`) applies.
- `layout="document"`: a header band (`Subtitle` eyebrow **first**, then `Title`) above the body,
  for content slides. The title is left-aligned at a fixed size and never shrinks.
- One body component per content slide (or one layout holding peers), optionally followed by
  one `Callout` or `Text`.
- `Text` is centred by default; pass `align="left"` in document layout outside a frame.

## Titles

The most important content rule: a document title is a **single-line assertion**. Two lines is
the ceiling, three is wrong. Dev mode (`D`) marks two-line titles amber and longer ones red.

- A wrapping title is a signal to rewrite it shorter, not to shrink the text.
- Let the eyebrow carry the subject; the title should not repeat it. Read the pair as a unit.
- Write assertions, not sentences: drop "is a", articles and qualifiers.
- Guardrail: the shortened title must still point the right way when skimmed alone.

| Before | After |
|---|---|
| eyebrow *Caching* · "Our current approach to caching build outputs is not working well" | eyebrow *Caching today* · "Every branch starts from an empty cache" |
| eyebrow *Results* · "The results of the pilot showed that build times went down" | eyebrow *Pilot results* · "Builds dropped from 38 to 9 minutes" |

## Code

Code inside `<Code>{`…`}</Code>` loses the indentation of the surrounding JSX. Start the code on a
new line after the backtick and indent every line by the surrounding JSX's indentation plus its
own. `Code` is 1300 px wide; pass `width` to fit a column.

## Choosing components

| Intent | Reach for |
|---|---|
| Opener or closer | centered slide, `Title` + `Subtitle`, or the theme's title frame |
| Divider | the theme's section frame, or a centered `Title` |
| Bullet points | `List` + `ListItem` |
| Paragraph | `Text` |
| Inline emphasis | `Accent` (one colour), `Highlight` |
| Side by side | `TwoColumn` of `Card`s; `ComparisonLayout`; `ComparisonTable` for options against criteria |
| Four peers | `FourColumn` of compact `Card`s, same accent |
| One big number | `Stat`; pairs or rows of `Stat`s, never a lone number in a table |
| Warning or rule | `Callout` with a `label` |
| Time | `Timeline` (mark the last event `isDeadline`) |
| Loop | `CycleDiagram` |
| Boxes and arrows | `BlockDiagram` (dashed for optional or weaker links) |
| Layers | `StackDiagram`, `PyramidDiagram` |
| Phases, progress | `PhaseRow`, `ProgressBar` |
| A range | `Spectrum` |
| Colour key | `Legend` |
| Verdicts | `ProConList`, `TagPill` |
| Numeric evidence | `ScatterChart` (with `threshold` only if you will drag it) |
| Quote | `Quote` with `author` |
| Build in speech order | `Step`, or the `step` prop |

One number lands harder than a table of them; a loop is easier to see than to describe;
timelines must stay legible from the back of the room.

## Speaker notes

Every content slide gets `<Notes>`. The first line is a time budget (`4:00-4:50.`) followed by
what to say; then the facts the speaker needs but the slide does not show (sources, numbers,
names). When the deck comes from research, add a `Source:` line and say plainly which numbers are
estimates. Notes may use Markdown: paragraphs, lists, **bold**. Reader mode and the presenter
window show them; the time budget is dropped in reader mode.

## Images

- Put image files next to the deck (`images/` is conventional) and import them:
  `import chart from './images/chart.png'`, then `<ContentImage src={chart} alt="…" width={900} />`.
- A plain path also works for string props: `<ContentImage src="images/chart.png" />`.
- Shared images uploaded in the editor live in the library and are referenced as
  `/images/library/<file>`.
- Formats: png, jpg, gif, webp, svg. Always write `alt` text. Size images in pixels; a
  full-width image in document layout is about 1150 px wide so it fits under the header band.

## Common mistakes

Raw HTML; `<br>`; percentage or viewport units; `clamp()`; several accents on peer items; a colour
that means different things on different slides; wrapping document titles; the eyebrow after the
title; `scheme` or `gradient` on a framed slide; long section titles; wrapping a grid item in
`Step` instead of using `step`; counting up a year; morphing two different numbers; fractional
camera scale on a slide you stay on; more than four steps; animating for interest.

## Before you finish

- Every component you used is in the import line, and nothing is raw HTML.
- Each document title fits on one line (two at most) and states the point.
- One accent per slide, or colours that follow the deck's legend.
- Each step reveals something the speaker talks about; the slide still reads fully built.
- Every slide has notes with a time budget.
- The deck compiles: the tools refuse a write that does not, and the app shows the error on the
  deck's card and in the presentation.

## Workflow

1. Find the content folder (`get_content_dir`, or the folder holding this file). Never add decks
   to the Slidecraft repository's `content/` when the content folder is elsewhere.
2. Read the folder's own `AGENTS.md` if it has one: its house style wins on wording and tone.
3. To change a deck, read it first (`read_presentation`) and change one slide at a time.
4. To create one, write `<name>/index.mdx` (lower-case words joined by dashes) or call
   `create_presentation` with every initial slide.
5. Every write is compile-checked; fix the reported line before continuing.
6. The running app reloads the deck on every save: open `http://localhost:<port>/<name>`. Reuse a
   running server; never restart it. The editor (`/edit/<name>`) shows each slide as you change it.

## Files

- **Work with:** decks (`<content-dir>/<name>/index.mdx`) and their images.
- **Do not modify:** slide components, the editor, the server or configuration. If a deck needs a
  component that does not exist, that is a component developer's task.

## References

- [`docs/creating-presentations.md`](../creating-presentations.md): the condensed version of this guide.
- [`docs/guide.md`](../guide.md): the user guide, including the editor and keyboard controls.
- The gallery (`/gallery`) and the component catalogue on the docs site: every component and prop.

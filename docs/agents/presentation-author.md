# Presentation author guide

You write and edit Slidecraft decks. A deck is one MDX file, `<content-dir>/<name>/index.mdx`,
whose root is `<Presentation>` and whose children are `<Slide>` elements built from registered
components. Slides are authored at a fixed 1920 × 1080 pixels and scaled as a whole.

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
- Keep a blank line between slides. Optional YAML frontmatter at the top is kept as is.
- `<Notes>` holds speaker notes. Convention: the first line is a time budget (`4:00-4:50.`).
- `<Slide hidden>` keeps a slide in the file but skips it when presenting.

## Themes, schemes and frames

- **Theme** (`<Presentation theme="…">`): the deck's look — palette, fonts, logos and slide masters.
  Built-in: `slidecraft` (default), `paper`, `folio`. Content folders can add themes under
  `themes/<id>/`. Use `list_themes` (or the generated folder instructions) to see what exists.
- **Scheme** (`<Slide scheme="dark|light">`): the colour scheme of one slide. Some themes allow
  only one scheme; do not fight it.
- **Frame** (`<Slide frame="…">`): a slide master from the theme, e.g. the folio theme's
  `title`, `section` and `content`. A theme can give every slide a default frame (folio gives
  `content`), so most slides name no frame. Frames fix the scheme and layout and turn gradients off.
- When a deck is asked for as "official" or "brand-compliant", or goes outside the team, use the
  organisation's own theme from the content folder (see `list_themes`) on the `<Presentation>`.
  Typical shape: title → section → content… → section → content… → title.

## Critical rules

1. **No raw HTML.** Never `<div>`, `<p>`, `<ul>`, `<h1>`, `<br>`, `<img>`. Use components:
   separate `<Text>` elements instead of `<br>`, `List`/`ListItem` instead of `ul`.
2. **Fixed pixels.** Any size you set is in pixels on the 1920 × 1080 stage. Never `%`, `vw`, `vh`,
   `clamp()`. Usable content area: about 1760 × 920.
3. **Only registered components and props.** The component list below is the source of truth.
4. **One accent per slide.** Peers share the slide accent; omit `accent` on children so they
   inherit it. Vary colour only when it encodes a meaning, and declare deck-wide meanings in a
   comment right after the imports:

   ```mdx
   {/*
     COLOUR LEGEND — deck-wide, both directions binding.
     teal = fine   yellow = caution   red = risk
     Everything without one of these meanings takes the slide accent: omit the accent prop.
   */}
   ```

   When editing a deck that has a legend, conform to it and extend it before using a new meaning.
5. **Motion is semantic.** Use it only when it carries meaning:
   - arrives now: `<Step at={n}>` or `step={n}` on a component (Card, Stat, Text, ListItem, …);
     more than three or four beats is usually two slides;
   - same thing as before: `morph="id"` on both slides and `transition="morph"` on the second;
   - detail inside a whole: `canvas="name"` plus `camera={{ x, y, scale }}`;
   - a measurement: `Stat` counts up by default (`countUp={false}` for years and versions).
   The slide must still read with every step shown: that is what thumbnails and handouts show.

## Layout and titles

- `layout="centered"` (default): openers, statements, closers. `layout="document"`: a header band
  (`Subtitle` eyebrow first, then `Title`) above the body, for content slides.
- A document title is a **single-line assertion**; two lines is the ceiling, three is wrong. If a
  title wraps, rewrite it shorter: let the eyebrow carry the subject and drop filler words.
- `Text` is centred by default; pass `align="left"` in document layout (inside a left-aligned
  frame it is already left).
- Code inside `<Code>{`…`}</Code>` loses the indentation of the surrounding JSX. Start the code on
  a new line after the backtick and indent every line by the surrounding JSX's indentation plus
  its own. `Code` is 1300 px wide; pass `width` to fit a column.

## Choosing components

| Intent | Reach for |
|---|---|
| Opener or closer | centered slide, `Title` + `Subtitle`, or the theme's title frame |
| Bullet points | `List` + `ListItem` |
| Side by side | `TwoColumn` of `Card`s; `ComparisonTable` for options against criteria |
| Four peers | `FourColumn` of compact `Card`s |
| One big number | `Stat`; pairs or rows of `Stat`s |
| Warning or rule | `Callout` with a `label` |
| Time | `Timeline` (mark the last event `isDeadline`) |
| Loop | `CycleDiagram` |
| Boxes and arrows | `BlockDiagram` (dashed for optional or weaker links) |
| Layers | `StackDiagram`, `PyramidDiagram` |
| Verdicts | `ProConList`, `TagPill` |
| Numeric evidence | `ScatterChart` (with `threshold` only if you will drag it) |

## Speaker notes

Every content slide gets `<Notes>`. The first line is a time budget (`4:00-4:50.`) followed by
what to say; then the facts the speaker needs but the slide does not show (sources, numbers,
names). Notes may use Markdown: paragraphs, lists, **bold**. Reader mode and the presenter window
show them; the time budget is dropped in reader mode.

## Images

- Put image files next to the deck (`images/` is conventional) and import them:
  `import chart from './images/chart.png'`, then `<ContentImage src={chart} alt="…" width={900} />`.
- A plain path also works for string props: `<ContentImage src="images/chart.png" />`.
- Shared images uploaded in the editor live in the library and are referenced as
  `/images/library/<file>`.
- Always write `alt` text. Size images in pixels; a full-width image in document layout is
  about 1150 px wide so it fits under the header band.

## Before you finish

- Every component you used is in the import line, and nothing is raw HTML.
- Each document title fits on one line (two at most) and states the point.
- One accent per slide, or colours that follow the deck's legend.
- Each step reveals something the speaker talks about; the slide still reads fully built.
- Every slide has notes with a time budget.
- The deck compiles: the tools refuse a write that does not, and the app shows the error on the
  deck's card and in the presentation.

## Workflow

1. Find the content folder (`get_content_dir`, or the folder holding this file).
2. To change a deck, read it first (`read_presentation`) and change one slide at a time.
3. To create one, write `<name>/index.mdx` (lower-case words joined by dashes) or call
   `create_presentation` with every initial slide.
4. Every write is compile-checked; fix the reported line before continuing.
5. The running app reloads the deck on every save: open `http://localhost:<port>/<name>`.

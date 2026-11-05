# Choosing components

Every component and its props are in [`components.md`](components.md). This file says which one
fits an intent, and covers the two that need care: code and images.

## By intent

| Intent | Reach for |
|---|---|
| Opener or closer | a centered slide with `Title` + `Subtitle`, or the theme's title frame |
| Divider | the theme's section frame, a centered `Title`, or `Chapter` |
| Bullet points | `List` + `ListItem` |
| Paragraph | `Text` |
| Inline emphasis | `Accent` (one colour), `Highlight` |
| Side by side | `TwoColumn` of `Card`s; `ComparisonLayout`; `ComparisonTable` for options against criteria |
| Four peers | `FourColumn` of compact `Card`s, all the same accent |
| One big number | `Stat`; a pair or row of `Stat`s, never a lone number in a table |
| Before and after | `NumberPunch` |
| Warning or rule | `Callout` with a `label` |
| Time | `Timeline` (mark the last event `isDeadline`); `TraceTimeline` for progress to today |
| Loop | `CycleDiagram` |
| Boxes and arrows | `BlockDiagram` (dashed for optional or weaker links) |
| Work flowing through stages | `SignalFlow` |
| Layers | `StackDiagram`, `PyramidDiagram` |
| Phases, progress | `PhaseRow`, `ProgressBar`, `Gauge` |
| A range | `Spectrum` |
| Colour key | `Legend` |
| Verdicts | `ProConList`, `TagPill` |
| Numeric evidence | `ScatterChart` (with `threshold` only if you will drag it) |
| Quote | `Quote` with `author` |
| A line that lands like a video cut | `Punchline`; `LowerThird` for who is speaking; `Annotate` to zoom into an image |
| Build in speech order | `Step`, or the `step` prop |

One number lands harder than a table of them; a loop is easier to see than to describe; a
timeline must stay legible from the back of the room.

Components that take `accent` inherit the slide's when you leave it out, which is almost always
what you want. `morph` works on `Card`, `Callout`, `ContentBox`, `Stat` and `Text`.

## Code

Code inside `<Code>{`…`}</Code>` loses the indentation of the surrounding JSX. Start the code on a
new line after the backtick and indent every line by the surrounding JSX's indentation plus its
own. `Code` is 1300 px wide; pass `width` to fit a column.

## Images

- Put image files next to the deck (`images/` is the convention) and import them:
  `import chart from './images/chart.png'`, then `<ContentImage src={chart} alt="…" width={900} />`.
- A plain path also works for string props: `<ContentImage src="images/chart.png" />`.
- Shared images uploaded in the editor live in the library: `/images/library/<file>`
  (`list_images` lists them).
- Formats: png, jpg, gif, webp, svg. Always write `alt` text. Size images in pixels; a full-width
  image in a document slide is about 1150 px wide so it fits under the header band.

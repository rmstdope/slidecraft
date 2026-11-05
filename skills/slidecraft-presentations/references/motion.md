# Motion

Movement is read as information. There are four meanings, each with one tool; motion for interest
teaches the audience to ignore motion.

## This arrives now

Stage content in the order you will say it:

```mdx
<Step at={1}><Text>First the problem.</Text></Step>
<Step at={2}><Text>Then the cause.</Text></Step>
<Step at={3} enter="scale"><Callout label="So:">the decision.</Callout></Step>
```

- `→` walks the steps before advancing; `↓` skips them. Hidden steps keep their space.
- Inside a grid, put the `step` prop on the item (`<Card step={2}>`) so the grid stays intact.
  `<Step at={1} stagger row>` lands a row one item at a time.
- `enter` can carry meaning: `left` = what came before, `right` = what replaces it, `fall` = a
  consequence. `rise` is the default and usually right.
- Stage only when the order of arrival is part of the argument; a glanceable list arrives at a
  glance. More than three or four steps is usually two slides.
- The video-style components (`Punchline`, `Chapter`, `Annotate`, `LowerThird`, `NumberPunch`)
  play on entry, or beat by beat on the presenter's right arrow with `steps`.

## The same thing as before

Give an element the same `morph` id on two consecutive slides and put `transition="morph"` on the
second; it glides into its new place.

```mdx
<Slide transition="morph"><Stat value="72%" label="hit rate" morph="hit-rate" /></Slide>
```

Two different numbers that happen to share a position are not a morph.

## A detail inside a whole

Slides with the same `canvas` lie on one plane, and the camera moves between them. By default they
sit in a left-to-right strip; `camera={{ x, y, scale, rotate }}` places a slide. Keep `scale` near
1 on any slide you stay on (fractional scale and rotation make text soft); use them on slides you
pass through.

## A measurement

`Stat` counts up by default. Years and versions are labels: `countUp={false}`. `ScatterChart
threshold` adds a draggable cut-off with a live count; add it only if you will drag it. `Gauge`
fills to a lit `target`; `TraceTimeline` runs a charge to `now`.

## Automatic

Diagram connectors draw themselves in source order (dashed ones fade), `prefers-reduced-motion` is
honoured, and thumbnails and handouts show every step at once. None of it needs a prop.

## Before you ship a moving slide

- Can you say in one sentence what the movement tells the audience?
- Does the slide still read with every step shown?
- Are there more than four steps? Then it is two slides.

The `motion` example deck shows every mechanism with a colour legend and timed notes.

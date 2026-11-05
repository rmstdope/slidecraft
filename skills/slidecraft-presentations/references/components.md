<!-- Generated from the component registry by scripts/generateSkills.ts (`bun run skills`). Do not edit. -->

# Components

Every slide component, grouped by family, with its props and the smallest useful usage. Import
each one you use from `@components`. Parts (such as `ListItem`) are listed under their parent.

| Family | Components |
|---|---|
| Structure | `Presentation`, `Slide`, `Notes`, `Step` |
| Text | `Title`, `Subtitle`, `Text`, `Accent`, `Highlight`, `Caption`, `Quote`, `CenteredStatement`, `TagPill`, `Section`, `Code`, `Punchline`, `LowerThird`, `Chapter` |
| Lists | `List`, `ProConList` |
| Layout | `TwoColumn`, `FourColumn`, `Stack`, `Divider`, `SplitBackground`, `ComparisonLayout`, `DefinitionLayout`, `PersonRow` |
| Content | `Card`, `Callout`, `ContentBox`, `PersonCard`, `Legend`, `IconRow`, `PhaseRow`, `ComparisonTable` |
| Data Visualization | `Stat`, `ProgressBar`, `Spectrum`, `Timeline`, `Quadrants`, `ScatterChart`, `Gauge`, `GaugeRow`, `TraceTimeline`, `NumberPunch` |
| Technical Diagrams | `BlockDiagram`, `StackDiagram`, `CycleDiagram`, `PyramidDiagram`, `SequenceDiagram`, `ActivityDiagram`, `DataModel`, `FeedbackLoops`, `AppShellDiagram`, `BracketDiagram`, `SignalFlow`, `TracedPoints` |
| Media | `ContentImage`, `Svg`, `BackgroundImage`, `YouTube`, `Annotate` |

## Structure

### Presentation

The deck root; every child Slide is one slide, styled by the deck theme.

Use for: The outermost element of every deck.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `theme` | `string` | `"slidecraft"` | Look and feel: a built-in theme or one from the content folder |
| `scheme` | `"dark" \| "light"` |  | Scheme for slides that do not set one; defaults to the theme |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy"` |  | Accent for slides that do not set one; defaults to the theme |

```mdx
<Presentation>

<Slide>
  <Title>First slide</Title>
</Slide>

</Presentation>
```

### Slide

One 1920×1080 slide with a colour scheme, an accent, a layout and a transition, styled by the deck theme.

Use for: Every slide in a deck; Switching scheme or accent per slide.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `scheme` | `"dark" \| "light"` | `"dark"` | Colour scheme; some themes and frames fix it |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy"` | `"yellow"` | The single slide colour; children inherit it |
| `gradient` | `"none" \| "radial" \| "radial-accent" \| "diagonal" \| "spotlight"` | `"none"` | Background gradient |
| `background` | `string` |  | Any CSS background; wins over gradient |
| `layout` | `"centered" \| "document"` | `"centered"` | Hero stack, or header band + body + footer |
| `frame` | `string` |  | A frame (slide master) from the theme, e.g. "title"; "none" for no frame |
| `theme` | `string` |  | Use another theme than the deck's for this slide |
| `transition` | `"slide" \| "fade" \| "morph" \| "slide-up" \| "zoom" \| "push" \| "flip" \| "cube"` | `"slide"` | How this slide enters |
| `canvas` | `string` |  | Slides sharing a canvas name lie on one plane |
| `camera` | `{ x?: number; y?: number; scale?: number; rotate?: number }` |  | Placement on the canvas |
| `hidden` | `boolean` | `false` | Skipped when presenting |

```mdx
<Slide scheme="dark" accent="yellow">
  <Title>Slide title</Title>
</Slide>
```

### Notes

Speaker notes for the presenter view and the reader handout; not shown on the slide.

Use for: What to say on the slide; Time budget and sources.

No props.

```mdx
<Notes>0:00-0:40. What to say on this slide.</Notes>
```

### Step

Reveals its content on a build step, in speech order; the layout never reflows.

Use for: Reveal points in the order you say them; Land a row of items one by one.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `at` | `number` |  | The beat this content arrives on (1, 2, 3…) |
| `enter` | `"fade" \| "rise" \| "fall" \| "scale" \| "left" \| "right"` | `"rise"` | How it arrives; direction can carry meaning |
| `stagger` | `boolean \| number` | `false` | Land children one by one (seconds apart when a number) |
| `row` | `boolean` | `false` | Lay children out in a row |
| `gap` | `number` | `32` | Gap between children in px |

```mdx
<Step at={1}>
  <Text>Arrives on the first beat</Text>
</Step>
```

## Text

### Title

Main heading in the display font.

Use for: Main slide heading; Section opener; Key statement.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `size` | `"hero" \| "standard" \| "compact" \| number` | `"hero"` | Semantic preset, or an exact px size |
| `accent` | `boolean` | `false` | Colour the heading with the slide accent |
| `nowrap` | `boolean` | `false` | Keep on one line; disables fitting |

```mdx
<Title>Your heading here</Title>
```

### Subtitle

All-caps secondary heading.

Use for: Section name above a title; Supporting context; Date, event or category label.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `accent` | `boolean` | `false` | Use the slide accent colour |

```mdx
<Subtitle>Section Name</Subtitle>
```

### Text

Body text paragraph.

Use for: Explanatory paragraph; Supporting sentence under a title.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `muted` | `boolean` | `false` | Muted colour |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"` | 18, 32, 40 or 48 px |
| `align` | `"left" \| "center" \| "right"` | `"center"` | Text alignment; left by default inside a left-aligned frame |
| `tight` | `boolean` | `false` | Line-height 1.25 instead of 1.6 |
| `fontSize` | `number` |  | Exact px size; overrides size |
| `step` | `number` |  | Reveal on this build step |
| `morph` | `string` |  | Shared-element id; pair with transition="morph" on the next slide |

```mdx
<Text>Your body text here</Text>
```

### Accent

Inline text in the slide accent, another accent, or a gradient.

Use for: One emphasised word in a title; A key phrase in a paragraph.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `color` | `"yellow" \| "red" \| "teal" \| "navy"` |  | Solid accent colour; defaults to the slide accent |
| `gradient` | `"accent" \| "teal" \| "yellow" \| "red" \| "navy" \| "emerald" \| "sunset" \| "gold"` |  | "accent" and the accent names follow the theme; emerald, sunset and gold are fixed |
| `from` | `string` |  | Custom gradient start colour |
| `to` | `string` |  | Custom gradient end colour |
| `angle` | `number` | `90` | Gradient direction in degrees |

```mdx
<Accent>highlighted text</Accent>
```

### Highlight

Inline text highlight in the slide accent or a chosen colour.

Use for: Emphasis on light document-style slides.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `color` | `string` |  | An accent role ("teal", "red"…) or any CSS colour; defaults to the slide accent |
| `bold` | `boolean` | `true` | Semi-bold weight |
| `step` | `number` |  | Build step on which the highlight switches on |

```mdx
<Highlight>highlighted text</Highlight>
```

### Caption

Italic secondary text for annotations inside Cards.

Use for: Image or diagram captions; Source attribution; Footnotes.

No props.

```mdx
<Caption>Secondary text</Caption>
```

### Quote

Styled quotation block with optional author.

Use for: A testimonial; A principle in someone’s words.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `author` | `string` | `""` | Attribution shown below |
| `noWrap` | `boolean` | `false` | Keep the quote on one line |

```mdx
<Quote author="Author Name">The quotation goes here.</Quote>
```

### CenteredStatement

A small label over a centred statement, for rules and principles.

Use for: A rule or principle; A single takeaway.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `label` | `string` |  | Small label above |
| `statement` | `string` |  | The statement |
| `labelColor` | `string` | `"var(--muted)"` | Any CSS colour |
| `maxWidth` | `number` | `1200` | Statement width in px |

```mdx
<CenteredStatement label="Rule" statement="One idea per slide." />
```

### TagPill

Small inline status badge.

Use for: Status next to an item; A small label.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `variant` | `"neutral" \| "good" \| "warn" \| "bad"` | `"neutral"` | Semantic colour: neutral for labels, good/warn/bad for status |

```mdx
<TagPill variant="good">Shipped</TagPill>
```

### Section

Labeled section with bold title and content below.

Use for: Several labelled blocks on one slide.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `title` | `string` |  | Bold label |
| `titleSize` | `number` | `32` | Label size in px |
| `gap` | `number` | `10` | Space below the label in px |

```mdx
<Section title="Section Title">
  <Text align="left">Content</Text>
</Section>
```

### Code

Code block with optional auto-scroll to reveal long code.

Use for: A short code example; Scrolling through a longer file.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `scroll` | `boolean` | `false` | Auto-scroll long code |
| `scrollSpeed` | `number` | `30` | Pixels per second |
| `fontSize` | `number` | `28` | Font size in px |
| `title` | `string` |  | Window title bar text |
| `accent` | `boolean` | `false` | Accent-coloured border |
| `width` | `number` | `1300` | Width in px |

```mdx
<Code title="deck.mdx">{`<Slide>
  <Title>Hello</Title>
</Slide>`}</Code>
```

### Punchline

A headline whose words slam in one after another, then a highlighter swipe across the key words and a supporting line sliding up.

Use for: The one sentence a slide is about, landing word by word; A result with the number marked.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `highlight` | `string` |  | Words of the headline to mark with a highlighter |
| `sub` | `string` |  | Supporting line under the headline |
| `size` | `number` | `180` | Headline size in px |
| `uppercase` | `boolean` | `true` | Set the headline in capitals |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Highlighter colour; defaults to the slide accent |
| `steps` | `boolean` | `false` | The highlight and the supporting line wait for build steps |

```mdx
<Punchline highlight="41%" sub="after one change to the cache">Builds got 41% faster</Punchline>
```

### LowerThird

A name caption in the lower left of the slide, as in a filmed interview, with a role tag and an optional quote.

Use for: Introducing who is speaking; A customer or colleague quote with their name and role.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `name` | `string` |  | Who is speaking or quoted |
| `role` | `string` |  | Their role, as a tag under the name |
| `quote` | `string` |  | What they said, shown on the right |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Colour of the rail and quote mark; defaults to the slide accent |
| `steps` | `boolean` | `false` | The role and the quote wait for build steps |

```mdx
<LowerThird name="Jordan Lee" role="Platform lead" quote="We stopped rebuilding what had not changed." />
```

### Chapter

A full-slide chapter card: an accent wipe cuts across, the big chapter number fills up, progress ticks show where the talk is, and the title tightens into place.

Use for: The start of each part of a talk; Showing how far through the talk you are.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `number` | `number` |  | This chapter's number |
| `of` | `number` |  | How many chapters the talk has; shows progress ticks |
| `title` | `string` |  | Chapter title |
| `label` | `string` |  | The line above the title; defaults to "Chapter 2 of 4" |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Wipe and number colour; defaults to the slide accent |
| `steps` | `boolean` | `false` | The title waits for a build step |

```mdx
<Chapter number={2} of={4} title="Where the time went" />
```

## Lists

### List

Animated bullet list with ListItem children.

Use for: A few short points; Steps in a process.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `bulletColor` | `string` |  | Any CSS colour; defaults to the slide accent |
| `compact` | `boolean` | `false` | Tighter spacing |
| `centered` | `boolean` | `false` | Centre the items |
| `plain` | `boolean` | `false` | No bullet glyph |
| `ordered` | `boolean` | `false` | Render an ordered list |
| `indent` | `number` | `0` | Left margin in px |
| `step` | `number` |  | Reveal the whole list on this build step |

```mdx
<List>
  <ListItem>First point</ListItem>
  <ListItem>Second point</ListItem>
  <ListItem>Third point</ListItem>
</List>
```

#### ListItem

Individual item within a List component.

Use for: One point inside a List.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `step` | `number` |  | Reveal this item on its own build step |

```mdx
<ListItem>Item text</ListItem>
```

### ProConList

Tagged argument rows: pro, con, and nuance.

Use for: Weighing a decision.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `items` | `Array<{ kind: "pro" \| "con" \| "nuance"; text: string }>` |  | Rows in order |

```mdx
<ProConList
  items={[
    { kind: "pro", text: "Faster to start" },
    { kind: "con", text: "Harder to change later" },
    { kind: "nuance", text: "Depends on team size" },
  ]}
/>
```

## Layout

### TwoColumn

Side-by-side layout container.

Use for: Two options side by side; Before and after.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `gap` | `string` | `"80px"` | Gap between the columns |

```mdx
<TwoColumn>
  <Card title="Left">Left column</Card>
  <Card title="Right">Right column</Card>
</TwoColumn>
```

### FourColumn

Four-column grid layout container.

Use for: Four peers; A row of stats.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `gap` | `string` | `"40px"` | Gap between the columns |

```mdx
<FourColumn>
  <Card compact title="One">First</Card>
  <Card compact title="Two">Second</Card>
  <Card compact title="Three">Third</Card>
  <Card compact title="Four">Fourth</Card>
</FourColumn>
```

### Stack

Vertical grouping container with configurable gap.

Use for: Group blocks with a fixed gap.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `gap` | `number` | `32` | Gap between children in px |

```mdx
<Stack gap={32}>
  <Text>First</Text>
  <Text>Second</Text>
</Stack>
```

### Divider

A solid, dotted or dashed separator line.

Use for: Separate two groups; A quiet rule between sections.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `orientation` | `"vertical" \| "horizontal"` | `"vertical"` | Direction of the line |
| `variant` | `"solid" \| "dotted" \| "dashed"` | `"dotted"` | Line style |
| `color` | `string` | `"#8a8f98"` | Any CSS colour |
| `length` | `number` | `400` | Length in px |
| `thickness` | `number` | `2` | Thickness in px |
| `spacing` | `number` | `8` | Gap between dots or dashes in px |

```mdx
<Divider orientation="horizontal" length={800} />
```

### SplitBackground

Two-tone full-slide background with a wavy seam; use with background="transparent" on the Slide.

Use for: A header zone above a content zone.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `topColor` | `string` |  | Top band colour; defaults to the slide background |
| `bottomColor` | `string` |  | Bottom band colour; defaults to the slide background tinted with the accent |
| `topHeight` | `number` | `400` | Height of the top band in px |

```mdx
<SplitBackground topHeight={400} />
```

### ComparisonLayout

Full-slide comparison with a two-tone background in the slide colours, an icon and two columns.

Use for: Two options compared on one slide.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `leftHeader` | `{ label?: string; title: string; subtitle?: string }` |  | Left column header |
| `rightHeader` | `{ label?: string; title: string; subtitle?: string }` |  | Right column header |
| `icon` | `string` | `"⚙️"` | Emoji in the centre |
| `centerTitle` | `string` |  | Title under the icon |
| `leftContent` | `ReactNode` |  | Left column content |
| `rightContent` | `ReactNode` |  | Right column content |
| `topColor` | `string` |  | Header band colour; defaults to the slide background |
| `bottomColor` | `string` |  | Lower band colour; defaults to the slide background tinted with the accent |
| `iconColor` | `string` |  | Icon tile colour; defaults to a tint of the accent |

```mdx
<ComparisonLayout
  leftHeader={{ label: "Option A", title: "Build" }}
  rightHeader={{ label: "Option B", title: "Buy" }}
  centerTitle="Trade-offs"
  leftContent={<List compact><ListItem>Full control</ListItem></List>}
  rightContent={<List compact><ListItem>Faster start</ListItem></List>}
/>
```

### DefinitionLayout

Full-slide definition: a header band with the term, then a zone tinted with the accent holding content and a sidebar card.

Use for: Defining a term with its parts.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `title` | `string` |  | Term being defined |
| `subtitle` | `string` |  | Italic definition |
| `leftContent` | `ReactNode` |  | Main column |
| `rightContent` | `ReactNode` |  | Sidebar card content |
| `backgroundColor` | `string` |  | Lower zone colour; defaults to the slide background tinted with the accent |
| `sidebarTitle` | `string` | `"Consists of"` | Tab above the sidebar card |

```mdx
<DefinitionLayout
  title="Term"
  subtitle="What the term means, in one sentence."
  leftContent={<Text align="left">Explanation</Text>}
  rightContent={<List compact><ListItem>Part one</ListItem></List>}
/>
```

### PersonRow

A row of PersonCards with fixed column widths.

Use for: A team slide; Contacts at the end of a talk.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `gap` | `number` | `100` | Gap between people in px |
| `columnWidth` | `number` | `460` | Width of each column in px |

```mdx
<PersonRow>
  <PersonCard name="Jane Doe" role="Software Engineer" email="jane.doe@example.com" />
  <PersonCard name="John Roe" role="Designer" email="john.roe@example.com" />
  <PersonCard name="Alex Poe" role="Product Lead" email="alex.poe@example.com" />
</PersonRow>
```

## Content

### Card

Info card with 3D hover effect.

Use for: Feature highlights; Team profiles; Service descriptions; Grouped content.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `title` | `string` |  | Header in the accent colour |
| `subtitle` | `string` |  | Secondary line under the title |
| `subtitleVariant` | `"italic" \| "divider" \| "inset"` | `"italic"` | Subtitle styling |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `compact` | `boolean` | `false` | Border-only style for grids |
| `step` | `number` |  | Reveal on this build step |
| `morph` | `string` |  | Shared-element id |

```mdx
<Card title="Card Title">
  Card content
</Card>
```

### Callout

Full-width callout box with optional label.

Use for: A rule or warning under a slide body; The one emphasised element.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `label` | `string` |  | Bold label before the text |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `step` | `number` |  | Reveal on this build step |
| `morph` | `string` |  | Shared-element id |

```mdx
<Callout label="Note:">The one thing to remember.</Callout>
```

### ContentBox

Simple colored box for diagrams and callouts (no shadows).

Use for: Boxes on a light diagram slide.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `color` | `"green" \| "yellow" \| "teal" \| "red" \| "navy" \| "white" \| "cream"` | `"white"` | Pastel preset |
| `width` | `number` | `500` | Width in px |
| `title` | `string` |  | Bold line above the content |
| `align` | `"left" \| "center" \| "right"` | `"center"` | Text alignment |
| `step` | `number` |  | Reveal on this build step |
| `morph` | `string` |  | Shared-element id |

```mdx
<ContentBox color="green" title="Title">Content</ContentBox>
```

### PersonCard

A photo in a circle with name, role and contact address.

Use for: Who to contact; The speaker.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `image` | `string` |  | Imported image or a path relative to the deck folder; initials when omitted |
| `name` | `string` |  | Full name |
| `role` | `string` |  | Role |
| `team` | `string` |  | Team |
| `email` | `string` |  | Contact address |
| `imagePosition` | `string` | `"center top"` | Which part of the photo stays in the circle |
| `size` | `number` | `280` | Photo diameter in px |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `step` | `number` |  | Reveal on this build step |

```mdx
<PersonCard name="Jane Doe" role="Software Engineer" email="jane.doe@example.com" />
```

### Legend

Row of colour swatches with labels, to explain a diagram.

Use for: Explaining the colours of a diagram.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `items` | `Array<{ color: string; label: string }>` |  | Accent names or CSS colours with labels |
| `title` | `string` |  | Small heading before the swatches |

```mdx
<Legend title="Key" items={[{ color: "teal", label: "Fine" }, { color: "red", label: "Risk" }]} />
```

### IconRow

Row of emoji/icon circles for visualizations.

Use for: A visual headcount; Who is involved.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `items` | `Array<{ icon: string; highlight?: boolean }>` |  | Emoji, optionally highlighted |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Colour of highlighted icons; defaults to the slide accent |
| `label` | `string` |  | Label above the row |

```mdx
<IconRow label="The team" items={[{ icon: "🧑‍💻" }, { icon: "🧑‍🎨", highlight: true }, { icon: "🧑‍🔬" }]} />
```

### PhaseRow

Horizontal row of phase cards, e.g. a framework or a process.

Use for: Phases of a process.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `phases` | `Array<{ title: string; items: string[]; color?: "teal" \| "yellow" \| "red" \| "navy" \| "gray" }>` |  | Phases in order; colour defaults to the slide accent |

```mdx
<PhaseRow
  phases={[
    { title: "Research", items: ["Read the code", "Map the flow"] },
    { title: "Plan", items: ["Write the steps"] },
    { title: "Implement", items: ["Small commits"] },
  ]}
/>
```

### ComparisonTable

Options against criteria, with an optional highlighted (recommended) row.

Use for: Feature grid with a recommendation.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `headers` | `string[]` |  | Column headers |
| `rows` | `Array<string[] \| { cells: string[]; highlight?: boolean }>` |  | Rows; highlight marks the recommended one |
| `align` | `Array<"left" \| "center" \| "right">` |  | Per-column alignment |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `caption` | `string` |  | Italic line above the table |
| `width` | `number` | `1600` | Width in px |

```mdx
<ComparisonTable
  headers={["Option", "Cost", "Speed"]}
  rows={[
    ["A", "Low", "Slow"],
    { cells: ["B", "Medium", "Fast"], highlight: true },
  ]}
/>
```

## Data Visualization

### Stat

Large statistic number with label.

Use for: One number that carries the slide; A pair or row of metrics.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `value` | `string` |  | The number as written, e.g. "42%" |
| `label` | `string` |  | Uppercase label below |
| `accent` | `"teal" \| "yellow" \| "red" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `sub` | `string` |  | Small line under the label |
| `countUp` | `boolean` | `true` | Count up on entry; off for years and versions |
| `step` | `number` |  | Reveal on this build step |
| `morph` | `string` |  | Shared-element id |

```mdx
<Stat value="42%" label="improvement" />
```

### ProgressBar

Segmented progress/percentage bar visualization.

Use for: A split of a whole; Progress towards a goal.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `segments` | `Array<{ label: string; flex: number; color?: "teal" \| "yellow" \| "red" \| "navy" }>` |  | Segments with relative widths; no colour means the slide accent |

```mdx
<ProgressBar segments={[{ label: "Done 70%", flex: 7, color: "teal" }, { label: "Left 30%", flex: 3, color: "red" }]} />
```

### Spectrum

Range bar that runs teal to yellow to red across its segments.

Use for: A scale from fine to risky.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `segments` | `Array<{ label: string; sub?: string; flex?: number }>` |  | Segments from the safe end to the risky end |

```mdx
<Spectrum segments={[{ label: "Low", sub: "Safe" }, { label: "Medium" }, { label: "High", sub: "Risky" }]} />
```

### Timeline

Horizontal timeline showing events or milestones leading to a deadline.

Use for: Milestones towards a deadline; A short history.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `events` | `Array<{ date: string; title: string; description?: string; color?: "teal" \| "yellow" \| "red" \| "navy"; isDeadline?: boolean }>` |  | Events in order |
| `color` | `"teal" \| "yellow" \| "red" \| "navy"` |  | Colour for events without one; defaults to the slide accent |

```mdx
<Timeline
  color="teal"
  events={[
    { date: "Jan", title: "Kick-off" },
    { date: "Mar", title: "Beta" },
    { date: "Jun", title: "Launch", isDeadline: true },
  ]}
/>
```

### Quadrants

2x2 matrix (four-quadrant chart) with two axes and items plotted by score.

Use for: Prioritising by two criteria.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `xAxis` | `{ label: string; low?: string; high?: string }` |  | Horizontal axis |
| `yAxis` | `{ label: string; low?: string; high?: string }` |  | Vertical axis |
| `items` | `Array<{ label: string; x: number; y: number; color?: string }>` | `[]` | Items with x and y from 0 to 1; no colour means the slide accent |
| `quadrants` | `{ topLeft?, topRight?, bottomLeft?, bottomRight?: { label?: string; color?: string } }` | `{}` | Quadrant labels and tints |
| `size` | `number` | `820` | Plot size in px |

```mdx
<Quadrants
  xAxis={{ label: "Effort", low: "Low", high: "High" }}
  yAxis={{ label: "Impact", low: "Low", high: "High" }}
  quadrants={{ topLeft: { label: "Quick wins", color: "teal" } }}
  items={[{ label: "Cache", x: 0.2, y: 0.8 }]}
/>
```

### ScatterChart

Connected scatter plot, one line per series, with tabs that swap the x axis and animate the points.

Use for: Benchmark results across two metrics; A cut-off you drag live.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `data` | `Array<Record<string, unknown>>` |  | One row per point |
| `x` | `ChartAxis \| ChartAxis[]` |  | One axis, or several to tab through: { key, label, tab?, format?, domain?, pad? } |
| `y` | `ChartAxis` |  | Vertical axis |
| `seriesKey` | `string` | `"series"` | Row field that groups points |
| `series` | `Array<{ id: string; label?: string; color?: string }>` |  | Order, labels and colours |
| `pointLabel` | `string` |  | Row field written beside points when detail is on |
| `start` | `string` |  | Key of the initial x axis |
| `fixed` | `boolean` | `false` | Hide tabs, lock the x axis |
| `keyboard` | `boolean` | `true` | n cycles axes, digits pick one |
| `detail` | `boolean` | `false` | Label every point and line |
| `legend` | `boolean` | `false` | Clickable legend that hides a series |
| `exclude` | `string[] \| ((row) => boolean)` |  | Drop points ("seriesId:pointLabel") |
| `lines` | `boolean` | `true` | Connect each series in x order |
| `threshold` | `boolean \| number` | `false` | Draggable cut-off with a live count |
| `thresholdLabel` | `string` | `"at or below"` | Words after the count |
| `pointRadius` | `number` | `9` | Dot radius |
| `width` | `number` | `1500` | Width in px |
| `height` | `number` | `600` | Height in px |

```mdx
<ScatterChart
  detail
  pointLabel="run"
  data={[
    { series: "small", run: "a", cost: 2, tokens: 40, score: 61 },
    { series: "small", run: "b", cost: 4, tokens: 90, score: 70 },
    { series: "large", run: "a", cost: 9, tokens: 60, score: 78 },
    { series: "large", run: "b", cost: 15, tokens: 120, score: 86 },
  ]}
  x={[{ key: "cost", label: "Cost", format: "${v}" }, { key: "tokens", label: "Tokens", format: "{v}k" }]}
  y={{ key: "score", label: "Score", format: "{v}%" }}
/>
```

### Gauge

A ring gauge whose arc fills while the number counts up, with an optional target tick that lights when it is passed.

Use for: A measurement against a target; Two or three KPIs side by side in a GaugeRow.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `value` | `number` |  | The measured value |
| `max` | `number` | `100` | The value of a full ring |
| `target` | `number` |  | A tick that lights up when the value passes it |
| `unit` | `string` | `"%"` | Written after the number |
| `label` | `string` |  | Below the ring |
| `caption` | `string` |  | Small text inside the ring |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `countUp` | `boolean` | `true` | Fill and count up on entry |
| `size` | `number` | `640` | Width in px; in a GaugeRow the row sizes it to fit |
| `step` | `number` |  | Reveal on this build step |
| `morph` | `string` |  | Shared-element id |

```mdx
<Gauge value={87} target={80} label="Remote cache hits" />
```

### GaugeRow

Two to four gauges side by side, sized to fit the slide and entering one after another.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `gap` | `number` | `80` | Space between gauges in px |

```mdx
<GaugeRow>
  <Gauge value={87} target={80} label="Remote cache hits" />
  <Gauge value={94} target={90} label="Builds under 10 min" />
</GaugeRow>
```

### TraceTimeline

A timeline a charge runs along to today, lighting each milestone it reaches; later milestones stay dashed as planned.

Use for: How far a rollout has come and what is still planned; A roadmap the presenter walks through milestone by milestone (steps).

| Prop | Type | Default | What it does |
|---|---|---|---|
| `from` | `string` |  | First month, "YYYY-MM" |
| `to` | `string` |  | Last month, "YYYY-MM" |
| `now` | `string` |  | Where the charge stops, "YYYY-MM-DD"; omitted means everything is done |
| `steps` | `boolean` | `false` | Each milestone up to now is a build step |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `width` | `number` | `1760` | Total width in px |

```mdx
<TraceTimeline from="2026-01" to="2026-12" now="2026-10-14">
  <Milestone at="2026-02" label="Pilot" detail="2 teams" />
  <Milestone at="2026-06" label="Rollout" />
  <Milestone at="2026-11" label="Every team" detail="planned" />
</TraceTimeline>
```

#### Milestone

One milestone of a TraceTimeline, at a month or a day.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `at` | `string` |  | "YYYY-MM" or "YYYY-MM-DD" |
| `label` | `string` |  | What happened or is planned |
| `detail` | `string` |  | A short line under the label |

```mdx
<Milestone at="2026-06" label="Rollout" detail="10 teams" />
```

### NumberPunch

A full-size number that punches in, then rolls like an odometer to its new value with a sticker for the change.

Use for: One number that changed, before and after; The result a talk builds up to.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `from` | `number` |  | The number before the change |
| `to` | `number` |  | The number after it |
| `unit` | `string` |  | Written after the number, e.g. "min" |
| `label` | `string` |  | What is measured, under the number |
| `before` | `string` |  | When `from` was measured; shows "was 38 min in June" |
| `delta` | `boolean \| string` |  | Sticker with the change: true computes the percentage |
| `size` | `number` | `480` | Number size in px |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Colour of the new number; defaults to the slide accent |
| `steps` | `boolean` | `false` | The roll waits for a build step |

```mdx
<NumberPunch from={38} to={9} unit="min" label="Clean build" delta />
```

## Technical Diagrams

### BlockDiagram

General-purpose boxes-and-arrows diagram on a row/column grid.

Use for: System architecture; Data flow between parts.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `nodes` | `Array<{ id: string; row: number; column: number; title: string; kicker?: string; sub?: string; items?: string[]; accent?: string; dashed?: boolean; emphasis?: boolean; rowSpan?: number; colSpan?: number }>` |  | Boxes on the grid |
| `edges` | `Array<{ from: string; to: string; label?: string; dashed?: boolean; accent?: string; fromSide?: string; toSide?: string }>` | `[]` | Arrows between boxes, drawn in source order |
| `caption` | `string` |  | Italic caption below |
| `width` | `number` | `1700` | Width in px |
| `rowHeight` | `number` | `190` | Row height in px |
| `gap` | `number` | `28` | Gap between cells in px |

```mdx
<BlockDiagram
  nodes={[
    { id: "client", row: 0, column: 0, title: "Client" },
    { id: "api", row: 0, column: 1, title: "API", emphasis: true, accent: "teal" },
    { id: "db", row: 0, column: 2, title: "Database" },
  ]}
  edges={[
    { from: "client", to: "api", label: "HTTPS" },
    { from: "api", to: "db" },
  ]}
/>
```

### StackDiagram

Layered architecture: horizontal bands stacked top to bottom.

Use for: A layered architecture; What sits on what.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `layers` | `Array<{ title: string; sub?: string; items?: string[]; accent?: string }>` |  | Bands from top to bottom |
| `arrows` | `"solid" \| "dashed" \| "none"` | `"solid"` | Connectors between bands |
| `caption` | `string` |  | Italic caption below |
| `width` | `number` | `1500` | Width in px |

```mdx
<StackDiagram
  layers={[
    { title: "Interface", items: ["Web", "CLI"] },
    { title: "Services", items: ["Auth", "Billing"] },
    { title: "Storage", items: ["Postgres"] },
  ]}
/>
```

### CycleDiagram

Steps arranged in a loop, or spokes pointing at a hub.

Use for: A feedback loop; Parts feeding one centre.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `steps` | `Array<{ title: string; meta?: string; accent?: string; satellite?: { label: string; accent?: string } }>` |  | Clockwise from the top |
| `mode` | `"cycle" \| "hub"` | `"cycle"` | A loop, or spokes into a hub |
| `centerTitle` | `string` |  | Text in the middle |
| `centerSubtitle` | `string` |  | Smaller line under the centre title |
| `centerAccent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` | `"navy"` | Hub fill |
| `arrowAccent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` | `"gray"` | Connector colour |
| `caption` | `string` |  | Italic caption below |
| `size` | `number` | `860` | Rendered width and height in px |

```mdx
<CycleDiagram
  centerTitle="Loop"
  steps={[
    { title: "Build", meta: "Day 1" },
    { title: "Measure" },
    { title: "Learn" },
  ]}
/>
```

### PyramidDiagram

Stacked tiers that taper — a hierarchy, a maturity model, or a funnel.

Use for: A test pyramid; A sales funnel; A maturity model.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `layers` | `Array<{ title: string; sub?: string; meta?: string; accent?: string }>` |  | Tiers from top to bottom |
| `pointed` | `boolean` | `false` | Taper to a point |
| `inverted` | `boolean` | `false` | Narrow end at the bottom (a funnel) |
| `caption` | `string` |  | Italic caption below |
| `width` | `number` | `1180` | Widest band in px |

```mdx
<PyramidDiagram
  layers={[
    { title: "End to end", meta: "Few" },
    { title: "Integration", meta: "Some" },
    { title: "Unit", meta: "Many" },
  ]}
/>
```

### SequenceDiagram

UML-style sequence diagram with actors and messages.

Use for: A request and its response; A protocol between services.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `actors` | `Array<{ id: string; label: string; color?: "yellow" \| "teal" \| "red" \| "navy" \| "gray" }>` |  | Lanes from left to right |
| `messages` | `Array<{ from: string; to: string; label: string; type?: "solid" \| "dashed" }>` |  | Messages from top to bottom |
| `showLifelines` | `boolean` | `true` | Dashed lines under the actors |
| `messageSpacing` | `number` | `60` | Vertical gap between messages in px |
| `width` | `number` |  | Render width in px; the drawing scales to fit |

```mdx
<SequenceDiagram
  actors={[{ id: "client", label: "Client", color: "teal" }, { id: "server", label: "Server", color: "navy" }]}
  messages={[
    { from: "client", to: "server", label: "GET /deck" },
    { from: "server", to: "client", label: "200 OK", type: "dashed" },
  ]}
/>
```

### ActivityDiagram

UML-style activity diagram with actions, decisions, and flows.

Use for: A process with decisions.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `nodes` | `Array<{ id: string; type: "start" \| "end" \| "action" \| "decision" \| "fork" \| "join"; label?: string; color?: string; column?: number; row?: number }>` |  | Nodes; column 0 is the centre |
| `edges` | `Array<{ from: string; to: string; label?: string }>` |  | Flows between nodes |
| `rowSpacing` | `number` | `100` | Vertical spacing in px |
| `columnSpacing` | `number` | `200` | Horizontal spacing in px |
| `width` | `number` |  | Render width in px; the drawing scales to fit |

```mdx
<ActivityDiagram
  nodes={[
    { id: "s", type: "start" },
    { id: "a", type: "action", label: "Write deck", color: "teal" },
    { id: "d", type: "decision", label: "OK?" },
    { id: "e", type: "end" },
  ]}
  edges={[{ from: "s", to: "a" }, { from: "a", to: "d" }, { from: "d", to: "e", label: "yes" }]}
/>
```

### DataModel

Entity relationship diagram for data models.

Use for: A data model; Types and how they relate.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `entities` | `Array<{ id: string; name: string; kind?: "entity" \| "interface" \| "type" \| "enum"; color?: "teal" \| "yellow" \| "red" \| "navy" \| "gray"; fields?: Array<{ name: string; type: string; primary?: boolean; required?: boolean }>; values?: string[]; column?: number; row?: number }>` |  | Boxes; column defaults to the index, colour to the slide accent |
| `relations` | `Array<{ from: string; to: string; type?: "one-to-one" \| "one-to-many" \| "many-to-many" \| "extends" \| "implements"; label?: string }>` | `[]` | Lines between entities |
| `columnSpacing` | `number` | `280` | Horizontal spacing in px |
| `rowSpacing` | `number` | `200` | Vertical spacing in px |
| `width` | `number` |  | Render width in px; the drawing scales to fit |

```mdx
<DataModel
  entities={[
    { id: "deck", name: "Deck", fields: [{ name: "id", type: "string", primary: true }, { name: "title", type: "string", required: true }] },
    { id: "slide", name: "Slide", color: "navy", fields: [{ name: "id", type: "string", primary: true }, { name: "deckId", type: "string", required: true }] },
  ]}
  relations={[{ from: "deck", to: "slide", type: "one-to-many", label: "has" }]}
/>
```

### FeedbackLoops

CI/CD pipeline with stage rings, push arrows, and feedback loops back to roles.

Use for: How fast each stage reports back.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `stages` | `Array<{ id: string; title: string; lines?: string[]; color: Tone }>` |  | Rings from left to right |
| `arrows` | `Array<{ from: string; to: string; label?: string; color?: Tone }>` | `[]` | Push arrows between stages |
| `targets` | `Array<{ id: string; label: string; color?: Tone; x?: number; y?: number; w?: number; h?: number }>` | `[]` | Role boxes below |
| `feedbacks` | `Array<{ from: string; to: string; color?: Tone }>` | `[]` | Return arrows on stacked lanes |
| `width` | `number` | `1760` | Width in px |
| `height` | `number` | `820` | Height in px |

```mdx
<FeedbackLoops
  stages={[
    { id: "plan", title: "Planning", color: "pale-yellow" },
    { id: "push", title: "Pre-push", color: "yellow" },
    { id: "ci", title: "CI", color: "teal" },
    { id: "manual", title: "Manual", lines: ["testing"], color: "slate" },
    { id: "mon", title: "Monitoring", color: "navy" },
  ]}
  arrows={[
    { from: "plan", to: "push", label: "code" },
    { from: "push", to: "ci", label: "push" },
    { from: "ci", to: "manual", label: "deploy" },
    { from: "manual", to: "mon", label: "release" },
  ]}
  targets={[
    { id: "stake", label: "Stakeholders" },
    { id: "dev", label: "Developer" },
  ]}
  feedbacks={[
    { from: "push", to: "dev" },
    { from: "ci", to: "dev" },
    { from: "manual", to: "dev" },
    { from: "manual", to: "stake" },
    { from: "mon", to: "stake" },
    { from: "mon", to: "dev" },
  ]}
/>
```

### AppShellDiagram

Architecture diagram showing app shell with topbar, sidebar, and main area.

Use for: How a host app frames its modules.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `title` | `string` |  | Badge text on the frame |
| `topBar` | `{ label: string; items?: string[] }` |  | Top bar |
| `sidebar` | `{ label: string; items?: string[] }` |  | Sidebar; the first item is highlighted |
| `mainArea` | `{ label: string; subtitle?: string }` |  | Main area |
| `accent` | `"yellow" \| "teal" \| "navy" \| "red" \| "gray"` |  | Defaults to the slide accent |

```mdx
<AppShellDiagram
  title="Host app"
  topBar={{ label: "Top bar", items: ["Search", "Profile"] }}
  sidebar={{ label: "Modules", items: ["Decks", "Gallery", "Chat"] }}
  mainArea={{ label: "Main area", subtitle: "The active module renders here" }}
/>
```

### BracketDiagram

Title with bracket connectors to content boxes below.

Use for: A concept splitting into two kinds.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `title` | `string` |  | Heading the brackets hang from |
| `titleColor` | `string` |  | Any CSS colour |
| `items` | `Array<{ content: string; color: "green" \| "yellow" \| "teal" \| "red" \| "navy" }>` |  | One or two boxes |

```mdx
<BracketDiagram
  title="Two kinds"
  items={[
    { content: "The first kind", color: "green" },
    { content: "The second kind", color: "navy" },
  ]}
/>
```

### SignalFlow

A pipeline of nodes joined by wires that draw themselves, with lights travelling along them once the chain is built.

Use for: How a request or data moves through a system; A short process where work flows left to right.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `lines` | `"curved" \| "angled"` | `"curved"` | Shape of bypass arcs: smooth or a circuit trace |
| `pulse` | `boolean` | `true` | Lights travel along the wires, looping |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `width` | `number` | `1760` | Total width in px |

```mdx
<SignalFlow>
  <SignalNode label="Ingest" metric="2.1k docs/s" />
  <SignalNode label="Index" metric="40M vectors" />
  <SignalNode label="Answer" metric="380 ms" />
</SignalFlow>
```

#### SignalNode

One node of a SignalFlow, with a label and an optional figure.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `label` | `string` |  | Node name |
| `metric` | `string` |  | A short figure under the label |
| `step` | `number` |  | Reveal the node and the wire into it on this build step |

```mdx
<SignalNode label="Index" metric="40M vectors" />
```

#### SignalBypass

A second path over a SignalFlow that skips nodes, such as a cache hit.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `from` | `number` |  | 1-based index of the node it leaves |
| `to` | `number` |  | 1-based index of the node it rejoins |
| `label` | `string` |  | Shown above the arc |
| `step` | `number` |  | Reveal on this build step |

```mdx
<SignalBypass from={1} to={3} label="cache hit" />
```

### TracedPoints

A statement on the left wired to the points that follow from it, each line drawing out with a spark as its point arrives.

Use for: Three or four points that all follow from one headline; A review slide: what changed and why.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `title` | `string` |  | The statement the points follow from |
| `lines` | `"curved" \| "angled"` | `"curved"` | Smooth curves or circuit traces |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Defaults to the slide accent |
| `titleSize` | `number` | `96` | Title size in px |
| `width` | `number` | `1760` | Total width in px |

```mdx
<TracedPoints title="Three things changed">
  <TracedPoint step={1} label="First point" detail="Why it matters" />
  <TracedPoint step={2} label="Second point" />
</TracedPoints>
```

#### TracedPoint

One point of a TracedPoints, with a label and an optional detail line.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `label` | `string` |  | The point |
| `detail` | `string` |  | A short line under it |
| `step` | `number` |  | Reveal the point and its line on this build step |

```mdx
<TracedPoint step={1} label="Build time down 41%" detail="Remote cache on every branch" />
```

## Media

### ContentImage

Display an image from the content folder with optional fade effect.

Use for: A screenshot; A photo with a soft edge.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `src` | `string` |  | Imported image or a path relative to the deck folder |
| `alt` | `string` | `""` | Alternative text |
| `width` | `string \| number` | `"100%"` | Width |
| `maxWidth` | `string \| number` |  | Maximum width |
| `height` | `string \| number` |  | Height |
| `fade` | `boolean` | `false` | Soft radial fade at the edges |
| `fadeSize` | `number` | `70` | Percent fully visible when fading |

```mdx
<ContentImage src="images/photo.png" alt="Description" width={800} />
```

### Svg

Display an SVG file from the content folder.

Use for: A diagram exported from a drawing tool.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `src` | `string` |  | Imported SVG or a path relative to the deck folder |
| `alt` | `string` | `""` | Alternative text |
| `width` | `string \| number` | `"100%"` | Width |
| `maxWidth` | `string \| number` |  | Maximum width |
| `height` | `string \| number` |  | Height |

```mdx
<Svg src="images/diagram.svg" alt="Diagram" width={1200} />
```

### BackgroundImage

Full-bleed photo behind the slide content, with blur, fade and a theme overlay.

Use for: A mood photo behind a title.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `src` | `string` |  | Imported image or a path relative to the deck folder |
| `opacity` | `number` | `1` | Image opacity |
| `position` | `"center" \| "top" \| "bottom" \| "left" \| "right"` | `"center"` | Which part of the image stays in view |
| `blur` | `number` | `0` | Blur radius in px |
| `fade` | `"none" \| "top" \| "bottom" \| "left" \| "right" \| "radial"` | `"none"` | Fade toward an edge |
| `overlay` | `boolean` | `true` | Blend into the theme background |

```mdx
<BackgroundImage src="images/photo.jpg" blur={4} />
```

### YouTube

Embedded YouTube video.

Use for: A short demo video.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `videoId` | `string` |  | The id from the video URL |
| `start` | `number` |  | Start at this second |
| `end` | `number` |  | Stop at this second |
| `width` | `number` | `960` | Width in px |
| `height` | `number` | `540` | Height in px |

```mdx
<YouTube videoId="VIDEO_ID" />
```

### Annotate

A screenshot with a camera push in on one point, then hand-drawn rings, arrows and scribbled notes, mark by mark.

Use for: Pointing at one detail in a screenshot or chart; Walking through a UI, mark by mark.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `src` | `string` |  | Imported image or a path relative to the deck folder |
| `alt` | `string` |  | What the image shows |
| `width` | `number` | `1400` | Width of the image box in px |
| `height` | `number` | `788` | Height of the image box in px |
| `zoom` | `{ x: number; y: number; scale: number }` |  | Push in on this point, before the marks |
| `accent` | `"yellow" \| "red" \| "teal" \| "navy" \| "gray"` |  | Marker colour; defaults to the slide accent |
| `steps` | `boolean` | `false` | The zoom and each mark wait for a build step |

```mdx
<Annotate src="images/dashboard.png" zoom={{ x: 1015, y: 540, scale: 1.6 }}>
  <Ring x={1015} y={525} r={110} />
  <Scribble x={600} y={640} arrowTo={[924, 607]}>the cache miss</Scribble>
</Annotate>
```

#### Ring

A hand-drawn marker ring around a point of an Annotate image.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `x` | `number` |  | Centre x in px of the image box |
| `y` | `number` |  | Centre y in px of the image box |
| `r` | `number` | `100` | Radius |
| `rx` | `number` |  | Horizontal radius, for an ellipse |
| `ry` | `number` |  | Vertical radius, for an ellipse |

```mdx
<Ring x={700} y={400} r={110} />
```

#### Scribble

A handwritten note on an Annotate image, optionally with an arrow to a point.

| Prop | Type | Default | What it does |
|---|---|---|---|
| `x` | `number` |  | Left edge in px of the image box |
| `y` | `number` |  | Text middle in px of the image box |
| `arrowTo` | `[number, number]` |  | Point the arrow points at |
| `rotate` | `number` | `-5` | Tilt in degrees |
| `size` | `number` | `44` | Text size in px |

```mdx
<Scribble x={300} y={600} arrowTo={[650, 450]}>look here</Scribble>
```

## Slide templates

Whole-slide starting points (the editor's "Add slide" offers them too).

### Title Slide

Opening slide with context subtitle, main title, and tagline.

```mdx
<Slide scheme="dark" accent="yellow" gradient="radial-accent">
  <Subtitle>Team · Date</Subtitle>
  <Title>Presentation title</Title>
  <Text muted>A one-line tagline</Text>
</Slide>
```

### Folio Title Slide

Title frame of the folio theme: the headline beside an ink panel.

```mdx
<Slide frame="title">
  <Title>Presentation title</Title>
  <Subtitle>Team, date</Subtitle>
</Slide>
```

### Folio Section Slide

Section frame of the folio theme: a short title beside a large ring.

```mdx
<Slide frame="section">
  <Title>Section title</Title>
</Slide>
```

### Folio Content Slide

Content frame of the folio theme, which every slide gets unless it names another frame.

```mdx
<Slide>
  <Subtitle>Eyebrow</Subtitle>
  <Title>A single-line assertion</Title>
  <List>
    <ListItem>First point</ListItem>
    <ListItem>Second point</ListItem>
  </List>
</Slide>
```

### Content Slide

Title and explanatory paragraph.

```mdx
<Slide scheme="dark" accent="yellow">
  <Title>Slide title</Title>
  <Text>One paragraph that explains the point.</Text>
</Slide>
```

### Bullet List Slide

Title with animated bullets.

```mdx
<Slide scheme="dark" accent="teal">
  <Title>Four points</Title>
  <List>
    <ListItem>First point</ListItem>
    <ListItem>Second point</ListItem>
    <ListItem>Third point</ListItem>
    <ListItem>Fourth point</ListItem>
  </List>
</Slide>
```

### Two Column Comparison

Side-by-side cards.

```mdx
<Slide scheme="dark">
  <Title>Two options</Title>
  <TwoColumn>
    <Card title="Option A" accent="yellow">What A gives you</Card>
    <Card title="Option B" accent="red">What B gives you</Card>
  </TwoColumn>
</Slide>
```

### Four Column Grid

Four compact cards.

```mdx
<Slide scheme="dark" gradient="radial">
  <Title>Four parts</Title>
  <FourColumn>
    <Card compact title="One">First part</Card>
    <Card compact title="Two">Second part</Card>
    <Card compact title="Three">Third part</Card>
    <Card compact title="Four">Fourth part</Card>
  </FourColumn>
</Slide>
```

### Quote Slide

Quotation with attribution.

```mdx
<Slide scheme="light" accent="red" gradient="radial-accent">
  <Subtitle>In their words</Subtitle>
  <Quote author="Author Name">The quotation goes here.</Quote>
</Slide>
```

### Spectrum Slide

Proportional range.

```mdx
<Slide scheme="light" accent="yellow">
  <Title>Where it sits</Title>
  <Spectrum segments={[{ label: "Low", flex: 1 }, { label: "Medium", flex: 1.2 }, { label: "High", flex: 1.4 }]} />
</Slide>
```

### Progress Bar Slide

Distribution bar.

```mdx
<Slide scheme="dark" accent="yellow" gradient="diagonal">
  <Title>How it splits</Title>
  <ProgressBar segments={[{ label: "Done 70%", flex: 7, color: "teal" }, { label: "Left 30%", flex: 3, color: "red" }]} />
</Slide>
```

### Statistic Highlight

Large number with context.

```mdx
<Slide scheme="light" accent="teal" gradient="radial">
  <Title>One number</Title>
  <TwoColumn>
    <Text align="left">What the number means and why it matters.</Text>
    <Stat value="42%" label="faster" />
  </TwoColumn>
</Slide>
```

### Phase Row Slide

Sequential phases.

```mdx
<Slide scheme="dark">
  <Title>Three phases</Title>
  <PhaseRow phases={[{ title: "Research", items: ["Read"], color: "navy" }, { title: "Plan", items: ["Decide"], color: "teal" }, { title: "Build", items: ["Ship"], color: "red" }]} />
</Slide>
```

### Timeline Slide

Milestones with a deadline.

```mdx
<Slide scheme="dark" accent="teal">
  <Title>The road to launch</Title>
  <Timeline color="teal" events={[{ date: "Jan", title: "Start" }, { date: "Mar", title: "Beta" }, { date: "May", title: "Freeze" }, { date: "Jun", title: "Launch", isDeadline: true }]} />
</Slide>
```

### Closing Slide

Questions or thank you.

```mdx
<Slide scheme="dark" accent="yellow" gradient="spotlight">
  <Title accent>Questions?</Title>
  <Text muted>Where to find the slides</Text>
</Slide>
```

### Discussion Slide

Two discussion prompts.

```mdx
<Slide scheme="dark" gradient="spotlight">
  <Title accent>Discuss</Title>
  <TwoColumn>
    <Card title="Question one">What would change?</Card>
    <Card title="Question two">What would you keep?</Card>
  </TwoColumn>
</Slide>
```

### Sequence Diagram

Client and server request-response.

```mdx
<Slide scheme="dark">
  <Title>Request and response</Title>
  <SequenceDiagram actors={[{ id: "client", label: "Client", color: "teal" }, { id: "server", label: "Server", color: "navy" }]} messages={[{ from: "client", to: "server", label: "Request" }, { from: "server", to: "client", label: "Response", type: "dashed" }]} />
</Slide>
```

### Data Model Diagram

Two entities and a one-to-many relation.

```mdx
<Slide scheme="dark">
  <Title>Data model</Title>
  <DataModel entities={[{ id: "a", name: "Deck", fields: [{ name: "id", type: "string", primary: true }] }, { id: "b", name: "Slide", color: "navy", fields: [{ name: "deckId", type: "string", required: true }] }]} relations={[{ from: "a", to: "b", type: "one-to-many" }]} />
</Slide>
```

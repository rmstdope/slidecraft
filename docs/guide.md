# Slidecraft user guide

Slidecraft turns one MDX file per deck into a presentation. You write slides as components
(titles, lists, cards, diagrams, charts), present them in the browser with build steps and
animated transitions, edit them in a browser editor with a live preview, and export them to a
single HTML file or a PDF.

## Install and run

**A release binary** needs nothing else. Download the binary for your system, then run it in a
folder of decks:

```sh
cd ~/decks
slidecraft            # prints the address, http://localhost:6110 by default
```

**From a checkout** (for changing Slidecraft itself) you need [Bun](https://bun.sh):

```sh
bun install
bun run dev           # http://localhost:6100
```

The [README](../README.md) covers several content folders, the config file and the MCP server.

## Files

```
decks/                    the content folder
├─ AGENTS.md              instructions for coding agents
├─ quarterly-review/
│  ├─ index.mdx           the deck
│  └─ images/             its images
├─ themes/                optional themes
│  └─ our-brand/theme.json
└─ exports/               HTML and PDF exports
```

The folder name is the deck's address: `quarterly-review/` is presented at `/quarterly-review`
and edited at `/edit/quarterly-review`.

## A first deck

```mdx
import { Presentation, Slide, Title, Subtitle, Text, List, ListItem, Notes } from '@components'

<Presentation theme="slidecraft">

<Slide scheme="dark" accent="yellow">
  <Subtitle>Platform team</Subtitle>
  <Title>Quarterly review</Title>
  <Notes>0:00-0:30. Welcome.</Notes>
</Slide>

<Slide layout="document">
  <Subtitle>This quarter</Subtitle>
  <Title>Three things shipped, one slipped</Title>
  <List>
    <ListItem>Remote build cache, on every repository</ListItem>
    <ListItem>The new on-call rota</ListItem>
    <ListItem>Faster deploys, from 20 to 6 minutes</ListItem>
  </List>
</Slide>

</Presentation>
```

Everything you use is imported from `@components` on the first line. The editor adds missing
imports for you when you save.

## The home page

The home page lists every deck as a card showing its first slide. Sort by update date, creation
date or name; filter by content folder when several are mounted. Each card opens the deck,
the editor or the AI chat, and exports HTML or PDF. **Create New** starts a new deck with the AI assistant; you can also simply create a folder
with an `index.mdx` in it, and it appears on the home page.

## The editor

Open a deck and press `Esc`, or use **Edit** on its card. The editor has three panels, and the
separators between them can be dragged:

- **Slide rail** (left): a live thumbnail per slide. Click to select, `↑`/`↓` to move through
  slides, `Alt+↑`/`Alt+↓` (or the arrow buttons) to reorder, the eye to hide a slide from
  presenting, the bin to delete. **Add slide** inserts a template after the selected slide.
- **Code** (middle): the selected slide's MDX, with completions for components and props,
  inline errors and hover help. The contextual toolbar above it edits the props of whatever
  the cursor is on (accent, size, toggles, images). Select text and click an accent dot to wrap
  it in `<Accent>`.
- **Preview** (right): the selected slide as it will look, with every step shown.

Saving (`⌘S`) writes the whole file and adds imports for new components. Unsaved changes are
marked; leaving asks first. When the file changes on disk (another editor or an agent), the
editor reloads it unless you have unsaved changes.

**Help** opens a panel listing every component with its props and an example. **Present**
(`⌘⇧Enter`) presents from the selected slide. **Chat** opens the AI assistant on this deck.

If a deck cannot be split into slides (a syntax error between slides), the editor opens the
whole file in one code editor until it parses again.

### Images in the editor

An image prop (`ContentImage src`, `BackgroundImage src`, `PersonCard image`) opens the image
picker from the toolbar: pick from the deck's own images, from the shared library, or upload a
file (png, jpg, gif, webp, up to 10 MB). From a checkout, uploads are resized to 1920 px WebP
when `sharp` is installed.

### Command palette

`⌘K` in the editor opens the insert palette: every component and slide template, searchable,
with a live preview. Enter inserts the snippet at the cursor (a template inserts a new slide).
`⌘K` while presenting opens a palette of commands for that mode: overview, dev mode,
fullscreen, presenter view, drawing, go to slide, edit, chat.

## Slides, themes and colours

Each slide sets its look with props:

| Prop | Values |
|---|---|
| `scheme` | `dark` / `light` |
| `accent` | `yellow` / `red` / `teal` / `navy` |
| `layout` | `centered` (default): a hero stack; `document`: header band and body |
| `gradient` | `none` / `radial` / `radial-accent` / `diagonal` / `spotlight` |
| `transition` | `slide` / `fade` / `morph` / `slide-up` / `zoom` / `push` / `flip` / `cube` |
| `frame` | a slide master of the theme |
| `hidden` | skip when presenting |

The deck's **theme** sets palette, fonts, logos and frames: `<Presentation theme="folio">`.
Built in are `slidecraft` (dark, slab-serif headings, four accents), `paper` (a quieter palette)
and `folio` (light, with title, section and content frames). A content folder can add its own
themes under `themes/<id>/theme.json`; a theme can extend another and bring its own frame SVGs,
fonts and logos.

| Accent | Default colour | Use for |
|---|---|---|
| yellow | `#f5b400` | the primary accent; headings and calls to action |
| red | `#e0452b` | alerts, risk |
| teal | `#1f9e89` | success, growth, AI |
| navy | `#1f3a5f` (lighter on dark slides) | structure, depth, code |

Use one accent per slide. A second colour only when it means something, and then the same
thing on every slide.

| Scheme and accent | Best for |
|---|---|
| dark + yellow | openers, the default energy |
| dark + teal | results, good news |
| dark + red | risks, incidents |
| dark + navy | calm, structural slides |
| light + yellow | handout-style content |
| light + teal | reports |
| light + red | warnings in a light deck |
| light + navy | formal, document-like slides |

## Components

Slidecraft has more than fifty components in families: text, lists, layout, blocks, diagrams,
data, media, and motion. The **gallery** (`/gallery`, or **Gallery** on the home page) shows each
one live with its props, use cases and a snippet to copy; the docs site has the same catalogue.
The [presentation author guide](agents/presentation-author.md) has a table for choosing one.

## Presenting

Open a deck from the home page. Slides scale to fit the window; nothing reflows.

| Key | Action |
|---|---|
| `→`, Space, Enter | next step, then next slide |
| `←`, Backspace | previous step |
| `↓` / `↑` | next / previous slide, skipping steps |
| Home / End | first / last slide |
| `M`, `Tab` | overview of every slide (arrows and Enter to jump; `Tab` again for a large preview) |
| `F` | fullscreen |
| `D` | dev mode: overflow warnings, title-length marks, frame outline (`F` toggles fit) |
| `P` | presenter window |
| `A` | draw on slides |
| `Esc` | edit this slide (closes the overview or leaves drawing first) |
| `⌘K` | command palette |
| `?` | every shortcut for the current mode |

### Presenter view

`P` opens a second window with the current slide, the next one, your notes and a timer. Keep
the audience window on the projector and the presenter window on your screen; either one
navigates both. In the presenter window `R` starts or resets the timer, `A` draws, `Esc` closes it.

### Drawing

`A` turns drawing on, in either window. The toolbar at the bottom has pen, highlighter, arrow,
rectangle, text, eraser and a laser pointer (keys `1` to `7`), five colours and three widths.
`⌘Z` undoes, `⌘⇧Z` redoes, `C` clears the slide, `Esc` stops drawing. Annotations are kept
per slide in this browser and show in both windows; the laser never persists.

## Export

- **HTML:** one self-contained file with every slide, image and font; it opens offline in any
  browser and has a **Read** mode that shows each slide with its notes and prints as a handout.
- **PDF:** one landscape page per slide, every step shown. It needs Chrome or Chromium installed
  (`CHROME_PATH` to point at one).

Export from the deck's card, or from a terminal with `bun run export --name <deck> [--pdf]`.
Files are written to `<content folder>/exports/`.

## The AI assistant

**Chat** on a card or in the editor opens the assistant. It reads and edits the deck slide by
slide and can create new decks; every change is compile-checked, and the preview follows along.
Three providers:

- **An OpenAI-compatible API:** set `AI_API_KEY` (and optionally `SLIDECRAFT_AI_URL` and
  `SLIDECRAFT_AI_MODEL`).
- **Claude Code** and **GitHub Copilot CLI:** installed command-line agents; they edit the files
  directly and keep their own sessions.

If the assistant leaves a slide that does not compile, a repair editor opens with the error.
[Getting started with agents](getting-started-with-agents.md) shows other ways to use a coding
agent with your decks.

## Design resolution and sizing

Every slide is authored at **1920 × 1080 pixels** and scaled as a whole to fit the screen, like
an image. So sizes are always pixels: `%`, `vw`, `vh` and `clamp()` would change with the
window and make text wrap differently on every screen. Fixed pixels look the same on a laptop,
a projector and in the PDF.

```
┌──────────────────────── 1920 ────────────────────────┐
│  80 px padding                                        │
│   ┌────────────── content area 1760 ──────────────┐   │
│   │                                               │ 1080
│   │                     920                       │   │
│   └───────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

| Element | Size |
|---|---|
| Title | 100–120 px |
| Subtitle | 32–40 px |
| Body text | 28–36 px |
| List items | 28–32 px |
| Card text | 32–40 px |
| Padding | 40–80 px |
| Gaps | 24–80 px |

`TwoColumn` is two 840 px columns with an 80 px gap. Do not use raw HTML elements, percentages,
viewport units, `clamp()` or CSS variables for spacing.

## Tips

- One idea per slide. If a document title wraps, rewrite it shorter.
- Keep the theme consistent; switch schemes for a reason (a light slide for a dense table).
- Stage content only in the order you will talk about it.
- Write notes with a time budget on the first line (`4:00-4:50.`); the presenter view and reader
  mode show them.
- Shrink large images before adding them: `node scripts/process-images.mjs <in> <out>`.
- Check the flow in the overview (`M`) and dev mode (`D`) before presenting.

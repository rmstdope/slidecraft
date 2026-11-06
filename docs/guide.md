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

The [README](../README.md) covers vaults, the config file and the MCP server.

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

The home page lists the decks of one **vault** as cards showing their first slide. The sidebar
switches vaults and the light, dark or system theme; **Settings** adds, renames or removes vaults (a
removed vault's files stay where they are) and holds the appearance choices. Sort by update date,
creation date or name, or filter by name and folder. Hover a card's preview for **Present** and
**Edit** (the deck's workspace); the icons below it export HTML or PDF.

The box at the top asks the agent for something: describe a talk or paste your notes, and when it
writes the new deck, the deck's workspace opens with the conversation. **New deck** starts from a
title slide when you would rather write it yourself; a folder with an `index.mdx` that you create
any other way appears on the home page too.

## The editor

Open a deck and press `E`, or use **Edit** on its card. The editor has three panels, and the
separators between them can be dragged:

- **Slide rail** (left): a live thumbnail per slide. Click to select, `↑`/`↓` to move through
  slides, `Alt+↑`/`Alt+↓` (or the arrow buttons) to reorder, the eye to hide a slide from
  presenting, the bin to delete. **Add slide** inserts a template after the selected slide.
- **Code** (middle): the selected slide's MDX, with completions for components and props,
  inline errors and hover help. The contextual toolbar above it edits the props of whatever
  the cursor is on (accent, size, toggles, images). Select text and click an accent dot to wrap
  it in `<Accent>`.
- **Preview** (right): the selected slide as it will look, with every step shown, on a dotted
  canvas.

Saving (`⌘S`) writes the whole file and adds imports for new components. **Autosave** (the switch
beside **Save**, on by default) saves a moment after you stop typing and when the window loses
focus, but only once every changed slide compiles, and never while the agent is working. If
another program changes the file while you have unsaved edits, the status says **Changed on
disk** and autosave pauses: **Save** writes your version over theirs. Unsaved changes are marked;
leaving saves them with autosave on, and otherwise asks whether to save them first. `Esc` goes
back to the home page, like the back arrow (it first closes an open completion list, search box
or menu, and in a text box such as the agent's message it only leaves the box). When the file changes on disk (another editor or an agent), the editor
reloads it unless you have unsaved changes.

**Help** (the question mark) opens a panel listing every component with its props and an
example. **Present** (`⌘⇧Enter`) presents from the selected slide. **Preview**, **Split** and
**Code** choose what the work area shows. The button showing the theme and scheme opens the
deck's theme, scheme and accent. The agent's conversation sits on the right (hide it with the
panel button in its bar; the **Agent** tab brings it back). The code editor follows the app's
light or dark theme.

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
`⌘K` while presenting opens a palette of commands for that mode: overview, guides,
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
`<Presentation>` can also set `scheme` and `accent` for every slide that does not set its own, so
a whole deck can be light in one place: `<Presentation theme="ion" scheme="light" accent="teal">`.
A slide's own value wins, then the deck's, then the theme's default; a theme that allows only one
scheme still decides. The editor's toolbar has pickers for all three.
Built in are `slidecraft` (dark, slab-serif headings, four accents), `paper` (a quieter palette),
`folio` (light, with title, section and content frames) and `ion` (black slides, metallic-blue
titles and glowing wires). A content folder can add its own themes under `themes/<id>/theme.json`;
a theme can extend another and bring its own frame SVGs, fonts and logos.

A theme can also set an optional `effects` block. It changes how the wired components
(`SignalFlow`, `TracedPoints`, `Gauge`, `TraceTimeline`) and titles are finished; a theme
without it stays flat.

```json
"effects": { "glow": "strong", "titleFinish": "metal", "corners": "chamfer", "texture": "grid" }
```

| Effect | Values | Default | What it changes |
|---|---|---|---|
| `glow` | `none` / `soft` / `strong` | `none` | light around wires, dots, arcs and lit nodes |
| `titleFinish` | `solid` / `metal` | `solid` | `Title` and the big numbers in brushed metal, mixed from the accent |
| `corners` | `square` / `round` / `chamfer` | `round` | the corners of diagram nodes |
| `texture` | `none` / `grid` | `none` | a dot grid behind slides without a frame |

In the `ion` theme the accent roles keep their names but take its own colours: yellow is
blue, red is ember orange, teal is aurora green and navy is violet.

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
The bar under the gallery's search box previews every component in another theme, scheme, accent
or frame. Previews start dark; "Example's own" uses what each example was written with, which
for some components is light. The choice is remembered. Opening a component
plays it live, with **Replay** and ← → for its build steps, and its **Settings** change the props:
the preview and the snippet follow, so **Copy** copies what you see.
[Choosing components](../skills/slidecraft-presentations/references/choosing.md) has a table for choosing one.

### A vault's own components

A vault can carry components of its own in `components/<Name>/index.tsx`, one folder per
component. They join the built-ins while that vault is open: its decks, the editor's completions,
the palette, the help panel and the gallery all know them, and one with a built-in's name replaces
that built-in in this vault only. Saving a file updates every open view. The Examples vault's
`components/FunnelBars/` is a small example to copy.

A component may import `slidecraft` (the app's helpers and every built-in component), `react`,
`react/jsx-runtime`, `motion/react` and files in its own folder; anything else is an error. The
gallery's **This vault** filter shows only the vault's own, and a component that does not compile
gets a card with the error. Until it is fixed, decks use the built-in of that name, or show a
placeholder on the slides that use it.

Components are code that runs with Slidecraft's access, so a vault you add asks once before
they run; **Settings › Vaults** changes the choice (**Run its components**). Vaults created in the
app, and the Examples vault, are trusted from the start. Until a vault is allowed, its slides
show placeholders where its components would be.

## Presenting

Open a deck from the home page. Slides scale to fit the window; nothing reflows.

| Key | Action |
|---|---|
| `→`, Space, Enter | next step, then next slide |
| `←`, Backspace | previous step |
| `↓` / `↑` | next / previous slide, skipping steps |
| Home / End | first / last slide |
| `M`, `Tab` | overview of every slide (arrows and Enter to jump; `Tab` again for a large preview; `E` edits the focused slide) |
| `F` | fullscreen |
| `G` | guides: overflow warnings, title-length marks, frame outline (`F` toggles fit); also the **Guides** button beside Fullscreen |
| `P` | presenter window |
| `A` | draw on slides |
| `E` | edit this slide |
| `Esc` | back to the home page (closes the overview or leaves drawing first; opens the overview in an exported file) |
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

## The agent

The workspace and the home page carry a conversation with a coding agent on your own login:
**Claude Code** (`claude`) or the **GitHub Copilot CLI** (`copilot`). Ask for a slide, a shorter
title, another theme or a whole new deck; the agent edits the file and the preview follows.
**Settings** chooses the agent for new conversations; the panel can choose another when you start
one.

- Its work streams in as it happens: text, each tool call, each changed file.
- It edits decks in the vault without asking. With Claude Code, a shell command or a file outside
  the vault shows **Allow** and **Deny** first; Copilot cannot ask from inside Slidecraft, so it is
  refused anything beyond editing in the vault. **Stop** ends the turn.
- After the turn Slidecraft checks the decks it changed; a problem shows in the conversation and
  goes to the agent with your next message.
- The slide on screen and any code you selected go with your message, shown as chips above the
  box; remove one with ×.
- While it works, the code is read-only (**Agent is editing**); unsaved edits are saved before a
  message goes out.
- After each turn you see the files it changed. **Diff** shows every line; **Undo this turn** puts
  the files back as they were, unless they have changed since (then it says which).
- Drop images, PDFs or notes into the conversation, paste them, or use the paper clip. An image
  dropped into a deck's conversation lands in the deck's `images/` folder, ready for a slide.
- Each deck keeps its conversations (pick one at the top, or **New**); they resume after a restart.

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
- Check the flow in the overview (`M`) and with the guides on (`G`) before presenting.

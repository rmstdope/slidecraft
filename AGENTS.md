# Slidecraft: instructions for coding agents

Slidecraft is an MDX presentation framework. Every deck is one `index.mdx` file in its own
folder, rendered by React components with motion animation at a fixed 1920×1080 design size.
This file is for every coding agent working in this repository. The build plan and every
architectural decision are in [`docs/plans/implementation-plan.md`](docs/plans/implementation-plan.md).

## Pick a persona

| Persona | Task | Guide |
|---|---|---|
| Presentation Author | content in a deck | [`docs/agents/presentation-author.md`](docs/agents/presentation-author.md) |
| Component Developer | a new or extended slide component | [`docs/agents/component-developer.md`](docs/agents/component-developer.md) |
| Framework Developer | editor, parser, server, runtime, bugs, features | [`docs/agents/framework-developer.md`](docs/agents/framework-developer.md) |

Decide in this order:

1. Is the task about content in a presentation? **Author.**
2. Otherwise, is a new component (or a new prop on one) needed? **Component Developer.**
3. Otherwise: **Framework Developer.**

| Request | Persona |
|---|---|
| "Add a slide about our Q3 numbers" | Author |
| "Use the light scheme on slide 3" | Author |
| "Make this deck look official" | Author (the organisation's theme) |
| "Create a Gantt chart component" | Component Developer |
| "Card needs a size prop" | Component Developer |
| "The editor loses my cursor when saving" | Framework Developer |
| "Add undo to the drawing toolbar" | Framework Developer |

When a request spans personas, finish one role's part before starting the next.
[`docs/agent-personas.md`](docs/agent-personas.md) explains why the split exists.

## Where presentations live

Decks live in a **content directory**: one folder per deck, `<content-dir>/<name>/index.mdx`.
`bun run content-dir` prints the folder the server uses; the order is `--content`, then
`SLIDECRAFT_CONTENT_DIR`, then the config file's default (`~/.config/slidecraft/config.json`), and
only when nothing is configured this repository's own `content/`. **Do not add decks to `content/`
when the content directory is somewhere else**; `content/` holds the example decks.

A content directory may hold its own `AGENTS.md` with house style (tone, language, required slides).
On style it wins; on which components exist and how they work, this repository's docs win.

## Commands

| Command | What it does |
|---|---|
| `bun install` | install dependencies |
| `bun run dev` | start the API (6110) and Vite (6100); reuses whichever is already running |
| `bun run dev:status` | report whether both dev servers are up |
| `bun run typecheck` | `tsc` type check |
| `bun run build` | type check, app build to `dist/`, export viewer to `dist/viewer/` |
| `bun test` | run all tests |
| `bun start` | serve `dist/` and the API from one process (folder mode) |
| `bun run mcp` | MCP server over stdio with the deck tools (`--content <dir>` to pick a folder) |
| `bun run export --name <deck> [--pdf]` | write `<content>/exports/<deck>.html` (or `.pdf`; PDF needs the server and Chrome) |
| `bun run build:release [--target macos-arm64]` | binaries in `release/` (after `bun run build`) |
| `bun run build:site [--base /slidecraft/]` | static docs site with the example decks in `site/` |
| `bun run content-dir` | print the content directory the server would use |

## Dev-server etiquette

- Open http://localhost:6100. Ports 6100 and 6110 are fixed constants in `shared/ports.ts`.
- **Reuse a running server; never restart or kill it**, and never start one on another port.
  Run `bun run dev:status` first. `bun run dev` is safe to run again: it only starts what is missing.
- Deck edits on disk reload in the browser by themselves (server-sent events); there is no need
  to restart anything after changing a deck.
- If edits do not show up until Vite restarts, file-system events are not reaching it (seen on
  some macOS setups). Start the dev server with `SLIDECRAFT_WATCH_POLLING=1` (or set it in `.env`).

## Tech stack

TypeScript (strict, ESM) · React 19 · motion 14 (`motion/react`) · MDX 3 · Vite 8 · Bun 1.4
(package manager, test runner, server runtime) · Monaco 0.57 (bundled locally, editor route only).

## Project layout

```
src/            client: App router (src/router.ts), views, styles
src/components/slides/   slide components, defineComponent registry, accents, contexts
src/themes/     theme registry and the built-in themes (slidecraft, paper, folio)
src/animations/ springs and variant tables
src/presenter/  presenter window, cross-window sync, navigation hook
src/drawing/    annotations: canvas, toolbar, history, persistence
src/home/       home page: deck cards, filters, home commands
src/gallery/    component gallery: search, lazy preview scheduler
src/chat/       chat page: providers, tool calls, repair editor
src/editor/     deck editor: EditorPage, usePresentation, Monaco setup, toolbars, palette, image picker
src/language-service/        platform-agnostic MDX completion, diagnostics, hover, quick fixes
src/language-service-monaco/ Monaco adapter for the language service
shared/         code used by client and server: ports, deck refs, frontmatter, deckParser, deckModel, tagAttrs, themes, mdxImports
server/         Bun server: router (index.ts), routes/, lib/ (content sources, decks, tools, watcher, SSE, chat/, exports), mcp.ts
scripts/        dev orchestrator, export, release and site builds, image and favicon scripts
tests/          bun test suites
content/        example decks (<name>/index.mdx) and the repo's own content-folder theme
docs/           guides; docs/agents/ persona guides; docs/plans/ the implementation plan
```

Path aliases: `@/*` → `src/*`, `@components` → `src/components/index.ts`, `@shared/*` →
`shared/*`, `@server/*` → `server/*`, `@content/*` → `content/*`.

## Quick start: a deck

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

## Critical rules

- **No raw HTML in decks** (`div`, `p`, `ul`, `h1`, `br`, `img`); use registered components only.
- **Fixed pixel sizes only on slides**; never `%`, `vw`, `vh`, `clamp()`, `min()`/`max()`. The
  stage is 1920 × 1080 and scaled as a picture; the content area is about 1760 × 920.
- **The component registry** (`src/components/slides/defineComponent.ts`) is the single source of
  truth for every component list, toolbar, completion, gallery, docs catalogue and prompt.
- **Colour is semantic:** one accent per slide; children inherit it. A second colour only when it
  encodes a meaning, declared deck-wide in a `COLOUR LEGEND` comment after the imports.
- **Motion is semantic:** it says *arrives now* (steps), *same thing as before* (morph), *part
  of a whole* (canvas) or *a measurement* (count-up, threshold). Never motion for interest.
- **YAML frontmatter in a deck is opaque:** preserved byte for byte, stripped before compile.

## Slide props

| Prop | Values | Default |
|---|---|---|
| `scheme` | `dark` / `light` | theme default (`dark` for slidecraft) |
| `accent` | `yellow` / `red` / `teal` / `navy` | theme default (`yellow`) |
| `gradient` | `none` / `radial` / `radial-accent` / `diagonal` / `spotlight` | `none` |
| `background` | any CSS background; wins over `gradient` | – |
| `layout` | `centered` (hero stack) / `document` (header band + body) | `centered` |
| `frame` | a frame of the theme (`title`, `section`, `content` in folio), `none` | theme default |
| `theme` | borrow another theme for this slide | the deck's |
| `transition` | `slide` / `fade` / `morph` / `slide-up` / `zoom` / `push` / `flip` / `cube` | `slide` |
| `canvas`, `camera` | slides sharing a canvas lie on one plane; `{ x, y, scale, rotate }` | – |
| `hidden` | skipped when presenting | – |

## Themes, schemes and frames

- **Theme** = the look and feel of a deck: `<Presentation theme="folio">`. Built-in themes live in
  `src/themes/builtin/<id>/theme.json`; content folders add their own under `themes/<id>/`.
  A theme can `extends` another. A single slide may borrow one with `<Slide theme="…">`.
- **Scheme** = dark or light, per slide: `<Slide scheme="light">`. A theme can restrict schemes.
- **Frame** = a slide master defined by the theme: `<Slide frame="title">`. A theme can give every
  slide a default frame (the folio theme uses `content`); `frame="none"` opts out. Frames fix the
  scheme and layout and turn gradients off. Typical framed deck: title → section → content… → title.
- When a deck is asked for as official, brand-compliant or for outside the team, use the
  organisation's theme from the content folder (`list_themes`).
- Components never hard-code colours: they use `var(--accent)`, `--text`, `--muted`, `--bg`, the
  accent variables and `tint()`, all set by the theme on the slide root.

## Layout

- `centered` (default): openers, section breaks, statements, closers. Multi-line titles are fine.
- `document`: eyebrow `Subtitle` first, then a **single-line assertion** `Title`, then one body
  component (or one layout of peers), optionally one `Callout` or `Text`. A wrapping title is a
  signal to rewrite it shorter; dev mode (`D`) marks two lines amber and three red.

## Motion

| Meaning | Tool |
|---|---|
| This arrives now | `<Step at={n}>`, or `step={n}` on Card, Stat, Callout, Text, ListItem…; `stagger row` for a row landing one by one |
| The same thing as before | `morph="id"` on both slides, `transition="morph"` on the second |
| A detail inside a whole | `canvas="name"` plus `camera={{ x, y, scale, rotate }}` |
| A measurement | `Stat` counts up (`countUp={false}` for years and versions); `ScatterChart threshold` |

Connectors in diagrams draw themselves, `prefers-reduced-motion` is honoured, thumbnails and
handouts show every step at once. More than three or four steps on a slide is usually two slides.

## Colours by role (default theme)

| Accent | Role |
|---|---|
| yellow `#f5b400` | the primary accent: headings, calls to action, the default slide accent |
| red `#e0452b` | alerts, risk, emphasis |
| teal `#1f9e89` | success, growth, AI elements |
| navy `#1f3a5f` (`#7fa7d9` on dark) | depth, structure, code |

Fonts: Zilla Slab (display, titles) and Source Sans 3 (body and UI). Logos (`public/logo-on-dark.svg`,
`public/logo-on-light.svg`) are placed by the theme; a frame can move or hide them.

## Keyboard (presenting)

`→` / Space next step · `←` previous · `↓` / `↑` next / previous slide (skipping steps) · `M` or
`Tab` overview · `F` fullscreen · `D` dev mode · `P` presenter window · `A` draw · `⌘K` palette ·
`Esc` open this slide in the editor · `?` all shortcuts. The editor and presenter window list
theirs under `?` as well.

## Adding things

- **A slide component:** create it with `defineComponent({ Component, registry, toolbar })` in
  `src/components/slides/`, export it from `src/components/slides/index.ts`, and run `bun test`:
  the registry test checks the display name, the MDX scope, the metadata and that `snippet` and
  `previewCode` compile. The gallery, palette, help panel, completions and prompts pick it up.
  See [`docs/agents/component-developer.md`](docs/agents/component-developer.md).
- **An editor or app feature:** see [`docs/agents/framework-developer.md`](docs/agents/framework-developer.md).
  Editor components live in `src/editor/components/`; they are not registered.
- **A theme:** a folder with `theme.json` (and optional frame SVGs, fonts, logos), built in under
  `src/themes/builtin/` or per content folder under `themes/`.

## Example decks

`content/` holds the example decks; each demonstrates one thing and must keep passing
`tests/content.test.ts`.

| Deck | Shows |
|---|---|
| `welcome` | every feature built so far; each phase adds finished-looking slides for what it delivered, never test fixtures |
| `folio-tour` | the folio frames around a broad set of components |
| `folio-minimal` | the smallest framed deck |
| `motion` | every motion mechanism, with a colour legend and time-budgeted notes |
| `safe-retries` | a realistic research-based talk with full notes and sources |

## Documentation

| Doc | For |
|---|---|
| [`README.md`](README.md) | running, content folders, MCP, export, releases |
| [`docs/guide.md`](docs/guide.md) | the full user guide |
| [`docs/getting-started-with-agents.md`](docs/getting-started-with-agents.md) | a first deck with a coding agent, from zero |
| [`docs/creating-presentations.md`](docs/creating-presentations.md) | the condensed authoring guide |
| [`docs/agents/`](docs/agents/) | the three persona guides |
| [`docs/agent-personas.md`](docs/agent-personas.md) | why there are personas |
| [`docs/component-registry.md`](docs/component-registry.md) | registry fields and conventions |
| [`docs/slidecraft-styleguide.md`](docs/slidecraft-styleguide.md) | the look of the app itself |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | what comes next |

## Commits

Small, focused commits with an imperative subject line. Run `bun run build` and `bun test`
before committing.

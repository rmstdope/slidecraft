# Slidecraft implementation plan

Slidecraft is a from-scratch implementation of the specification in
`../presentation-tool.md` (kept outside this repo; referred to below as "the spec",
with citations like *Part 1 §3.7*). The spec is authoritative for behaviour unless this
plan says otherwise. This document records the decisions taken before implementation,
the conventions that apply across all phases, and the phases themselves with their
deliverables and acceptance checks.

Date of decisions: 2026-10-08.

---

## 1. Decisions

| Topic | Decision | Consequence |
|---|---|---|
| Scope | Everything in the spec, phased in the spec's build order (*Part 0 §0.8*). | Twelve phases below; each ends in something usable. |
| Tool name | `slidecraft` (`SLIDECRAFT_` env prefix, `~/.config/slidecraft/config.json`, `slidecraft-<os>-<arch>` binaries, `slidecraft-*` localStorage keys, `data-slidecraft-pdf-export` marker). | Every `<tool>` / `<TOOL>` in the spec maps to this. |
| AI chat providers | **As specified**: an OpenAI-compatible HTTP chat-completions provider with the server-side tool loop, plus two spawned CLI agents: **Claude Code** (agent A, resumes by returned session id) and **GitHub Copilot CLI** (agent B, caller-supplied session id). The internal knowledge MCP client and the skills directory are dropped. | Provider ids: `http`, `claude-code`, `copilot`. Guideline 8 ("knowledge and skills") is omitted from the system prompt. |
| Deck parser | **One shared syntax-tree parser** in `shared/deckParser.ts` built on `remark-parse` + `remark-mdx`, used by the editor, the server routes, the chat tools and the MCP server. Replaces the regex parser (*Part 3 §3*) and the character scanner (*Part 4 §7.1*). | Lossless: `<Presentation>` props, comments and text between slides, and nested `<Slide>` all survive edits. See §2.3. |
| ScatterChart | **Own SVG implementation** with motion springs; no chart library. | No `resolve.dedupe` workaround; the threshold handle, axis tabs and legend are implemented directly. See Phase 4. |
| Themes (Phase 4b) | **Deck-level themes replace the corporate special case** (decided after Phase 4). A theme is a data folder (`theme.json`, frame SVGs, logos, fonts); built-in themes ship in `src/themes/builtin/`, more are discovered in `<content-dir>/themes/<id>/`. `theme` now names the look on `<Presentation>` (and optionally on one `<Slide>`); the dark/light prop is renamed `scheme`; `chrome` is replaced by `frame`, whose masters come from the theme. | Supersedes the chrome row below. |
| Corporate chrome | **Keep the mechanism**, ship a **neutral default frame**. `chrome="title|section|content"` works exactly as specified (forces light theme, `content` implies `document` layout, frame never scales, geometry from a module), but the geometry module ships a simple generic design instead of an extracted slide master. | `src/components/slides/chrome/geometry.ts` is the single file to replace with an extracted table later. |
| Brand assets | **Open defaults chosen by the implementer**: self-hosted OFL fonts and an own palette; accent role names stay `yellow`, `red`, `teal`, `navy` (+ `gray`). | See §2.1. Everything is a token swap as the spec requires (*Part 0 §0.5 item 6*). |
| Packaging | Bun `--compile` binaries for four targets, static docs site with generated catalogue, GitHub workflows (CI, Pages, release). **No Swift/WebKit macOS launcher.** | *Part 4 §14* is not implemented. |
| Known quirks (*Part 0 §0.9*) | Fixed, except step counting stays "highest index" (the number means "beat number"). | Listed per phase under "Deviations". |
| Library versions | Current stable, pinned exactly in Phase 0: React 19.3, `motion` 14 (imported from `motion/react`; the spec's Framer Motion API carries over), Vite 8.3 (Rolldown), `@vitejs/plugin-react` 6, MDX 3.1, TypeScript 7, Bun 1.4. | Later phases add their dependencies pinned the same way. |

### Default-on changes to the spec (not asked, made for quality)

- Dev mode (`D`) and the dev toolbar toggle **state**, not the URL with a reload. The URL still carries `?mode=dev` (written with `replaceState`) so links work.
- Templates are registered through `defineTemplate()` into the same registry as components, not a hand-coded list in the editor.
- Diagnostics cover **raw HTML** (as spec), **unknown components** and **invalid union prop values**, all derived from the registry.
- Monaco gets a dedicated `mdx` language id rather than overloading `markdown`.
- Image references are resolved through a `DeckContext` (deck ref + asset resolver) so components never prefix `/content/` themselves; the exporter swaps the resolver for data URLs.
- Fonts are **self-hosted and inlined** into the single-file export; the export works offline (the spec linked Google Fonts).
- The presenter window does not mount a hidden `Presentation`; a pure `analyzeDeck(element)` returns slides, step counts, notes and canvas runs for every consumer.
- Cross-window sync is one hook: `BroadcastChannel` for live navigation, pointer and stroke previews; `localStorage` only for persistence (last position, timer start, annotations).
- Basic touch support: tap advances, horizontal swipe navigates, in addition to the click/right-click path.
- Chat tool `update_slide` has no debug hook; the drawing eraser removes annotations; `Spectrum` guards one segment; `BackgroundImage` overlay uses `var(--bg)`; registry default accents match the code (inherit the slide accent).
- Reserved route names (`gallery`, `chat`, `edit`, `api`, `content`, `content-source`, `images`) are rejected as deck names by `create_presentation` and flagged by discovery, so bare `/<deck>` URLs stay as specified.

---

## 2. Cross-cutting conventions

### 2.1 Brand tokens (`src/styles/global.css`)

| Token | Value | Role |
|---|---|---|
| `--brand-yellow` | `#F5B400` | primary accent |
| `--brand-red` | `#E0452B` | red accent |
| `--accent-teal` | `#1F9E89` | teal accent |
| `--accent-navy` | `#1F3A5F` | navy accent (light theme) |
| `--accent-navy-light` | `#7FA7D9` | navy on dark theme |
| gray literal | `#8A8F98` | neutral role in `accents.ts` |
| `--dark-bg` / `--dark-text` / `--dark-muted` | `#111111` / `#FFFFFF` / `rgba(255,255,255,.6)` | dark theme |
| `--light-bg` / `--light-text` / `--light-muted` | `#FFFFFF` / `#1A1A1A` / `rgba(26,26,26,.6)` | light theme |
| `--font-display` | `'Zilla Slab', Georgia, serif` (weight 600, OFL, via `@fontsource/zilla-slab`) | headings |
| `--font-body` | `'Source Sans 3', system-ui, sans-serif` (400/600/700, OFL, via `@fontsource/source-sans-3`) | body and UI |
| `--font-mono` | `ui-monospace, 'JetBrains Mono', Menlo, monospace` | code |

Per-component light/dark shade tables (ProgressBar, Spectrum, Timeline) and `accentHex` in
`accents.ts` derive from these values. Logos: two generated SVG wordmarks (`public/logo-on-dark.svg`,
`public/logo-on-light.svg`) following the style guide's "two L-brackets and a centre dot" idea
(*Part 6 §6*); favicons generated from them. Brand web address string: none (footer shows only the rule).

### 2.2 Deck identity and URLs

Exactly as the spec: `DeckRef { source, path }`, `deckKey = source:path`, `deckName = last segment`,
bare `/<name>` resolves against the default source, `?source&path` qualify a deck (*Part 4 §3.6*).
Fixed dev ports 6100 (Vite) and 6110 (API), `strictPort`, never read from env (*Part 4 §2*).

### 2.3 Shared deck parser (`shared/deckParser.ts`)

Replaces both spec parsers. Runs in the browser and in Bun.

```ts
interface ParsedDeck {
  preamble: string                     // frontmatter, imports, comments, up to and including <Presentation ...>
  presentationAttrs: Record<string, AttrValue>
  slides: SlideBlock[]                 // top-level <Slide> elements, in order
  gaps: string[]                       // slides.length + 1 strings: text between preamble/slides/closing
  closing: string                      // from </Presentation> to end of file
}
interface SlideBlock {
  id: string                           // stable per load: slide-<n>
  text: string                         // exact source of <Slide ...>…</Slide>
  attrs: Record<string, AttrValue>     // from mdxJsxAttribute nodes; bare attribute → true
  hidden: boolean
  notes?: string                       // source text of a direct <Notes> child, if any
  titleText?: string                   // first <Title> text content (for summaries)
}
serialize(parsed) === original source when nothing changed   // lossless invariant, tested
```

- Parsing: `unified().use(remarkParse).use(remarkMdx)` on the frontmatter-stripped body, offsets
  shifted back so ranges refer to the original source. The first top-level `mdxJsxFlowElement`
  named `Presentation` is the deck; its `mdxJsxFlowElement` children named `Slide` are slides.
  Everything else inside `<Presentation>` goes into `gaps`.
- Operations (pure, return a new `ParsedDeck`): `replaceSlide`, `insertSlide(index|-1)`,
  `deleteSlide`, `moveSlide`, `setSlideAttr(index, name, value|null)` (rewrites only the opening
  tag using attribute positions), `setHidden`. Serialization concatenates preamble, gaps and slides.
- Failure mode: if the file does not parse (mid-edit syntax error), `parseDeck` throws a
  `DeckParseError` with line/column. The editor keeps the last good structure and only edits the
  selected slide's `text`; validation on save reports the error. The server returns the formatted
  error exactly as *Part 4 §7.2* describes.
- `getSlideSummary`, `findSlideAtLine` and `formatMdx` move next to it in `shared/`.
- `shared/frontmatter.ts` and `shared/mdxImports.ts` are implemented as specified.

### 2.4 Validation and broadcast

Every write path (editor save, chat tools, apply-fix, MCP tools) runs: parse → optional void-tag
repair (*Part 4 §7.4*, void list adapted to our component names: `ContentImage`, `Svg`,
`ProgressBar`, `Spectrum`, `Timeline`, `Stat`, `Divider`, `YouTube`, `BackgroundImage`) → serialize →
`validateMdx` (compile check) → write → SSE broadcast (*Part 0 §0.5 item 8*). Full tag balancing is
not implemented.

### 2.5 Welcome deck

`content/welcome/index.mdx` is the living showcase. Every phase updates it with finished-looking
slides that demonstrate that phase's features, and verifies them in the browser as part of the
phase's "done when". No test fixtures and no slides for features whose visuals have not landed.

### 2.6 Testing

`bun test` throughout. Unit tests live in `tests/` and next to pure modules. The registry test
(*Part 2 §1.6*), content tests, content-source tests, ports test, parser round-trip tests, reader
notes tests and presenter sync tests are all required. Component rendering tests use `happy-dom`
through Bun's test runner where a DOM is needed. Manual checklists are listed per phase.

---

## 3. Phases

Each phase lists: goal, work, deviations from the spec, done-when. Phases are sequential; items
inside a phase may be parallelised.

### Phase 0 — Bootstrap

**Goal:** an empty app that builds, type-checks and tests.

- `package.json` (scripts as *Part 4 §1*, minus `export:vite`), `tsconfig.json` with the spec's
  aliases, `vite.config.ts` (frontmatter-strip plugin, `@mdx-js/rollup`, React plugin incl. `.mdx`,
  fixed port, proxies, `bundleContent` switch), `vite.viewer.config.ts` placeholder, `index.html`,
  `.env.example`, `.gitignore`, `shared/ports.ts` + `tests/ports.test.ts`.
- `AGENTS.md` skeleton at the root (persona table, commands, dev-server etiquette) and a
  `CLAUDE.md` that points at it and at this plan.
- `src/main.tsx`, `src/App.tsx` with the hand-rolled router and `ViewState` union (*Part 3 §1.3*),
  `src/basePath.ts`.
- CI workflow `ci.yml` (install, build, test).

**Done when:** `bun run build` and `bun test` pass; `bun run dev` serves a home page stub on 6100.

**Status (2026-10-08): done.** Also landed early: the full `scripts/dev.ts` orchestrator with reuse
detection and `status` (planned for Phase 11), a bootstrap `server/index.ts` with `/api/health`
and CORS, `shared/frontmatter.ts` and `shared/decks.ts`, and the bundled-deck glob with its
empty alias. The App renders placeholders for gallery, chat and editor; a bundled MDX deck
renders raw at `/<deck>`.

### Phase 1 — Tokens, stage, typography, MDX pipeline

**Goal:** a deck in `content/` renders at `/<deck>` with correct scaling.

- `global.css` tokens (§2.1), theme and accent classes, reset, `@font-face` via fontsource imports.
- `Slide` (*Part 1 §6*): props and enum fallback, DOM structure, scale-to-fit, thumbnail detection,
  `_fixedScale`, gradient map with accent RGB substitution, centered and document layouts with
  `splitHeaderBody` by display name, auto-fit on overflow with the measurement sequence, logo
  placement, `SlideLayoutContext`, dev badges.
- `defineComponent()` and `defineTemplate()` (*Part 2 §1.1*), `accents.ts`, slides barrel,
  `mdxScope.tsx`, `mdx-components.tsx`, `mdx.d.ts`.
- `Title` (presets, auto-fit binary search, document grading), `Subtitle`, `Text`, `Notes`
  (renders null), `Presentation` stub that renders its first slide.
- `DeckContext` (deck ref + `resolveAsset`) and `shared/mdxImports.ts`.
- `src/bundledDecks.ts` + `.empty.ts`, first example deck.

**Done when:** the example deck renders at `/<deck>`, letterboxes on resize, light and dark
themes and all five gradients look right, a long title grades amber/red in dev mode.

**Status (2026-10-08): done.** Delivered: tokens and self-hosted fonts, `Slide` (layouts, gradients,
auto-fit, dev badge, logo, chrome padding from `chrome/geometry.ts`), `Title` / `Subtitle` / `Text` /
`Notes`, a hash-driven `Presentation` stub, `defineComponent()` / `defineTemplate()`, accents,
`SlideLayoutContext`, `DeckContext` with the asset resolver, `shared/mdxImports.ts`, springs and the
full variant tables (pulled forward from Phases 2 and 3), the `welcome` example deck, and tests for
the registry contract, `Slide`, title fitting and deck compilation (the content test from Phase 5,
pulled forward). `step` and `morph` props on `Text` arrive with the motion system in Phase 3.

### Phase 2 — Presentation engine

**Goal:** full navigation, transitions, overview, dev mode, thumbnails.

- `analyzeDeck(children)` → `{ slides, stepCounts, notes, canvasRuns }` (pure; *Part 1 §3.1*,
  `countSteps` from *§2.3*).
- Navigation state and functions (*§3.2–3.3*), hash sync (*§3.4*) with the router's same-deck
  `popstate` guard, keyboard map (*§3.7*) including the `?` modal and command palette hooks,
  pointer input plus touch (*§3.8*), fullscreen (*§3.9*), render tree with `MotionConfig`,
  `LayoutGroup`, `AnimatePresence mode="sync"` (*§3.10*), the eight transition variants and
  content variants (*§2.2*), progress pills with light-slide colour flip (*§3.11*), dev mode as
  state (*§3.12*), overview grid with measured columns and preview mode (*§3.13*), empty deck and
  `?pdf` static render (*§3.14*), `SlideThumbnail` (*§3.15*), `keyboardShortcuts.ts` registry and
  modal, `GlobalCommandPalette` with the presentation commands (*§3.16*).
- Reduced motion per *Part 1 §16*.

**Deviations:** `D` toggles state; touch swipe added.

**Done when:** arrow keys, click, overview, fullscreen, hash deep links and browser back/forward
behave per spec on a multi-slide deck; thumbnails render frozen and complete.

**Status (2026-10-08): done.** `analyzeDeck`, the pure navigation model, the full player (keys,
click/right-click/swipe, hash sync, fullscreen, progress pills, dev mode as state, overview with
measured columns and preview, `?pdf` static render, thumbnail mode that renders the first slide),
`SlideThumbnail` (fixed or measured `fit` scale, provided through a context instead of a DOM
lookup), `GlobalCommandPalette`, `KeyboardShortcutsModal` and the shortcut registry. Also pulled
forward from Phase 3: `steps.ts` and `StepContext`. Not yet: `A` (drawing, Phase 8), the Read
button (Phase 9), live reload (Phase 5), canvas runs on one stage (Phase 3).

### Phase 3 — Motion system

**Goal:** steps, morphs, canvas camera, connector drawing.

- `springs.ts`, `StepContext`, `useStepVisible`, `StepReveal` (six enter variants, layout space
  kept), `useStepMotion`, `<Step>` with `useAnimate` stagger (*Part 1 §5*).
- `morphProps` (*§8*), `camera.ts` + `CanvasStage` with four `useSpring` values (*§9*),
  canvas-run keying in `Presentation`, `drawProps` (*§10*).
- `Stat` count-up (*§5.5*) implemented with the component in Phase 4; the hook lives here.

**Done when:** the welcome deck's motion section plays correctly: beats, stagger row,
left/right/fall enters, a morph pair, canvas with scale and rotate, reduced-motion fallback.
(The spec's separate "motion" deck, with Stat, Card and diagrams, is built in Phase 12.)

**Status (2026-10-08): done.** `StepReveal`, `useStepMotion`, `<Step>` (plain and staggered),
`morphProps`, `camera.ts` + `CanvasStage` with canvas runs keyed as one stage in the player,
`drawProps`, and the count-up parser and hook for `Stat` (Phase 4). `Text` takes `step` and
`morph`. Fixed along the way: auto-fit measured hidden step offsets as overflow; measurement now
turns off every transform in the subtree. The welcome deck gained a presenting slide (Phase 2
controls, built with steps) and a motion section.

### Phase 4 — Component catalogue

**Goal:** all 55 components registered, documented, tested.

Order by family, each with props, rendering, motion, registry and toolbar metadata exactly as
*Part 2*:

1. Typography and inline: Accent, Caption, Highlight, TagPill, Quote, CenteredStatement, Section.
2. Containers: TwoColumn, FourColumn, Stack, PersonRow, Divider, SplitBackground, ContentBox,
   Callout, Card, ComparisonLayout, DefinitionLayout, BracketDiagram.
3. Lists and rows: List/ListItem (context, gated stagger), ProConList, ComparisonTable, Legend,
   IconRow, PhaseRow.
4. Data: Stat (parse, count-up), ProgressBar, Spectrum, Timeline, Quadrants, **ScatterChart**
   (own SVG: linear scales, `niceStep` ticks, grid, axis labels, dots and lines keyed per point so
   they spring between axes via `motion.circle`/`motion.path` with `layout`-free animated attrs,
   tabs, legend, detail labels, draggable threshold handle snapped to 121 candidates with live
   readout, keyboard `n`/digits).
5. Diagrams: BlockDiagram (edge routing algorithm), StackDiagram, CycleDiagram (ring geometry),
   PyramidDiagram, SequenceDiagram, ActivityDiagram, DataModel, FeedbackLoops (lane routing),
   AppShellDiagram.
6. Media: ContentImage, Svg, BackgroundImage, YouTube, Code (auto-scroll with hover pause).
7. People: PersonCard.
8. Templates via `defineTemplate()` (*Part 2 §9*), including the three corporate ones.
9. **Chrome** (*Part 1 §7*): `CorporateFrame` reading `chrome/geometry.ts`; a neutral default
   frame with our palette and logo.
10. `tests/registry.test.ts` (*Part 2 §1.6*) plus snapshot-free render tests for the algorithmic
    components (BlockDiagram routing, CycleDiagram geometry, Stat parsing, Spectrum colours,
    PyramidDiagram widths, FeedbackLoops lanes).

**Deviations:** registry defaults match code; `gray` accepted everywhere the code accepts it;
`Spectrum` one-segment guard; `BackgroundImage` overlay uses `--bg`; `Highlight`/`Divider` take raw
CSS colours (as spec).

**Done when:** every export is registered with a compiling snippet and preview; the gallery
(Phase 7) shows them all; the four example decks (*Part 6 §8*) render.

**Status (2026-10-08): done** (example decks remain Phase 12; the welcome deck tours the catalogue).
56 registered components, 18 templates via `defineTemplate()`, the neutral corporate frame, and
ScatterChart in plain SVG. Further deviations from the spec, all deliberate:
- **Spec geometry bugs fixed:** Timeline placed its line above the dates and could not put nodes on
  the line's endpoints; nodes now sit at `80 + i × spacing` on the line. BracketDiagram's box-centre
  formula missed the boxes; connectors now end over the real centres (a single box is straight below).
- **Readability:** SequenceDiagram, ActivityDiagram and DataModel take an optional `width` that scales
  the drawing through its viewBox (their spec text sizes are 12–16 px on a 1920 stage).
- **Theme-aware:** Section, CenteredStatement, Card fills and IconRow use `--text`-based colours
  instead of fixed dark gray or white tints, so they read on both themes.
- **PersonCard** shows initials when there is no photo.
- **Card `accent`** also accepts a bare attribute (slide accent), as the spec's minimal corporate deck uses.

### Phase 4b — Themes

**Goal:** apply a look and feel to a whole deck; the corporate deck becomes an ordinary deck.

- `shared/themes.ts`: the theme format (tokens, fonts, logos, logo placement, footer, frames,
  defaults, constraints), validation that keeps valid fields and reports the rest, `extends` merging.
- Built-in themes as folders in `src/themes/builtin/`: `slidecraft` (the default look), `corporate`
  (the neutral master as three SVG frames, extends slidecraft), `paper` (palette only).
- `src/themes/registry.ts`: register theme folders per content source; resolve by id with the
  deck's source first, then built-ins; `extends` chains with cycle detection; every theme sits on
  top of the default; asset paths become URLs before merging so each asset keeps its own folder.
- Scoped styling: tokens become CSS custom properties on each deck and slide root, so differently
  themed decks render side by side; theme fonts with files load under theme-private family names.
  Accents, tints, shades and gradients use `color-mix()` on the variables (no hex table).
- `resolveSlideLook()`: slide props, then the frame, then theme defaults and constraints; used by
  `Slide` and by `Presentation` for transitions and progress colours.
- Renames: slide `theme` → `scheme`, `chrome` → `frame`; `Slide` accepts `theme` to borrow another
  look. Frames carry title size and colour, sub-headline styling, alignment (text defaults left in
  a left-aligned frame), header rule (`accent` / `bar` / `none`), logo and footer placement.
- Frame templates preview inside `<Presentation theme="corporate">`. `themes` is a reserved deck name.

**Done when:** a deck with `theme="corporate"` gets frames on every slide without per-slide props;
a content-folder theme can extend a built-in; mixed-theme thumbnails render correctly.

**Status (2026-10-08): done.** Content-folder discovery and asset serving land in Phase 5 (the
registry API is ready: `registerTheme({ id, source, raw, baseUrl })`). Also fixed: overview cells
were `<button>`s that could contain buttons (chart tabs); they are now divs with `role="button"`.

### Phase 5 — Server, content model, agent tools, MCP

**Goal:** the Bun server serves decks from any content directory; external agents can edit decks.

- `server/lib/paths.ts` (flags, env, config file, port resolution), `contentSources.ts`
  (normalisation, precedence, live switch), `decks.ts` (safe ref resolution, glob matching),
  discovery (*Part 4 §3*).
- Router and CORS (*§4.1*, *§3.5*), `static.ts` (`safeJoin`, SPA fallback), `appFiles.ts`
  (disk vs embedded).
- Routes: `health`, `mdx` GET/PUT, `presentations`, `contents` GET/POST, `images` (multipart
  parser, optional `sharp`), `events` SSE with heartbeat, `apply-fix` (*§5*).
- `fileWatcher.ts` (recursive, include-filtered, 150 ms debounce), `events.ts` broadcast (*§6*).
- `shared/deckParser.ts` (§2.3) with round-trip tests, `mdxValidator.ts`, `mdxRepair.ts`
  (void tags only), `frontmatter.ts`.
- `server/lib/tools.ts`: `list_presentations`, `read_presentation`, `create_presentation`,
  `insert_slide`, `update_slide`, `delete_slide`, `list_images` with the exact error texts
  (*Part 5 §A.10*, *Part 4 §12*), reused by chat and MCP.
- `server/mcp.ts` over stdio with those tools plus `get_content_dir`, `export_html`,
  `export_pdf` (the last two land in Phase 9 and return "not built" until then).
- `agentContext.ts`: `buildDynamicDocs()` from the registry, `syncFolderInstructions()` writing
  the generated `AGENTS.md` with the version marker (*Part 4 §7.6*).
- Themes: discover `<source>/themes/<id>/theme.json` per mounted source, `GET /api/themes` (parsed
  spec, validation errors, base URL `/content-source/<id>/themes/<theme>/`), client registration on
  load and on SSE `themes-updated`; the generated `AGENTS.md` lists themes and their frames.
- `src/deckLoader.ts` runtime compile (*Part 1 §14.2*), `useSSE` (*Part 3 §1.10*), so folder mode
  works end to end; `bun start` serves `dist/`.
- Tests: `content-sources.test.ts`, `content.test.ts`, parser round-trip, multipart, validator.

**Deviations:** server reconstruction is lossless (Presentation props and gaps kept); reserved deck
names rejected; `update_slide` has no debug hook.

**Done when:** `bun run dev` with `SLIDECRAFT_CONTENT_DIR` pointing at an external folder lists,
serves and live-reloads decks; `bun run mcp` lets Claude Code create and edit a deck; the content
folder receives a generated `AGENTS.md`.

### Phase 6 — Editor and language service

**Goal:** the three-panel editor with IntelliSense.

- `usePresentation` state hook on top of `ParsedDeck` (*Part 3 §2.1*; `?slide` captured once,
  `parsedRef`, URL sync, dirty state, reload when not dirty), `api.ts` client (*§2.2*).
- `EditorPage` layout, resize handles, overlays (*§2.3–2.5*), toolbar (*§2.6*), slide rail with
  per-slide compile, hidden badge, move/delete/add (*§2.7*).
- `SlideEditor` Monaco wrapper with the `mdx` language id, options, imperative handle incl.
  `replaceText` cursor preservation (*§2.8*), cursor context (*§2.9*), contextual toolbar and
  source rewriting rules (*§2.10*), selection toolbar (*§2.11*), image paste/drop/picker (*§2.12*),
  insert palette with `ComponentPreview` (*§2.13*), help panel (*§2.14*), live preview (*§2.15*),
  save semantics (*§2.16*), `formatMdx` (*§3.1*), `useMdxCompiler` (*§4.1*).
- Language service core (platform-agnostic) and Monaco adapters (*§5*): registry adapter and
  type-string parser, completion (component, prop name, prop value, closing tag), diagnostics
  (raw HTML + unknown component + invalid union value), hover, quick fixes, language configuration.
- Editor-mode entries in the shortcuts registry; `PreviewErrorBoundary`.
- Themes in the editor: previews render inside the deck's theme; completion for `theme`, `scheme`
  and `frame` values from the registry; a theme picker on the deck and a frame picker on slides.

**Done when:** editing a slide updates the preview within 300 ms, Cmd+S saves and other tabs
reload, toolbar edits rewrite props without losing the cursor, completion and hover work on every
registered component, a raw `<div>` gets a quick fix, an unknown component is underlined.

### Phase 7 — Home, gallery, command palette, errors

- Home page (*Part 3 §1.5*): navbar, hero, filter bar with URL-persisted filters, grid,
  `PresentationCard` with lazy thumbnail and export buttons (*§1.6*), empty states, home commands.
- Gallery (*§7*): search algorithm, lazy previews with the 4-job scheduler, detail panel with
  copyable snippet.
- `ErrorBoundary` / `PresentationErrorUI` (*§1.11*), tool UI style (*§8*) as shared CSS classes.

**Done when:** every registered component and template shows a live preview in the gallery; the
home page filters, sorts and launches present/dev/edit/chat.

### Phase 8 — Presenter view and drawing

- `PresentationContext` (*Part 1 §4*, *Part 5 §B.2*) fed by `analyzeDeck` (no hidden deck mount),
  `PresenterModeWrapper`, `PresenterView` layout, timer, notes, controls, key hints (*§B.5–B.6*).
- `useCrossWindowSync`: `BroadcastChannel slidecraft-sync-<deckKey>` for navigation, pointer and
  annotation preview messages (*§B.3–B.4* semantics: 32 ms throttle, 500 ms heartbeat, 2 s
  pointer expiry), `localStorage` for last position, timer start and annotations.
  `clientPointToSlide` with its three tests.
- Drawing (*§C*): `DrawingProvider` (one annotation union: `path | arrow | rectangle | text`),
  `DrawingCanvas` SVG with all seven tools (eraser functional), `DrawingToolbar`, persistence
  `annotations-<deckKey>`, undo/redo snapshot stacks, keyboard shortcuts incl. `1`–`7` and `C`.

**Deviations:** one sync hook; eraser works; tool-number keys implemented.

**Done when:** `P` opens a presenter window that follows and drives the audience window; the laser
pointer and live strokes appear on the audience window; annotations persist across reload.

### Phase 9 — Exports and reader mode

- `vite.viewer.config.ts` and `src/exportViewer.tsx` (*Part 4 §8.1*), fonts inlined as data URLs.
- `exportDeck.ts` (*§8.2*): placeholder asset rewriting, string-prop images, logo literal
  replacement, HTML shell with base64 code and viewer; `scripts/export.ts` CLI. Content-folder
  themes used by the deck are embedded with their assets as data URLs.
- `ReaderView`, `readerNotes.ts` timing stripper with tests, print CSS (*Part 1 §11*), Read button
  in exported mode (*Part 4 §8.3*).
- `exportPdf.ts` (*§9*): Chrome discovery, per-slide `?pdf=1&slide=n` rendering, animation
  finishing, 20in × 11.25in pages, merge with `pdfunite` or `pdf-lib`; route and MCP `export_pdf`.

**Done when:** an exported HTML file opens from `file://` offline with fonts and images, reader
mode prints as a handout; the PDF has one page per visible slide in final state.

### Phase 10 — AI chat assistant

- `ChatPage` UI (*Part 5 §A.2*): provider segmented control (`http`, `claude-code`, `copilot`),
  bubbles, tool-call section, validation-error section with inline Monaco and Apply Fix, working
  bubble fed by `chat-iteration` / `chat-tool-call` SSE events, preview iframe with hash-preserving
  refresh, slide context from the iframe hash (*§A.3*).
- `POST /api/chat` contract (*§A.4*): not streamed; provider branching (*§A.6*).
- HTTP provider: OpenAI-compatible client (`AI_API_KEY`, `SLIDECRAFT_AI_URL`, `SLIDECRAFT_AI_MODEL`),
  30-iteration tool loop with validation-error map (*§A.7*), system prompt builder (*§A.8*,
  guidelines 1–7, folder AGENTS.md appended only when hand-written), registry injection (*§A.9*).
- Claude Code provider: `claude -p <msg> --output-format json --dangerously-skip-permissions
  --append-system-prompt <context> [--resume <id>]`, cwd = content source, 120 s timeout,
  session map (*§A.6.2*).
- Copilot CLI provider: `copilot -p <prompt> --allow-all-tools --output-format json --session-id
  <id> --no-auto-update [--model] [--effort]`, JSON-lines parsing, first-message context prefix,
  180 s timeout, session-disposal retry (*§A.6.3*). Flags verified against the installed CLI at
  implementation time; config block `copilot: { model, effort }` in `config.json`.
- `buildAgentContext` shared by both CLI providers (*§A.6.4*).
- `docs/agents/presentation-author.md` written in full in this phase because it is the body of
  every prompt and of the generated `AGENTS.md`.

**Done when:** each of the three providers can create a deck from a prompt and edit a slide; a
deliberately invalid slide surfaces in the Apply Fix editor and can be fixed manually.

### Phase 11 — Packaging, docs site, CI

- `scripts/dev.ts` orchestrator with reuse detection (*Part 4 §10.3*), `scripts/contentDir.ts`.
- `scripts/buildRelease.ts` (*§10.5*): embedded file table, four targets, `--external sharp`,
  version define; `embedded.generated.ts` stub tracked empty.
- `scripts/buildSite.ts` (*§10.6*): static app bundle with example decks, Markdown pages via
  `marked`, generated component catalogue, `404.html`, `.nojekyll`.
- `process-images.mjs`, `generate-favicons.mjs`.
- Workflows `pages.yml` and `release.yml` (*§11*).

**Done when:** `bun run build:release` produces a binary that serves the current directory with
no install; `bun run build:site` produces a browsable site; a `v*` tag publishes a release.

### Phase 12 — Documentation and example decks

- Root `AGENTS.md` complete (*Part 6 §4.1*), three persona docs (*§4.3*), `docs/guide.md`,
  `docs/creating-presentations.md`, `docs/component-registry.md`, `docs/slidecraft-styleguide.md`,
  `docs/getting-started-with-agents.md`, `docs/ROADMAP.md`, sample `content/AGENTS.md`, README.
- Example decks (*§8*): corporate demo (13 slides), minimal corporate (4), motion tour (16, with
  colour legend and time-budgeted notes), research-style talk (15 with full notes).

**Done when:** `tests/content.test.ts` passes on all four decks; the docs site renders every page.

---

## 4. Repository layout

As *Part 0 §0.3* with these differences: no `<launcher-app>/`; `shared/deckParser.ts` replaces
`src/editor/mdxParser.ts` and `server/lib/slideParser.ts`; `src/components/slides/chrome/geometry.ts`
holds the neutral frame; `src/components/slides/templates.ts` holds `defineTemplate()` calls;
no knowledge-MCP or skills modules under `server/lib/`.

## 5. Risks and open items

- **Copilot CLI flags** may differ from the spec's description; verify on the installed version
  before Phase 10 and adapt the provider.
- **Monaco in the Bun test runner**: language-service core is tested without Monaco; adapters are
  verified manually.
- **PDF export** needs a local Chrome; CI only tests the route with a mocked renderer.
- **Fontsource packages**: confirm `@fontsource/zilla-slab` ships weight 600 and
  `@fontsource/source-sans-3` ships 400/600/700 in woff2 at Phase 1; fall back to Roboto Slab /
  Inter if not.
- **Vite deck glob staleness**: a running Vite server once kept serving an empty
  `import.meta.glob('/content/*/index.mdx')` after a deck folder was added; a restart fixed it.
  Phase 5's runtime loader must be the fallback whenever a deck is not in the bundled map, so a
  stale glob never hides a deck.
- **File watching on macOS**: on the development machine, directory watchers (`fs.watch` on a
  folder, recursive or not, in Node and in Bun) receive no event when an existing file changes;
  only a watcher on the file itself does. Vite then serves stale modules until restarted (this
  was the cause of the "stale glob" above). `SLIDECRAFT_WATCH_POLLING=1` makes Vite poll.
  Phase 5's server watcher must not rely on recursive directory events alone: watch each
  discovered `index.mdx` file directly and keep directory watching only for new decks, with a
  polling fallback behind the same switch.
- **MDX strips indentation inside JSX**: lines of a template literal in `<Code>{`…`}</Code>` lose
  the enclosing JSX indentation. Authors indent code by the slide's indentation plus the code's
  own. Document this in the `Code` registry entry and the author guide (Phase 10/12), or have
  `Code` accept a `dedent`-style source prop.
- **Export size**: fontsource CSS lists `woff2` and `woff`, so the viewer CSS inlines both
  (about 260 KB). Phase 9 should inline only `woff2`.
- The spec's `@tanstack/charts` dependency is intentionally absent; ScatterChart behaviour is
  reproduced from the spec's description of the chart definition, not from a library API.

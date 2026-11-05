# Architecture

Where things live and how a deck travels from disk to screen. The decisions behind it are in
`docs/plans/implementation-plan.md` and `docs/plans/ux-overhaul-plan.md`.

## Tech stack

TypeScript (strict, ESM) · React 19 · motion 14 (`motion/react`) · MDX 3 · Vite 8 · Bun 1.4
(package manager, test runner, server runtime) · Monaco 0.57 (bundled locally, editor route only).

## Folders

```
src/            client: App router (src/router.ts), views, styles
src/components/slides/   slide components, defineComponent registry, accents, contexts
src/themes/     theme registry and the built-in themes (slidecraft, paper, folio, ion)
src/animations/ springs and variant tables
src/presenter/  presenter window, cross-window sync, navigation hook
src/drawing/    annotations: canvas, toolbar, history, persistence
src/home/       home page: deck cards, filters, vault switcher, home commands
src/gallery/    component gallery: search, lazy preview scheduler
src/agent/      agent conversation: panel, thread hook, event folding, markdown
src/settings/   settings page: vaults and the agent
src/editor/     deck workspace: EditorPage, usePresentation, Monaco setup, toolbars, palette, image picker
src/language-service/        platform-agnostic MDX completion, diagnostics, hover, quick fixes
src/language-service-monaco/ Monaco adapter for the language service
shared/         code used by client and server: ports, deck refs, frontmatter, deckParser, deckModel, tagAttrs, themes, mdxImports
server/         Bun server: router (index.ts), routes/, lib/ (vaults, decks, tools, agent/, skill sync, watcher, SSE, exports), mcp.ts
scripts/        dev orchestrator, export, release and site builds, image and favicon scripts
tests/          bun test suites
content/        example decks (<name>/index.mdx) and the repo's own content-folder theme
skills/         the three agent skills (source of truth; .claude/skills links to them)
docs/           guides; docs/plans/ the implementation and UX overhaul plans
```

Path aliases: `@/*` → `src/*`, `@components` → `src/components/index.ts`, `@shared/*` →
`shared/*`, `@server/*` → `server/*`, `@content/*` → `content/*`.

## Module map

```
src/main.tsx → App.tsx                      view state machine over src/router.ts routes
├─ home/HomePage                            deck cards (live first-slide thumbnails), filters, exports
├─ gallery/GalleryPage                      every registered component, lazily previewed
├─ settings/SettingsPage                    vaults, agent status and model (lazy)
├─ editor/EditorPage                        the deck workspace: agent · rail · code / preview (lazy)
│   ├─ agent/AgentChat                       conversation panel (also on the home page); useAgentThread, threadEvents
│   ├─ usePresentation                      editor state: DeckModel, selection, dirty, save
│   ├─ compileSlide                         compiles one slide in the browser for the preview
│   ├─ components/                          SlideSidebar, SlideEditor, SlidePreview, InsertPalette,
│   │                                       ContextualToolbar, SelectionToolbar, ImagePickerModal, HelpPanel
│   └─ monacoSetup + language-service-monaco  completions, diagnostics, hover, quick fixes
└─ DeckView → compiled deck module
    └─ slides/Presentation                  analyzeDeck → player, thumbnail, PDF view, presenter, reader
        ├─ presenter/useDeckNavigation      slide and step state, cross-window sync
        ├─ presentation/ Overview, DevOverlay, ProgressIndicator, PdfView, ReaderView
        ├─ drawing/ DrawingOverlay           annotations per slide
        └─ slides/Slide                      resolveSlideLook (theme → frame → props), steps, canvas

shared/   deckParser (lossless, MDX AST based) · deckModel (head/slides/seps/tail) · tagAttrs
          frontmatter · mdxImports · themes · decks (refs, reserved names) · agent · lineDiff · exportPayload · ports
server/   index.ts router · routes/ (mdx, content and vaults, images, export, agent)
          lib/ contentSources (vaults), decks, deckStore, fileWatcher, events (SSE), tools, mdxValidator,
               mdxRepair, agentContext (generated AGENTS.md), skillSync, deckChecks, themes, images,
               exports, chrome, agent/ (backend seam, Claude Code, Copilot, threads, checkpoints,
               attachments, prompt)
          mcp.ts (stdio MCP server over lib/tools; the binary runs it with --mcp)
skills/   slidecraft-presentations (synced into vaults), slidecraft-components, slidecraft-dev
```

How a deck reaches the screen: in dev and on the static site, decks under `content/` are bundled
by Vite (`src/bundledDecks.ts`); every other deck is fetched as MDX text from the server and
compiled in the browser by `src/deckLoader.tsx`, with imports rewritten by `shared/mdxImports.ts`
so only `@components` and relative image files resolve. Live reload is a server-sent event
(`presentation-updated`) that makes the app recompile and swap the module, keeping the position.

## Data model

```ts
// shared/deckParser.ts: what the file contains, with exact offsets
interface ParsedDeck {
  source: string
  frontmatter: string
  presentation: { start: number; end: number; attrs: Record<string, AttrValue> }
  slides: SlideBlock[]   // index, start/end, text, line/endLine, attrs, hidden, notes?, titleText?
}

// shared/deckModel.ts: what the editor edits; joining the parts gives the file back byte for byte
interface DeckModel {
  head: string           // frontmatter, imports, comments, the <Presentation> tag
  slides: { id: string; text: string }[]
  seps: string[]         // text between slides
  tail: string
}
```

`usePresentation(deck)` returns `{ state, actions, selected, selectedIndex, deckTheme }`. The
actions are `selectSlide`, `selectByOffset`, `updateSelectedSlide`, `addSlide`, `deleteSlide`,
`moveSlide`, `toggleHidden`, `setDeckTheme`, `updateRaw`, `tryStructured`, `save` and `reload`.
A deck the parser cannot split opens in raw mode (`state.raw`): the whole file in one editor
until it parses again. Saving adds newly used components to the import line
(`syncComponentImports`).

## View modes

| Mode | Where | Notes |
|---|---|---|
| home | `/v/<vault>/` (`/` opens the last vault) | the vault conversation, cards, sort, vault switcher, new deck, HTML/PDF export |
| settings | `/settings` | vaults; the agent's status and model |
| presentation | `/v/<vault>/<deck path>` | the player; older `/<deck>?source=` links redirect |
| guides | `G` or the **Guides** button in the player (`?mode=guides`) | overflow and title-length warnings, frame outline, `F` toggles fit |
| overview | `M` / `Tab` | grid of every slide; `Tab` again for a large preview |
| presenter | `/v/<vault>/<deck>?presenter` | current and next slide, notes, timer; synced over a `BroadcastChannel` |
| thumbnail | inside cards, rails, overviews | every step shown, motion frozen (`ThumbnailContext`) |
| PDF | `/v/<vault>/<deck>?pdf=1[&slide=n]` | every slide stacked for headless Chrome |
| workspace | `/v/<vault>/edit/<deck>` | agent panel, rail, Preview / Code / Split; resizable |
| chat | `/v/<vault>/chat[/<deck>]` | redirects: to the deck's workspace, or to the vault's home page |
| gallery | `/v/<vault>/gallery` | registry-driven; built-in themes plus the vault's |

The canvas is always 1920 × 1080 and scaled with a CSS transform to fit; nothing reflows.

## Key files

| File | What |
|---|---|
| `src/App.tsx` | view state machine, deck loading, live reload |
| `src/router.ts` | vault routes, URL builders, redirects for older URLs |
| `src/components/slides/Presentation.tsx` | player, keyboard map, palette commands |
| `src/components/slides/Slide.tsx` | look resolution, layouts, frames, steps, auto-fit |
| `src/editor/EditorPage.tsx` | the workspace: agent panel, rail, code / preview, toolbars, keyboard |
| `src/editor/usePresentation.ts` | workspace state and actions |
| `src/agent/AgentChat.tsx`, `useAgentThread.ts`, `threadEvents.ts` | the conversation panel, its live thread, event folding |
| `shared/deckParser.ts` | lossless slide splitting |
| `shared/themes.ts` | theme format, validation, `extends` merging |
| `shared/agent.ts` | the agent contract: threads, events, backends |
| `server/lib/contentSources.ts` | vaults: config, migration, management, agent settings |
| `server/lib/agent/` | `AgentBackend`, the Claude Code and Copilot backends, threads, checkpoints, attachments |
| `server/lib/tools.ts` | the deck tools the MCP server serves, with fixed error texts |
| `vite.config.ts` | MDX plugin, frontmatter stripping, aliases, API proxy |

## Vite configuration

- `@mdx-js/rollup` compiles `.mdx` with `@mdx-js/react` as the provider; a pre-plugin strips YAML
  frontmatter first.
- `@vitejs/plugin-react` also handles `.mdx`.
- Aliases: `@components`, `@shared/`, `@content/`, `@/`, and `monaco-editor-esm/` for the lean
  Monaco entry (`src/editor/monacoCore.ts`). `bundledDecks` points at an empty module unless
  decks are bundled (dev, or `SLIDECRAFT_BUNDLE_CONTENT=1` for the static site).
- The dev server proxies `/api`, `/content-source`, `/images/library` and non-module `/content`
  requests to the API on 6110; `strictPort` keeps it on 6100.

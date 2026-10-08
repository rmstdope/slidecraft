# Framework developer guide

You work on everything that is not deck content and not a slide component: the app router, the
presentation engine, the editor, the parser, the language service, themes, the server, the agent
tools, chat, the presenter view, drawing, export and packaging. The decisions behind all of it are
recorded in [`docs/plans/implementation-plan.md`](../plans/implementation-plan.md); do not reopen
them without asking.

## Architecture

```
src/main.tsx → App.tsx                      view state machine over src/router.ts routes
├─ home/HomePage                            deck cards (live first-slide thumbnails), filters, exports
├─ gallery/GalleryPage                      every registered component, lazily previewed
├─ chat/ChatPage                            AI chat (lazy; carries Monaco for the repair editor)
├─ editor/EditorPage                        rail · Monaco · live preview (lazy)
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
          frontmatter · mdxImports · themes · decks (refs, reserved names) · chat · exportPayload · ports
server/   index.ts router · routes/ (mdx, content, images, export, chat, applyFix)
          lib/ contentSources, decks, deckStore, fileWatcher, events (SSE), tools, mdxValidator,
               mdxRepair, agentContext (generated AGENTS.md), themes, images, exports, chrome, chat/
          mcp.ts (stdio MCP server over lib/tools)
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
| home | `/` | cards, sort, source filter, create, HTML/PDF export |
| presentation | `/<deck>` | the player; `?source=` picks a content source |
| dev | `D` in the player | overflow and title-length warnings, frame outline, `F` toggles fit |
| overview | `M` / `Tab` | grid of every slide; `Tab` again for a large preview |
| presenter | `/<deck>?presenter` | current and next slide, notes, timer; synced over a `BroadcastChannel` |
| thumbnail | inside cards, rails, overviews | every step shown, motion frozen (`ThumbnailContext`) |
| PDF | `/<deck>?pdf=1[&slide=n]` | every slide stacked for headless Chrome |
| editor | `/edit/<deck>` | three panels, resizable |
| chat | `/chat[/<deck>]` | provider picker, streamed tool calls, preview |
| gallery | `/gallery` | registry-driven |

The canvas is always 1920 × 1080 and scaled with a CSS transform to fit; nothing reflows.

## Key files

| File | Lines | What |
|---|---|---|
| `src/App.tsx` | ~235 | view state machine, deck loading, live reload |
| `src/router.ts` | ~90 | routes, URLs, `?source=` handling |
| `src/components/slides/Presentation.tsx` | ~470 | player, keyboard map, palette commands |
| `src/components/slides/Slide.tsx` | ~350 | look resolution, layouts, frames, steps, auto-fit |
| `src/editor/EditorPage.tsx` | ~420 | editor layout, keyboard, toolbars |
| `src/editor/usePresentation.ts` | ~150 | editor state and actions |
| `shared/deckParser.ts` | ~260 | lossless slide splitting |
| `shared/themes.ts` | ~350 | theme format, validation, `extends` merging |
| `server/lib/tools.ts` | ~260 | deck tools shared by chat and MCP, with fixed error texts |
| `vite.config.ts` | ~70 | MDX plugin, frontmatter stripping, aliases, API proxy |

## Vite configuration

- `@mdx-js/rollup` compiles `.mdx` with `@mdx-js/react` as the provider; a pre-plugin strips YAML
  frontmatter first.
- `@vitejs/plugin-react` also handles `.mdx`.
- Aliases: `@components`, `@shared/`, `@content/`, `@/`, and `monaco-editor-esm/` for the lean
  Monaco entry (`src/editor/monacoCore.ts`). `bundledDecks` points at an empty module unless
  decks are bundled (dev, or `SLIDECRAFT_BUNDLE_CONTENT=1` for the static site).
- The dev server proxies `/api`, `/content-source`, `/images/library` and non-module `/content`
  requests to the API on 6110; `strictPort` keeps it on 6100.

## Common tasks

- **A keyboard shortcut in the player:** add the case to the key handler in `Presentation.tsx`,
  a palette command in the `commands` list beside it, and the row in the shortcut table
  (`src/utils/keyboardShortcuts.ts`) that the `?` modal reads. The presenter window has its own map in
  `src/presenter/PresenterView.tsx`.
- **An editor feature:** state goes into `usePresentation` as an action that edits the
  `DeckModel` (pure helpers in `shared/deckModel.ts` and `src/editor/sourceEdits.ts`, with tests in
  `tests/deckModel.test.ts` and `tests/editorLogic.test.ts`); UI in `src/editor/components/`.
- **A parser fix:** reproduce it in `tests/deckParser.test.ts` first. The parser must stay
  lossless: `serializeModel(modelFromSource(x)) === x` for every input.
- **An agent tool:** add it to `server/lib/tools.ts` (chat and MCP both use it), with its error
  texts; MCP-only tools go in `server/mcp.ts`. Update `tests/mcp.test.ts`.
- **An animation:** use the springs in `src/animations/springs.ts` and the variant tables in
  `variants.ts`; respect reduced motion (the player sets `MotionConfig reducedMotion="user"`) and `ThumbnailContext`.
- **A theme feature:** extend the format and validation in `shared/themes.ts`, resolution in
  `src/themes/resolveSlideLook.ts`, and test in `tests/themes.test.tsx`.

## Files

- **Work in:** `src/` (except `src/components/slides/` component bodies), `shared/`, `server/`,
  `scripts/`, `tests/`.
- **Be careful with:** `shared/deckParser.ts` and `shared/deckModel.ts` (every editor and tool
  write goes through them), `server/lib/tools.ts` error texts (agents match on them),
  `src/editor/monacoCore.ts` (generated from Monaco's own entry), `src/bundledDecks.ts`.
- **Do not modify:** deck content in `content/` beyond the welcome deck's showcase slides, and
  `package.json` versions outside a release.

## Testing

```sh
bun run typecheck
bun test                      # everything; bun test tests/<file> for one suite
bun run build
```

Manual check in the running app (`bun run dev:status` first; reuse it, never restart it):

- home: cards render, sorting and filters, export buttons;
- a deck: arrows walk steps, `↓` skips, `M` overview, `D` dev mode, `P` presenter, `A` draw;
- the editor: select, edit, reorder with `Alt+↑/↓`, insert with `⌘K`, save with `⌘S`, reload from disk;
- an external edit (another editor or an agent) reloads the deck and the editor.

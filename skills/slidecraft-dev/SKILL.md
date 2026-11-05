---
name: slidecraft-dev
description: Develop Slidecraft itself: the app, workspace and editor, parser and language service, themes, server, agent backend, MCP tools, presenter, export and packaging. Use for bugs, features and refactors outside deck content and slide component bodies.
---

# Slidecraft development

Everything that is not deck content and not a slide component body: the router and views, the
presentation engine, the deck workspace and its agent panel, the parser and language service,
themes, the Bun server and its agent backends, the MCP server, the presenter window, drawing,
export and packaging. Module map, data model, routes and key files:
[`references/architecture.md`](references/architecture.md).

## Workflow

1. **Know the decisions.** `docs/plans/implementation-plan.md` and
   `docs/plans/ux-overhaul-plan.md` (which wins where they disagree) record what was decided and
   why. Reopen a decision only when the person asks. Done when you know which decisions touch the
   change.
2. **Reproduce first.** For a bug, write the failing test before the fix (`tests/<area>.test.ts`);
   for a parser bug, in `tests/deckParser.test.ts`. Done when the test fails for the reported
   reason.
3. **Change the code.** Follow the area's conventions below.
4. **Run the checks:** `bun run typecheck`, `bun test`, `bun run build`. Done when all are green.
5. **Check it in the running app.** Exercise the changed flow in the browser, and when it touches
   them: the home page (cards, sorting, exports), a deck (arrows walk steps, `↓` skips, `M`, `D`,
   `P`, `A`), the workspace (select, edit, `Alt+↑/↓`, `⌘K`, `⌘S`, an agent turn), an external
   edit reloading the deck. Done when the flow works and the console is clean.
6. **Keep the docs true.** Update the guides and the plan's status for what changed; a feature
   authors should see gets a finished slide in the `welcome` deck.

## The dev server

- The app is http://localhost:6100 (Vite) and the API http://localhost:6110; both ports are fixed
  in `shared/ports.ts`.
- **Reuse a running server.** `bun run dev:status` first; `bun run dev` starts only what is
  missing. Never kill or restart a server you did not start, and never start one on another port.
- Deck edits on disk reload in the browser by themselves. When they do not, file-system events are
  not reaching Vite (seen on macOS): start with `SLIDECRAFT_WATCH_POLLING=1`.
- To test without touching the person's own vaults, point `SLIDECRAFT_CONFIG` at a scratch config
  file.

## Common tasks

- **A player shortcut:** the key handler in `Presentation.tsx`, a palette command in the
  `commands` list beside it, and the row in `src/utils/keyboardShortcuts.ts` that the `?` modal
  reads. The presenter window has its own map in `src/presenter/PresenterView.tsx`.
- **A workspace feature:** state goes into `usePresentation` as an action on the `DeckModel` (pure
  helpers in `shared/deckModel.ts` and `src/editor/sourceEdits.ts`, tested in
  `tests/deckModel.test.ts` and `tests/editorLogic.test.ts`); UI in `src/editor/components/`.
- **The parser:** it must stay lossless, `serializeModel(modelFromSource(x)) === x` for every
  input.
- **An agent tool:** `server/lib/tools.ts` (the chat and MCP share it), with fixed error texts;
  MCP-only tools in `server/mcp.ts`; tests in `tests/mcp.test.ts`.
- **The agent backend:** `server/lib/agent/` (the `AgentBackend` seam, backends, threads); events in
  `shared/agent.ts`; the panel in `src/agent/`. Backend message mapping is tested against recorded
  runs in `tests/fixtures/agent/`.
- **Vaults:** `server/lib/contentSources.ts`; routes under `/v/<vault>/` in `src/router.ts`.
- **An animation:** the springs in `src/animations/springs.ts` and the variant tables in
  `variants.ts`; honour reduced motion and `ThumbnailContext`.
- **A theme feature:** format and validation in `shared/themes.ts`, resolution in
  `src/themes/resolveSlideLook.ts`, tests in `tests/themes.test.tsx`.
- **The skills:** `skills/` is their source; `bun run skills` regenerates the component catalogue,
  and the server syncs `slidecraft-presentations` into each vault on start.

## Careful ground

- `shared/deckParser.ts` and `shared/deckModel.ts`: every workspace and tool write goes through
  them.
- `server/lib/tools.ts` error texts: agents match on them.
- `src/editor/monacoCore.ts` (generated from Monaco's own entry) and `src/bundledDecks.ts`.
- Deck content in `content/` beyond the welcome deck's showcase slides, and `package.json`
  versions outside a release, are not part of framework work.

# Roadmap

What Slidecraft does today, and what may come next. The detailed build history is in
[`docs/plans/implementation-plan.md`](plans/implementation-plan.md).

## Shipped

- Decks as one MDX file; more than fifty registered components and eighteen slide templates.
- Semantic motion: build steps, shared-element morphs, canvas and camera, count-up, drawn connectors.
- Themes with schemes and frames (slidecraft, paper, folio), per-folder themes with `extends`.
- Browser editor with live preview, insert palette, contextual toolbar, language service, image picker.
- Several content folders at once, with read-only mounts and live reload.
- Presenter view with notes, next slide and timer; drawing and annotations in both windows.
- Single-file HTML export with reader mode; PDF export through headless Chrome.
- AI chat with an OpenAI-compatible API, Claude Code or Copilot CLI; MCP server for any agent.
- Release binaries for macOS, Linux and Windows; a static docs site with the example decks.

## Planned

- **Sections and chapters:** group slides into named sections, show them in the overview, jump
  to a section, generate a table of contents slide.
- **Remote control:** drive a deck from a phone or tablet over a WebSocket, paired with a QR
  code, with touch-to-draw. Depends on the presenter view (done) and integrates with drawing.
- **Video and audio:** auto-pause `YouTube` when leaving a slide; recorded narration per slide.
- **Annotation components:** a `Whiteboard` slide and an `AnnotatableImage` whose drawings are
  saved in the deck rather than in the browser.
- **Editing notes in the presenter window:** deliberately left out of the first version.

## Ideas, not planned

- Collaborative editing of one deck by several people at once.
- Export to PowerPoint.
- Signed and notarised macOS binaries.

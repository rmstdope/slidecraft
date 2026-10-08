# Slidecraft: instructions for coding agents

Slidecraft is an MDX presentation framework. Every deck is one `index.mdx` file in its own
folder, rendered by React components with motion animation at a fixed 1920×1080 design size.
The full behavioural spec lives outside this repo (`../presentation-tool.md`); the build plan
and every architectural decision are in [`docs/plans/implementation-plan.md`](docs/plans/implementation-plan.md).

> Status: Phase 2 (presentation engine) done. This file grows into the full agent guide in Phase 12.

## Pick a persona

| Persona | Task | Guide |
|---|---|---|
| Presentation Author | content in a deck | `docs/agents/presentation-author.md` (Phase 10) |
| Component Developer | a new or extended slide component | `docs/agents/component-developer.md` (Phase 12) |
| Framework Developer | editor, parser, server, runtime, bugs | `docs/agents/framework-developer.md` (Phase 12) |

Is the task about content in a presentation? Author. Otherwise, is a new component needed?
Component Developer. Otherwise Framework Developer.

## Commands

| Command | What it does |
|---|---|
| `bun install` | install dependencies |
| `bun run dev` | start the API (6110) and Vite (6100); reuses whichever is already running |
| `bun run dev:status` | report whether both dev servers are up |
| `bun run typecheck` | `tsc` type check |
| `bun run build` | type check, app build to `dist/`, export viewer to `dist/viewer/` |
| `bun test` | run all tests |
| `bun start` | serve `dist/` and the API from one process |

## Dev-server etiquette

- Open http://localhost:6100. Ports 6100 and 6110 are fixed constants in `shared/ports.ts`.
- **Reuse a running server; never restart or kill it**, and never start one on another port.
  Run `bun run dev:status` first. `bun run dev` is safe to run again: it only starts what is missing.
- If edits do not show up until Vite restarts, file-system events are not reaching it (seen on
  some macOS setups). Start the dev server with `SLIDECRAFT_WATCH_POLLING=1` (or set it in `.env`).

## Tech stack

TypeScript (strict, ESM) · React 19 · motion 14 (`motion/react`) · MDX 3 · Vite 8 · Bun 1.4
(package manager, test runner, server runtime) · Monaco (Phase 6).

## Project layout

```
src/            client: App router (src/router.ts), views, styles
src/components/slides/   slide components, defineComponent registry, accents, contexts
src/animations/ springs and variant tables
shared/         code used by client and server: ports, deck refs, frontmatter
server/         Bun API server (server/index.ts)
scripts/        dev orchestrator and build scripts
tests/          bun test suites
content/        example decks (<name>/index.mdx)
docs/plans/     implementation plan and design notes
```

Path aliases: `@/*` → `src/*`, `@components` → `src/components/index.ts`, `@shared/*` →
`shared/*`, `@server/*` → `server/*`, `@content/*` → `content/*`.

## Critical rules

- No raw HTML in decks (`div`, `p`, `ul`, `h1`, `br`, `img`); use registered components only.
- Fixed pixel sizes only on slides; never `%`, `vw`, `vh`, `clamp()`.
- The component registry (`src/components/slides/defineComponent.ts`) is the single source of truth for
  every component list, toolbar, completion, gallery and prompt.
- Colour and motion are semantic: one accent per slide; motion only when it carries meaning.
- YAML frontmatter in a deck is opaque: preserved byte for byte, stripped before compile.

## Adding a slide component

Create it with `defineComponent({ Component, registry, toolbar })` in `src/components/slides/`,
export it from `src/components/slides/index.ts`, and run `bun test`: the registry test checks the
display name, the MDX scope, the metadata and that `snippet` and `previewCode` compile.

## Commits

Small, focused commits with an imperative subject line. Run `bun run build` and `bun test`
before committing.

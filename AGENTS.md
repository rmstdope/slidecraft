# Slidecraft: instructions for coding agents

Slidecraft is an MDX presentation app. Every deck is one `index.mdx` in its own folder, rendered
by React components with motion animation at a fixed 1920 × 1080 design size, and an agent works
on decks from inside the app. The decisions behind it are in
[`docs/plans/implementation-plan.md`](docs/plans/implementation-plan.md) and
[`docs/plans/ux-overhaul-plan.md`](docs/plans/ux-overhaul-plan.md), which wins where they disagree.

## Pick a skill

Three skills cover the work. Agents that load skills find them in `.claude/skills/`; every other
agent reads the `SKILL.md` before starting.

| Task | Skill |
|---|---|
| Content in a deck: slides, titles, notes, images, theme, colour, motion, a new deck | [`slidecraft-presentations`](skills/slidecraft-presentations/SKILL.md) |
| A new slide component, or a new prop or variant on one | [`slidecraft-components`](skills/slidecraft-components/SKILL.md) |
| Everything else: the app, workspace, parser, server, agent backend, export, bugs | [`slidecraft-dev`](skills/slidecraft-dev/SKILL.md) |

Decide in that order: content first, then components, then the framework. A request that spans
two (a deck that needs a new component) finishes one skill's part before starting the next.

## Where presentations live

Decks live in **vaults**: named folders of decks listed in `~/.config/slidecraft/config.json`
and managed on `/settings`. `bun run content-dir` prints the default vault's folder. This
repository's `content/` is the Examples vault and holds the example decks; a person's own decks
go in their own vault. A vault's hand-written `AGENTS.md` carries its house style: on style it
wins, on which components exist and how they work the skills win.

## Commands

| Command | What it does |
|---|---|
| `bun install` | install dependencies |
| `bun run dev` | start the API (6110) and Vite (6100); starts only what is not running |
| `bun run dev:status` | report whether both dev servers are up |
| `bun run typecheck` | `tsc` type check |
| `bun run build` | regenerate the skill catalogue, type check, app build to `dist/`, export viewer |
| `bun test` | run all tests |
| `bun run skills` | regenerate the skills' component catalogue from the registry |
| `bun start` | serve `dist/` and the API from one process |
| `bun run mcp` | MCP server over stdio with the deck tools (`--vault <name>` or `--content <dir>`) |
| `bun run export --name <deck> [--pdf]` | write `<vault>/exports/<deck>.html` (or `.pdf`; needs the server and Chrome) |
| `bun run build:release [--target macos-arm64]` | binaries in `release/` (after `bun run build`) |
| `bun run build:site [--base /slidecraft/]` | static docs site with the example decks in `site/` |
| `bun run content-dir` | print the default vault's folder |

**Reuse a running dev server** (`bun run dev:status` first): never kill or restart one you did
not start, and never start one on another port.

## Commits

Small, focused commits with an imperative subject line. Run `bun run build` and `bun test`
before committing.

## Documentation

| Doc | For |
|---|---|
| [`README.md`](README.md) | running, vaults, the agent, MCP, export, releases |
| [`docs/guide.md`](docs/guide.md) | the full user guide |
| [`docs/getting-started-with-agents.md`](docs/getting-started-with-agents.md) | a first deck with a coding agent, from zero |
| [`docs/creating-presentations.md`](docs/creating-presentations.md) | the condensed authoring guide for people |
| [`docs/component-registry.md`](docs/component-registry.md) | registry fields and conventions |
| [`docs/slidecraft-styleguide.md`](docs/slidecraft-styleguide.md) | the look of the app itself |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | what comes next |

# Slidecraft

An MDX presentation framework. Write each deck as one `index.mdx` file, compose slides from
registered React components, present with build steps, shared-element morphs and a pannable
canvas, edit in a browser editor with live preview, and export to a single HTML file or PDF.

> Status: early development. Phase 0 (bootstrap) is in place; see
> [the implementation plan](docs/plans/implementation-plan.md) for what comes next.

## Run from a checkout

Requires [Bun](https://bun.sh) 1.3 or later.

```sh
bun install
bun run dev        # http://localhost:6100
```

`bun run dev` starts the API server on port 6110 and the Vite dev server on 6100, reusing either
one if it is already running.

## Your own decks

Point Slidecraft at a folder of decks (one `<name>/index.mdx` per deck):

```sh
bun run dev -- --content ~/decks        # or SLIDECRAFT_CONTENT_DIR=~/decks in .env
```

Several folders can be mounted at once in `~/.config/slidecraft/config.json`:

```json
{
  "default": "mine",
  "contents": {
    "mine": "~/decks",
    "team": { "path": "/srv/team-decks", "include": ["presentations/*/index.mdx"], "readOnly": true }
  }
}
```

Themes for a folder live in `<folder>/themes/<id>/theme.json`. On start the server writes an
`AGENTS.md` into the folder so coding agents learn the components and rules, unless you keep a
hand-written one there.

## Agents (MCP)

```sh
claude mcp add slidecraft -- bun /path/to/slidecraft/server/mcp.ts --content ~/decks
```

The MCP server offers tools to list, read, create and edit decks slide by slide, and to list and
set themes. Every change is compile-checked before it is written.

## Develop

```sh
bun run typecheck
bun test
bun run build
```

## Licence

Apache-2.0. See [LICENSE](LICENSE).

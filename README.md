# Slidecraft

An MDX presentation framework. Write each deck as one `index.mdx` file, compose slides from
registered React components, present with build steps, shared-element morphs and a pannable
canvas, edit in a browser editor with live preview, and export to a single HTML file or PDF.

> Status: feature complete through packaging; documentation and example decks come next. See
> [the implementation plan](docs/plans/implementation-plan.md).

## Run a release binary

Download the binary for your system from the releases page, put it on your `PATH`, and run it in
a folder of decks (one `<name>/index.mdx` per deck):

```sh
cd ~/decks
slidecraft                 # http://localhost:6110 ; --port 7000 to change
```

The binary contains the whole app; nothing else needs installing. PDF export uses an installed
Chrome or Chromium (`CHROME_PATH` to point at one). On macOS, clear the quarantine flag of a
downloaded, unsigned binary first:

```sh
xattr -d com.apple.quarantine ./slidecraft-macos-arm64
```

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

## Build binaries, the docs site, a release

```sh
bun run build && bun run build:release            # release/slidecraft-<os>-<arch>
bun run build:release --target macos-arm64        # one target
bun run build:site --base /slidecraft/            # site/: docs, catalogue, example decks
```

To publish a release, bump `version` in `package.json` (the binary reports it), commit, and push
a matching tag: `git tag v0.2.0 && git push origin v0.2.0`. The release workflow builds and tests,
cross-compiles every binary and attaches them to a GitHub release. Pushes to `main` rebuild the
docs site on GitHub Pages.

## Develop

```sh
bun run typecheck
bun test
bun run build
```

## Licence

Apache-2.0. See [LICENSE](LICENSE).

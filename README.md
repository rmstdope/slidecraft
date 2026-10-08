# Slidecraft

An MDX presentation framework. Write each deck as one `index.mdx` file, compose slides from
registered React components, present with build steps, shared-element morphs and a pannable
canvas, edit in a browser editor with live preview, let an AI agent write and change decks, and
export to a single HTML file or a PDF.

```mdx
import { Presentation, Slide, Title, Subtitle, Stat, TwoColumn } from '@components'

<Presentation theme="slidecraft">

<Slide scheme="dark" accent="teal" layout="document">
  <Subtitle>Pilot results</Subtitle>
  <Title>Builds dropped from 38 to 9 minutes</Title>
  <TwoColumn>
    <Stat value="38 min" label="before" />
    <Stat value="9 min" label="after" />
  </TwoColumn>
</Slide>

</Presentation>
```

## Two ways to run it

### A release binary

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

### From a checkout

Requires [Bun](https://bun.sh) 1.3 or later.

```sh
bun install
bun run dev        # http://localhost:6100
```

`bun run dev` starts the API server on port 6110 and the Vite dev server on 6100, reusing either
one if it is already running. `bun run build && bun start` serves the built app from one process.

## Your decks

```
decks/
├─ AGENTS.md              instructions for coding agents (generated, or your own house style)
├─ quarterly-review/
│  ├─ index.mdx           the deck
│  └─ images/             its images, imported by relative path
├─ themes/<id>/theme.json themes for this folder (optional)
└─ exports/               HTML and PDF exports
```

A deck may start with YAML frontmatter; Slidecraft keeps it byte for byte and never interprets
it, so it is a safe place for your own metadata.

### Content folders

Point Slidecraft at one folder:

```sh
bun run dev -- --content ~/decks        # or SLIDECRAFT_CONTENT_DIR=~/decks in .env
slidecraft --content ~/decks            # the binary uses the current folder by default
```

Or mount several at once in `~/.config/slidecraft/config.json` (`SLIDECRAFT_CONFIG` to move it):

```json
{
  "default": "mine",
  "contents": {
    "mine": "~/decks",
    "team": { "path": "/srv/team-decks", "include": ["presentations/*/index.mdx"], "readOnly": true }
  }
}
```

- Every source stays mounted; the home page filters by source and deck URLs carry `?source=`.
- `include` globs choose which files are decks (default `*/index.mdx` and
  `presentations/*/index.mdx`); `readOnly` sources can be presented and exported but not edited.
- The default source is chosen by `--content`, then `SLIDECRAFT_CONTENT_DIR`, then the config's
  `default`, and finally this repository's example decks.

On start the server writes an `AGENTS.md` into the default folder with the component list and
the authoring rules, and refreshes it when Slidecraft changes. A hand-written `AGENTS.md` is
left alone.

## The AI assistant

**Chat** on the home page or in the editor talks to one of three providers:

| Provider | Setup |
|---|---|
| OpenAI-compatible API | `AI_API_KEY`; optional `SLIDECRAFT_AI_URL` and `SLIDECRAFT_AI_MODEL` (or `"ai": { "url", "model" }` in the config file) |
| Claude Code | the `claude` CLI on your `PATH` (`SLIDECRAFT_CLAUDE_BIN` to override) |
| GitHub Copilot CLI | the `copilot` CLI on your `PATH` (`SLIDECRAFT_COPILOT_BIN`; `"copilot": { "model", "effort" }` in the config) |

Every change is compile-checked before it is written; a slide the model cannot fix opens in a
repair editor.

## Agents over MCP

```sh
claude mcp add slidecraft -- bun /path/to/slidecraft/server/mcp.ts --content ~/decks
```

| Tool | Does |
|---|---|
| `get_content_dir` | where the decks are |
| `list_presentations`, `read_presentation` | find and read decks, slide by slide |
| `create_presentation` | a new deck with its first slides |
| `insert_slide`, `update_slide`, `delete_slide` | change one slide |
| `list_themes`, `set_presentation_theme` | themes and frames |
| `list_images` | images beside a deck and in the shared library |
| `export_html`, `export_pdf` | write an export into `<content>/exports/` |

Every write is compile-checked; a failing write is refused with the line and the error.

## Export

From a deck's card on the home page, or:

```sh
bun run export --name quarterly-review          # exports/quarterly-review.html
bun run export --name quarterly-review --pdf    # needs the server running and Chrome
```

The HTML file is self-contained (slides, images, fonts) and has a reader mode that shows every
slide with its notes and prints as a handout. The PDF has one page per slide with every step shown.

## Documentation

- [User guide](docs/guide.md): the editor, presenting, themes, export, sizing.
- [Getting started with agents](docs/getting-started-with-agents.md): a first deck with an AI agent.
- [Creating presentations](docs/creating-presentations.md): the condensed authoring guide.
- [AGENTS.md](AGENTS.md) and [docs/agents/](docs/agents/): instructions for coding agents.
- The gallery at `/gallery`: every component, live.

The example decks in `content/` show the features: `welcome` (everything), `folio-tour` and
`folio-minimal` (a framed theme), `motion` (every motion tool), `safe-retries` (a complete talk).

## Build binaries, the docs site, a release

```sh
bun run build && bun run build:release            # release/slidecraft-<os>-<arch>
bun run build:release --target macos-arm64        # one target
bun run build:site --base /slidecraft/            # site/: docs, catalogue, example decks
```

To publish a release, bump `version` in `package.json` (the binary reports it), commit, and push
a matching tag: `git tag v0.2.0 && git push origin v0.2.0`. The release workflow checks the tag
against `package.json`, builds and tests, cross-compiles every binary and attaches them to a
GitHub release. Pushes to `main` rebuild the docs site on GitHub Pages (set the Pages source to
GitHub Actions once).

## Develop

```sh
bun run typecheck
bun test
bun run build
```

CI runs the build and the tests on pushes to `main` and on pull requests. Contributors and coding agents:
start with [AGENTS.md](AGENTS.md).

## Licence

Code: Apache-2.0, see [LICENSE](LICENSE). The bundled fonts (Zilla Slab, Source Sans 3) are under
the SIL Open Font License. The Slidecraft logo is part of this project.

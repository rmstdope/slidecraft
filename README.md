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

### Vaults

A **vault** is a folder of presentations with its own themes, images and house style. Keep one
for work and one for private talks: the app shows one vault at a time, and the vault is in every
link (`/v/<vault>/<deck>`), so two tabs can show two vaults.

Add, rename and remove vaults on the **Vaults…** page (`/settings`); removing one never deletes
files. They are kept in `~/.config/slidecraft/config.json` (`SLIDECRAFT_CONFIG` to move it):

```json
{
  "vaults": [
    { "id": "work", "name": "Work", "path": "~/Presentations/Work" },
    { "id": "team", "name": "Team", "path": "/srv/team-decks", "include": ["presentations/*/index.mdx"], "readOnly": true }
  ],
  "lastVault": "work"
}
```

- `include` globs choose which files are decks (default `*/index.mdx` and
  `presentations/*/index.mdx`); a `readOnly` vault can be presented and exported but not edited.
- `/` opens the vault used last. `--vault <name>` (or `SLIDECRAFT_VAULT`) picks one at start.
- `--content <folder>` (or `SLIDECRAFT_CONTENT_DIR`) opens a folder that is not a vault for this
  run only; the home page offers to save it as one. The binary opens the current folder this way
  when no vault exists.
- In a checkout, this repository's example decks are the **Examples** vault.
- An older config with `contents` and `default` is turned into vaults on start; the original is
  kept as `config.json.bak`.

On start the server writes an `AGENTS.md` into every writable vault with the component list and
the authoring rules, and refreshes it when Slidecraft changes. A hand-written `AGENTS.md` is
left alone.

## The agent

Slidecraft is built around a coding agent working beside you. Today that is **Claude Code**: the
`claude` CLI on your `PATH`, signed in (`SLIDECRAFT_CLAUDE_BIN` to point elsewhere). Slidecraft
drives it through the Claude Agent SDK, so your own login and settings apply.

- **On the home page**, the question box starts a conversation about the vault. When the agent
  writes a new deck, its workspace opens and the conversation follows.
- **In the deck workspace** (`/v/<vault>/edit/<deck>`), the conversation sits beside the slide
  rail and a work area showing **Preview**, **Code** or **Split**. The slide on screen and any
  selected code go with each message as chips you can remove. The code is read-only while the
  agent works, and unsaved edits are saved before a message goes out.
- Its text, every tool call and every changed file appear as they happen. Reading and editing
  decks inside the vault goes ahead; a shell command or a file outside the vault shows **Allow /
  Deny** first. **Stop** ends a turn.
- Conversations are kept per deck in `<vault>/.slidecraft/conversations/` and resume after a
  restart.
- **Settings** (`/settings`) shows whether the agent is installed and signed in, and sets the model
  (`"agent": { "model": "opus" }` in the config file).

Without Claude Code everything else works: the workspace is a complete hand editor.

## Agents over MCP

```sh
claude mcp add slidecraft -- bun /path/to/slidecraft/server/mcp.ts --vault work
```

| Tool | Does |
|---|---|
| `get_content_dir` | the vault and its folder |
| `list_presentations`, `read_presentation` | find and read decks, slide by slide |
| `create_presentation` | a new deck with its first slides |
| `insert_slide`, `update_slide`, `delete_slide` | change one slide |
| `list_themes`, `set_presentation_theme` | themes and frames |
| `list_images` | images beside a deck and in the shared library |
| `validate_deck` | compile errors, raw HTML, unknown components or props, titles that probably wrap |
| `screenshot_slide` | one slide as a 960 × 540 image, every step shown (needs the app running and Chrome) |
| `export_html`, `export_pdf` | write an export into `<content>/exports/` |

Every write is compile-checked; a failing write is refused with the line and the error.


Agents also get the **`slidecraft-presentations` skill**: Slidecraft keeps a copy in every writable
vault at `.claude/skills/slidecraft-presentations/`, so `claude` started in a vault folder finds it
on its own. A copy you edit is never overwritten. The repository's own skills are in `skills/`.
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
- [AGENTS.md](AGENTS.md) and [skills/](skills/): instructions for coding agents, as three skills.
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

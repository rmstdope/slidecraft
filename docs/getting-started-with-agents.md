# Getting started with agents

A walkthrough for making a first deck with an AI coding agent. No programming knowledge needed.

## 1. Run Slidecraft

Pick one:

- **The release binary** (easiest). Download `slidecraft` for your system from the releases page.
  Make a folder for your decks, open a terminal in it and run the binary:

  ```sh
  mkdir ~/decks && cd ~/decks
  ~/Downloads/slidecraft-macos-arm64        # the name depends on your system
  ```

  On macOS, if the system refuses to open it, run
  `xattr -d com.apple.quarantine ~/Downloads/slidecraft-macos-arm64` once.

- **A checkout of the repository** (if you also want to change Slidecraft). Install
  [Bun](https://bun.sh), then `bun install` and `bun run dev -- --content ~/decks`.

Open the address it prints (http://localhost:6110 for the binary, http://localhost:6100 for a
checkout). You see the home page, empty for now.

## 2. Check the agent instructions

Slidecraft has written a file called `AGENTS.md` into your decks folder. It tells any coding
agent which slide components exist and the rules for using them. Open it to see; you do not need
to change it. If you want house rules (language, tone, slides every deck must have), write your
own `AGENTS.md` instead: Slidecraft leaves a hand-written one alone.

## 3. Ask for a deck

Whichever agent you use, a good first request is specific about audience, length and content:

> Create a Slidecraft deck called `team-update` in this folder: eight slides for my team about
> what we shipped this month. Open with a title slide, then one slide each for the three
> projects (what it does, one number that shows the result), a timeline of next month, and a
> closing slide with questions. Add speaker notes with a time budget on every slide.

The deck appears on the home page as soon as it is written, and updates live while the agent
works.

## 4. Four ways to drive an agent

1. **The chat panel in Slidecraft.** Click **Create New** on the home page, or **Chat** on a deck.
   Pick a provider: Claude Code or GitHub Copilot CLI if one is installed on this computer, or an
   API key (`AI_API_KEY`) for an OpenAI-compatible service. Type your request; the preview
   follows along.
2. **A command-line agent in a terminal.** Open a terminal in the decks folder and start the
   agent (for example `claude` or `copilot`). It reads `AGENTS.md` and edits the files directly.
3. **The chat in your code editor.** Open the decks folder in VS Code, Cursor or another editor
   with an AI chat, and ask there. Keep the Slidecraft page open beside it to watch.
4. **A desktop agent app with MCP.** Connect Slidecraft's MCP server so the agent gets tools to
   list, read, create and edit decks, and to export them. For Claude Code:

   ```sh
   claude mcp add slidecraft -- bun /path/to/slidecraft/server/mcp.ts --content ~/decks
   ```

## 5. Before you present

- Click through the deck (arrow keys). Press `M` for an overview of all slides.
- Press `D` for dev mode: it marks text that overflows and titles that wrap.
- Ask the agent for changes one slide at a time: "make the title on slide 4 shorter",
  "the numbers on slide 3 are from September, not October".
- Press `P` to open the presenter window with your notes and a timer.
- Export from the deck's card: HTML (one file that works offline) or PDF.

## Troubleshooting

| Problem | Fix |
|---|---|
| The deck does not appear | It must be `<folder>/<name>/index.mdx`; check the folder the server prints on start. |
| A red error instead of slides | The file does not compile. Ask the agent to fix the line named in the error, or press **Edit** to fix it yourself. |
| The agent writes `<div>` or `<br>` | Remind it to read `AGENTS.md`: decks use components only. |
| Changes do not show up | Reload the page. On some Macs file changes are missed; restart with `SLIDECRAFT_WATCH_POLLING=1`. |
| The chat says the provider is unavailable | Install the CLI (`claude`, `copilot`) or set `AI_API_KEY`, then restart Slidecraft. |
| PDF export fails | Install Google Chrome or Chromium, or set `CHROME_PATH`. |
| macOS says the binary cannot be opened | Clear the quarantine flag (step 1). |

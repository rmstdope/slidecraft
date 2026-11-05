# Slidecraft UX overhaul plan

The overhaul makes Slidecraft **AI first**: a coding agent (Claude Code, later GitHub Copilot CLI)
runs inside the web app and does most of the work on decks, while the hand editor stays one toggle
away. Presentations are grouped into **vaults** (for example *Work* and *Private*) that are kept
apart, and agent guidance becomes three **skills**.

This plan overrides `implementation-plan.md` where they disagree: the AI chat (Phase 10 there), the
dropped skills directory, and the "all content sources at once" model. Everything else there still
holds.

Date of decisions: 2026-11-05 (agreed in a grilling session with the user).

---

## 1. Decisions

### Product

| Topic | Decision |
|---|---|
| Audience | Local only, one user, one machine. The server spawns the agent CLIs with the user's own login. Release binaries included. No hosted or multi-user mode. |
| AI first | Opening a deck lands in the **deck workspace**: agent chat plus live preview. The Monaco editor is a mode of the same page, not a separate route. |
| Hand editing | Stays fully supported. Without any agent CLI installed the app is a complete manual editor and the chat shows a setup card. |
| Old routes | `/chat/*` and `/edit/*` redirect to the deck workspace. The home page's "all sources" filter goes. |
| Unchanged | Gallery, presenter window, drawing and export keep working as they are, scoped to the active vault. |

### Vaults

| Topic | Decision |
|---|---|
| Definition | A vault is a **named content folder** registered in `~/.config/slidecraft/config.json`. It holds everything a content folder holds today: decks, `themes/`, images, `exports/`, its own `AGENTS.md` (house style) and `.slidecraft/`. Only the built-in themes and components are shared between vaults. |
| Isolation | One vault is shown at a time. This replaces mounting every source at once. |
| Addressing | The vault is in the URL: `/v/<vault>/…`. Two tabs can show different vaults. The last vault used is the default for `/`. |
| Read-only | A vault property (`readOnly`). The repository's example decks become a read-only **Examples** vault. |
| Management | A settings page to create (pick or create a folder), rename and remove vaults. Removing never deletes files. On first run with no vault, the user is asked to create one. |
| Migration | Existing `contents` entries and `default` in `config.json` become vaults automatically. `--content` / `SLIDECRAFT_CONTENT_DIR` given a path that is not a vault open a temporary unnamed vault. |
| MCP | `bun run mcp --vault <name>` limits the MCP server to one vault (a `--content` path that is a vault resolves to it). `list_presentations` lists only that vault. |

### Agent

| Topic | Decision |
|---|---|
| Embedding | **Structured streaming**, not a terminal: Claude Code with `--output-format stream-json` (or the Agent SDK), Copilot with its JSON-lines output. Slidecraft renders its own chat UI. |
| Backends | One `AgentBackend` interface. **Claude Code first**, **Copilot CLI** later in the overhaul. Backends normalise their output into one event type. |
| Protocol | Server to browser: SSE events per conversation (text, tool call, tool result, file changed, approval request, turn done, error). Browser to server: POST to send a message, stop, and approve or deny. |
| Permissions | Edits inside the vault are allowed through the CLI's allow-lists (Claude `--allowedTools` / `--add-dir`), not by skipping all permissions. Shell commands raise an approval request in the UI. |
| Tools | Every session gets the Slidecraft MCP server for its vault: `validate_deck` (compile errors, unknown components, wrapping titles), `screenshot_slide` (new), `list_themes`, `list_images`, export. The agent edits MDX files directly. The slide-editing MCP tools stay for outside agents. |
| Conversations | Threads **per deck** and **per vault** (home page), stored with the CLI session id in `<vault>/.slidecraft/conversations/` and resumable after restart. A thread list and "New conversation". |
| Context | Each message automatically carries the current slide, the Monaco selection and any selected slides, shown as removable chips. Drag-and-drop attachments; images are copied into the deck's `images/`. |
| Concurrency | While the agent works, the editor is read-only. Unsaved edits are saved before a message is sent. A visible "agent is editing" state and a Stop button. |
| Undo | **Per-turn checkpoints** in `.slidecraft/checkpoints/` (the deck folder, or the vault for vault-level threads), independent of git, keeping the last N per thread. Each turn shows a diff and "Undo this turn". |
| Setup | Settings detects whether `claude` and `copilot` are installed and logged in, with instructions if not. A global default backend, overridable per thread, with an optional model choice. |
| HTTP provider | **Removed**, together with the server-side tool loop and the repair editor (only that provider used them). |

### Skills

| Topic | Decision |
|---|---|
| Format | The open Agent Skills format: `SKILL.md` plus reference files. The repository is the single source. They **replace** `docs/agents/*.md`. |
| `slidecraft-presentations` | Used inside the app (and by `claude` run in a vault). `SKILL.md` covers the workflow and rules (layouts, colour and motion semantics, validate and screenshot after each edit, house style from the vault's `AGENTS.md`). It loads reference files when needed: `components.md` (**generated from the registry at build time**), `themes.md`, `motion.md`, `examples.md`. |
| `slidecraft-components` | Terminal in the repo only: `defineComponent`, the registry fields, accents and theme variables, the motion rules, tests, gallery check, example decks. |
| `slidecraft-dev` | Terminal in the repo only: architecture, routes, server, parser and language service, dev-server etiquette, the build and test loop, the plans. |
| Why not components in the app | Components are compiled into the app and the release binary, so a component made in the app would not appear until a rebuild. Vault-local components are out of scope. |
| Delivery to vaults | The server writes `slidecraft-presentations` into each writable vault's `.claude/skills/` on start. The skill is embedded in the binary and marked as generated with a version header, and a hand-edited copy is never overwritten. This is the same mechanism as the generated `AGENTS.md` today. |
| AGENTS.md | The root `AGENTS.md` becomes a short router to the three skills, for agents that do not load skills. A vault's generated `AGENTS.md` shrinks to "use the skill" plus house style. |
| Prompts | `server/lib/agentContext.ts` shrinks to the per-message context (deck, slide, selection). The rules live in the skill. |

### Open item to verify

- That Copilot CLI reads skills from `.claude/skills/`. Check it in Phase 6, before relying on it.
  If it does not, also write the skill where Copilot looks.

---

## 2. Conventions

- Each phase adds finished-looking slides to the `welcome` deck for what it delivered (see
  `implementation-plan.md` §2.5).
- `bun run build` and `bun test` pass at the end of every phase. Agent backends are tested with
  fake CLI binaries (`SLIDECRAFT_CLAUDE_BIN`, `SLIDECRAFT_COPILOT_BIN`) that replay recorded
  streams. Each phase is also checked in the browser.
- The persona and agent docs are updated in the phase that changes what they describe, not at the
  end.

---

## 3. Phases

### Phase U1 — Vaults

- `config.json`: `vaults: [{ id, name, path, readOnly? }]` and `lastVault`. Migrate `contents` and
  `default` on read and write the file back once. Keep `copilot` and other blocks.
- Server: replace the many-sources model with a vault registry. Every route and tool takes a vault
  id. A deck ref becomes `{ vault, path }`. One watcher per open vault, SSE events tagged with the
  vault.
- The repository's `content/` becomes the read-only **Examples** vault (in a checkout, and the
  bundled decks in the binary).
- Routes `/v/<vault>/`, `/v/<vault>/<deck>`, and redirects from the old URLs. `/` opens the last
  vault, or onboarding when there is none.
- Header vault switcher; settings page (create, rename, remove, mark read-only).
- `--content` / `SLIDECRAFT_CONTENT_DIR` open a temporary vault; `bun run mcp --vault <name>`.
- `AGENTS.md` sync per writable vault.

**Done when:** two vaults with decks of the same name live side by side; switching shows only the
active vault's decks, themes and images; links with the vault in them work in two tabs at once; an
existing `contents` config migrates without losing anything; the MCP server limited to one vault
sees only it.

**Status (2026-11-05): done.** `server/lib/contentSources.ts` holds the vault registry
(`migrateConfig`, `addVault`/`updateVault`/`removeVault`/`rememberVault`); `/api/vaults` replaces
`/api/contents`; `src/router.ts` has the `/v/<vault>/…` routes and turns older URLs into them;
`src/settings/SettingsPage.tsx` and `src/home/VaultSwitcher.tsx` are new. Checked in the browser
with a scratch config: migration with `.bak`, switching between two vaults with a deck of the
same name, an old `?source=` link redirecting, adding a vault from the settings page, the editor
on a vault URL, and `mcp.ts --vault Private` listing only that vault. Deviations:

- The deck ref keeps its field name `source` (it holds the vault id); renaming it in about 60
  files would have changed nothing for the user.
- The Examples vault is writable in a checkout, because that is where the example decks are
  developed. In the release binary there is no Examples vault; the working directory opens as a
  temporary vault when no vault exists.
- There is no forced first-run flow. When the user has no vault of their own, the home page shows
  a notice that leads to the settings page ("Create a vault", or "Save as a vault" for a temporary
  one).
- `/content/` now always serves the Examples vault (as Vite bundles it); other vaults' assets go
  through `/content-source/<vault>/`.
- Known gap: the shared image library (`/images/library/`) is not per vault yet. It is
  `public/images/library` in a checkout and the default vault's `.slidecraft/library` in the binary.

### Phase U2 — Agent backend

- `AgentBackend` interface with the normalised event type in `shared/agent.ts`.
- Claude Code backend: streaming, resumable sessions, an allow-list instead of
  `--dangerously-skip-permissions`, the vault's MCP server attached, and approval requests for
  shell commands.
- Conversation store in `<vault>/.slidecraft/conversations/` (thread metadata, messages, CLI
  session id).
- Routes: create or list threads, send, stop, approve or deny, and SSE per thread.
- Fake CLI for tests; recorded streams in `tests/fixtures/agent/`.

**Done when:** a thread started in the app streams text and tool calls live, survives a server
restart, can be stopped mid-turn, and a shell command waits for approval in the UI.

**Status (2026-11-05): done.** `shared/agent.ts` is the contract; `server/lib/agent/` holds the
`AgentBackend` seam, the Claude Code backend and the thread store and runner;
`server/routes/agent.ts` is the API; `src/agent/` is the chat panel (for now on the chat page when
Claude Code is the provider; Phase U3 moves it into the deck workspace). Checked in the browser
against Claude Code 2.1.318: text and tool calls stream, the preview follows the edit, a shell
command waits for Allow, Stop ends a turn waiting for approval (denying it), and after a server
restart the thread reloads and the next turn still remembers the earlier ones. Deviations:

- **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk` 0.3.310, pinned) instead of parsing
  `--output-format stream-json` by hand. Approvals travel over the CLI's control protocol, which
  the SDK implements (`canUseTool`). It runs the user's `claude` (`pathToClaudeCodeExecutable`), so
  their login and settings apply.
- **Permissions:** `permissionMode: 'acceptEdits'`, and only `TodoWrite` and the Slidecraft MCP
  server are approved up front. File tools are deliberately not listed in `allowedTools`: a bare
  name approves the tool everywhere, outside the vault too. Claude Code's `acceptEdits` also lets
  shell commands through without asking when they only write files inside the working directory
  (`echo … > deck/note.txt`). Their effect stays in the vault, so this was accepted. Any other command
  asks.
- **Tests** use a recorded real run (`tests/fixtures/agent/claude-edit-and-shell.jsonl`, paths
  scrubbed) for the message mapping and a scripted backend for threads, not a fake CLI binary:
  a fake would have to speak the SDK's control protocol.
- One SSE stream for everything (`agent-event`, `agent-thread` on `/api/events`) rather than a
  stream per thread; a reconnect reloads the open thread.
- The release binary runs its own MCP server with `--mcp`, so the agent gets Slidecraft's tools
  without the repository.
- Turn latency includes the user's own Claude Code hooks: with a wrapper that adds Stop hooks, a
  turn can stay "working" for a while after the last text.

### Phase U3 — Deck workspace

- One page per deck: the chat panel (collapsible) and a right pane switching between Preview, Code
  and Split. The slide strip and overview stay under the preview. Present, export and theme are in
  the header.
- Context chips (current slide, selection, selected slides); the editor is locked while the agent
  works.
- Home page: vault chat input at the top, recent threads, deck grid; "New deck" kept.
- Agent settings: CLI detection and login status, default backend, model; setup card without a CLI.
- Remove the old chat page and the separate editor route (redirects remain).

**Done when:** an author can create a deck from the home page, refine it in chat, switch to Code
and type, switch back and keep talking, all without leaving the page or losing the cursor.

**Status (2026-11-05): done.** The workspace is the editor page grown (`src/editor/EditorPage.tsx`)
at `/v/<vault>/edit/<deck>`; the conversation is `src/agent/AgentChat.tsx`, also on the home page;
`src/chat/` is gone. Checked in the browser with Claude Code: a deck asked for on the home page
opened in its workspace with the conversation carried over; changes asked in the workspace showed in
the code and the preview; typing during a turn was refused ("Cannot edit in read-only editor"); the
Preview/Code/Split switch, the slide chip, collapsing the panel, **New deck** by hand and the
Agent section of the settings page all worked. Fixed on the way: an external reload marked the deck
unsaved (Monaco reports a value set from outside as a change), which would have stopped later
agent edits from showing; agent replies now render their Markdown. Deviations:

- The slide rail stays a vertical column between the conversation and the work area, as in the
  editor, rather than a strip under the preview; the overview (`M`) is the player's.
- A vault conversation becomes a deck's conversation on the server when it writes a new
  `<name>/index.mdx`, so it is still there when the deck's workspace opens.
- The settings page checks `claude auth status` and reads only `loggedIn` from it. The default
  backend can be chosen, but there is only one until Phase U6, so there is no per-conversation
  override yet.
- Until Phase U6 the AI API and Copilot have no UI: the old chat page is removed and
  `/api/chat` remains only for its tests.
- Switching to Preview unmounts the code editor, so its cursor is not kept across that switch;
  Code ↔ Split keeps it.

### Phase U4 — Skills

- `skills/slidecraft-presentations/`, `skills/slidecraft-components/` and `skills/slidecraft-dev/`
  written from the persona guides, which are then removed. `.claude/skills/` in the repo links to
  them for terminal use.
- Build step that generates `components.md` (and the catalogue sections of the other skills) from
  the registry. A test checks that the generated file is current.
- The presentation skill is embedded in the binary and synced into vaults; it is never overwritten
  when hand-edited.
- MCP: `validate_deck` and `screenshot_slide`.
- The root `AGENTS.md` becomes a router; `agentContext.ts` is cut down to the per-message context.

**Done when:** an agent in the app validates and screenshots its own work without being told, and
`claude` run in a vault folder from a terminal uses the same skill.

**Status (2026-11-05): done.** The skills are `skills/slidecraft-presentations/` (SKILL.md plus
`references/`: a generated `components.md`, `choosing.md`, `themes-and-colour.md`, `motion.md`,
`examples.md`), `skills/slidecraft-components/` and `skills/slidecraft-dev/`; `.claude/skills/`
holds symlinks to them, and `docs/agents/` and `docs/agent-personas.md` are gone. `bun run skills`
(also run by `bun run build`) writes the catalogue; `tests/skills.test.ts` fails when it is stale.
`server/lib/skillSync.ts` copies the presentations skill into every writable vault;
`server/lib/deckChecks.ts` is `validate_deck`; `screenshotSlide` in `server/lib/exportPdf.ts` is
`screenshot_slide`. Checked in the browser with Claude Code: asked only to "rewrite this slide's
title as a stronger assertion", the agent loaded the skill, edited, ran `validate_deck`, took a
screenshot, saw the title wrap, shortened it, validated and looked again, and said so. `claude -p`
started in a vault folder from a terminal lists `slidecraft-presentations` among its skills.
Deviations:

- **The marker is a file**, `.slidecraft-generated.json` beside `SKILL.md`, holding a hash of every
  file written: a skill's `SKILL.md` must start with its frontmatter, so the version header the
  plan describes cannot go in it. Any file that differs from its hash, an extra or a missing
  file, or a folder without the marker counts as a person's edit, and the copy is kept as it is.
- **The Examples vault gets no copy:** it is inside the repository, whose own `.claude/skills/`
  already holds the skill.
- **`validate_deck` warns on titles by length** (over 46 characters in a document slide), a
  heuristic; the screenshot is the real check. Errors: compile failures, raw HTML, unknown
  components, invalid prop values. Unknown props are warnings.
- **`screenshot_slide` renders through the running app** (the print view of one slide in headless
  Chrome). The in-app agent passes the page's origin to the MCP server (`SLIDECRAFT_APP_ORIGIN`);
  from a terminal it uses the server's own port. It takes the slide index as the other tools
  count it (0-based, in the file) and refuses hidden slides.
- **The HTTP chat prompt** builds its guide from the skill's files until Phase U6 removes it.


### Phase U5 — Checkpoints and attachments

- A checkpoint before each turn, a diff per turn in the chat, and "Undo this turn" (refused when
  the files have changed since, with the diff shown).
- Drag-and-drop of images, PDFs and text into the chat. Images go into the deck's `images/`; other
  files are passed to the agent.

**Done when:** a bad agent turn can be seen as a diff and undone in one click, and a dropped image
ends up on a slide.

**Status (2026-11-05): done.** `server/lib/agent/checkpoints.ts` (hash-addressed blobs and turn
records in `.slidecraft/checkpoints/`), `shared/lineDiff.ts` (the line diff and hunks),
`server/lib/agent/attachments.ts`; the panel shows the changes, the diff and the undo
(`src/agent/AgentChat.tsx`). Checked in the browser with Claude Code: a notes file attached with
the paper clip was read by the agent and used for an agenda slide; the turn's changes row showed
the diff and **Undo this turn** put the slide back. A refused undo, the note to the agent and the
image upload into a deck's `images/` are covered by `tests/agent.test.ts`. Deviations:

- Checkpoints store every file of the scope once by content hash before and after a turn,
  instead of "the files the turn might touch": nobody knows those in advance, and the hashes make
  the copies cheap (an unchanged image is stored once for all turns). A turn that changes nothing
  keeps no checkpoint. Files over 25 MB, and `.slidecraft`, `.claude`, `.git`, `node_modules` and
  `exports/`, are left out.
- After an undo the agent's own session still remembers its edit, so the next message carries a
  note ("The person undid your changes from turn N…").
- An image dropped into a vault-level conversation (no deck yet) goes to
  `.slidecraft/attachments/` like any other file; the agent moves it into the deck it makes.
- The workspace's own paste-an-image-into-the-code still works; a paste inside the conversation
  panel attaches instead.

### Phase U6 — Copilot, HTTP removal, docs

- Copilot CLI backend behind `AgentBackend`; verify where it reads skills (see §1).
- Remove the HTTP provider, the tool loop and the repair editor; update `shared/chat.ts` callers.
- Update README, `docs/guide.md`, `docs/getting-started-with-agents.md`,
  `docs/creating-presentations.md`, `docs/agent-personas.md` and the roadmap.

**Done when:** both backends pass the same recorded-stream test suite and a real create-and-edit
run, and no code or doc mentions the HTTP provider.

**Status (2026-11-05): done.** `server/lib/agent/copilot.ts` runs `copilot -p --output-format json
--stream on` and maps its JSON lines (`assistant.message_delta`, `tool.execution_start` /
`_complete` with `fileEdits`, `result`) onto the same events; `tests/copilot.test.ts` replays a
recorded run (`tests/fixtures/agent/copilot-edit-and-shell.jsonl`). The HTTP provider, the old CLI
runners, `/api/chat`, `/api/apply-fix` and `shared/chat.ts` are gone; the prompt builder moved to
`server/lib/agent/prompt.ts`. Checked in the browser with Copilot CLI 1.0.105: a Copilot
conversation chosen in the panel loaded the skill, read the vault's `AGENTS.md`, edited the slide
(the preview followed), and offered Diff and Undo. Deviations and findings:

- **Copilot reads `.claude/skills/`** (its `skill list` names it as a project location, and a
  prompt-mode session in a vault reports the skill as available), so the skill needs no second
  copy.
- **Copilot cannot ask.** Prompt mode has no permission channel: it gets `--allow-tool write` and
  `--allow-tool slidecraft`, and Copilot refuses anything else itself ("Permission denied because
  no interactive user response was available"). The conversation shows such a tool as refused, the
  panel says "cannot ask: edits in the vault only", and `AgentBackendInfo.approvals` carries the
  difference.
- **Copilot may run without the Slidecraft tools:** on the account used for testing, the
  organisation's Copilot policy (`allowedMcpServers`) does not allow a local MCP server, so
  `validate_deck` and `screenshot_slide` were missing. Hence a new, backend-neutral **check after
  every turn**: Slidecraft runs the deck check on every deck a turn changed, shows any problem in
  the conversation (`deck-check` event) and passes errors to the agent with the next message. The
  skill tells an agent without the tools to rely on it.
- `--trust-folder` cannot be combined with `--session-id`, and is not needed: the vault's skill
  loads without it.
- The per-conversation choice of backend is a selector in the panel when starting a conversation
  (shown when more than one agent is ready); Settings sets the default.

## 4. Risks

- **CLI output formats change.** The CLIs' streaming formats are not stable APIs. Keep all parsing
  in the backend adapters, pin the versions they were checked against, and keep the recorded
  streams as regression tests.
- **Permission flags differ per CLI.** Copilot may not offer the same allow-list as Claude. The
  `AgentBackend` exposes its abilities, and the UI shows what it cannot enforce.
- **Migrating existing configs.** Write a backup of `config.json` before the first rewrite.

## 5. Outcome

All six phases are done. The deck workspace, the vault conversation on the home page, two agent
backends behind one interface, three skills, per-turn checkpoints and attachments replace the chat
page and the persona guides; vaults replace mounting every content folder at once. What is left is
listed in `docs/ROADMAP.md`.

---

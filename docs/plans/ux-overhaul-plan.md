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

### Phase U5 — Checkpoints and attachments

- A checkpoint before each turn, a diff per turn in the chat, and "Undo this turn" (refused when
  the files have changed since, with the diff shown).
- Drag-and-drop of images, PDFs and text into the chat. Images go into the deck's `images/`; other
  files are passed to the agent.

**Done when:** a bad agent turn can be seen as a diff and undone in one click, and a dropped image
ends up on a slide.

### Phase U6 — Copilot, HTTP removal, docs

- Copilot CLI backend behind `AgentBackend`; verify where it reads skills (see §1).
- Remove the HTTP provider, the tool loop and the repair editor; update `shared/chat.ts` callers.
- Update README, `docs/guide.md`, `docs/getting-started-with-agents.md`,
  `docs/creating-presentations.md`, `docs/agent-personas.md` and the roadmap.

**Done when:** both backends pass the same recorded-stream test suite and a real create-and-edit
run, and no code or doc mentions the HTTP provider.

---

## 4. Risks

- **CLI output formats change.** The CLIs' streaming formats are not stable APIs. Keep all parsing
  in the backend adapters, pin the versions they were checked against, and keep the recorded
  streams as regression tests.
- **Permission flags differ per CLI.** Copilot may not offer the same allow-list as Claude. The
  `AgentBackend` exposes its abilities, and the UI shows what it cannot enforce.
- **Migrating existing configs.** Write a backup of `config.json` before the first rewrite.

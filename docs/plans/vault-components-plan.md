# Slidecraft vault components plan

A vault can carry its own **components** and **templates**. They add to the built-in ones while
that vault is active, and one with a built-in's name replaces it for that vault. The Component
Gallery becomes the place to create and change them with the agent, which works under the
`slidecraft-components` skill and writes only inside the vault.

This plan adds to `ux-overhaul-plan.md` (vaults, agent, skills) and `ui-redesign-plan.md` (the
gallery's look). It does not change how built-in components are written: they stay in
`src/components/slides/`, developed under the `slidecraft-components` skill as today.

Mockups: <https://claude.ai/artifact/Ju35dTa9PXoKLkqChJybBf> (five boards).

Date: 2026-11-06.

---

## 1. Decisions

### Taken with the user (2026-11-06)

| Topic | Decision |
|---|---|
| Where | A vault may have `components/` and `templates/`. They add to the built-ins while the vault is active. |
| Override | A vault component or template with a built-in's name replaces the built-in, for that vault only. |
| Editable | Only vault components and templates can be created or edited in the app. Built-ins are read-only there. |
| Editing a built-in | Copies it into the vault first; the copy then overrides it and is what the agent edits. |
| Templates | Per vault too, same rules. |
| Layout | One folder per component (`components/<Name>/`) and per template (`templates/<id>/`). |
| Rejected | The agent writing into `src/components/slides/`: no `src/` in a release binary, and the agent's working folder is the vault. |

### Proposed in this plan, confirmed by the user (2026-11-06)

| Topic | Proposal |
|---|---|
| Component folder | `components/<Name>/index.tsx` is the entry; it calls `defineComponent` for `<Name>` and for any parts. Other `.ts`/`.tsx` files in the folder may be imported relatively. An optional `README.md` is for people and agents; the app does not read it. No asset imports in the first version. |
| Template folder | `templates/<id>/index.mdx`: frontmatter `name`, `description`, `keywords`, `useCases`, optional `theme` (frame templates preview in it); the body is one `<Slide>…</Slide>`, used as both `snippet` and `previewCode`. |
| Imports | Vault code may import only `slidecraft`, `react`, `react/jsx-runtime`, `motion/react`, and files in its own folder. Anything else is a compile error. |
| The `slidecraft` module | A public module (`src/vault-api/index.ts`): `defineComponent` and its types, accents (`accentColors`, `tint`, `useAccent`, `SLIDE_ACCENTS`, `AccentColor`), the shared variants and springs, `useStepMotion`, `useInThumbnail`, the slide-layout hook, `glow`, the style helpers, and **every built-in component** (so a vault component can compose `Text` or `Card`). It carries an `API_VERSION`; anything added is kept working. |
| Loading in the browser | The server bundles each component folder with `Bun.build`, the four allowed packages external. An import map in `index.html` (and in the export viewer) points those names at tiny modules that re-export from `globalThis.__slidecraftModules`, filled by the app at start. Bundles are served at `/content-source/<vault>/components/<Name>/index.js?h=<hash>`. |
| Loading on the server | The MCP tools, `validate_deck`, the deck checks and the agent context read the registry on the server, so the server imports the same bundles too, with a Bun runtime plugin supplying `slidecraft` and the packages as virtual modules. |
| Registry layers | Each entry gets a `source` (`builtin` or a vault id). The getters return the merged view for the active vault: built-ins, then the vault's, a vault entry hiding a built-in of the same name. A version number and `subscribe`, as `src/themes/registry.ts` already has, let views re-render. |
| Overrides and parts | Overriding is by name. Copying a built-in copies its whole file, so its parts (`TimelineItem`) are copied and override together. The override must keep the name exactly, because `displayName` drives step counting, notes and header splitting. |
| Trust | Vault components are code running with the app's rights. A vault's config entry gets `components: "trusted" \| "blocked"`; with neither, the app asks on first open (board 5). Vaults created in the app and the Examples vault start trusted. Untrusted: no bundles are served or imported; slides that use one show a placeholder; built-ins stay; templates load anyway (they are only text). |
| Errors | A component that fails to compile or throws at registration is left out, so the built-in of that name (if any) stays in use. Its gallery card shows the error with **Fix with agent** and **Reset to built-in**. Rendering errors stay inside the slide's existing error boundary. |
| Read-only vaults | Their components load and show; New, Edit, Copy and Reset are hidden. |
| Copying a built-in | The binary embeds the source of every **copyable** built-in. A build step works out which are copyable: every import resolves to the `slidecraft` module or the allowed packages. The copy rewrites the imports to `slidecraft`. A built-in that is not copyable says why (board 3). |
| Compare and reset | A copied component records which built-in and which app version it came from (`components/<Name>/.slidecraft-origin.json`). The gallery offers **Built-in / Vault copy** in the preview and **Reset to built-in**, which deletes the folder. |
| Agent | A conversation can target a component or a template (`thread.info.target`). Its checkpoint scope is that folder, the agent's working folder stays the vault, and the prompt names the skill and the folder. |
| Skill | `slidecraft-components` gets a vault part: where vault components live, the `slidecraft` import rule, and validation with `validate_component` in place of `bun test`. Skill sync starts copying it into vaults beside `slidecraft-presentations`. |
| Checks | A new MCP tool `validate_component` and a per-turn check on changed `components/` and `templates/` files (as `checkChangedDecks` does for decks). Each checks that the code compiles, the imports are allowed, every `defineComponent` name is the folder name or a part with `parent` set to it, the registry fields are complete, and `snippet` and `previewCode` compile in the scope. Errors also go to the agent with the next message, so Copilot (no local MCP under the user's policy) gets them too. |
| Catalogue | The vault's copy of the presentations skill gets a generated `references/vault-components.md` listing the vault's components and templates. It is regenerated when they change, and recorded in the skill marker so it counts as generated. |
| Export | The HTML export inlines the bundles of the vault components the deck uses and an import map with `data:` URLs; the viewer registers them before it renders. |

### Open items, checked in Phase V1

- **Verified:** `Bun.build` (with the four packages external) and `Bun.plugin` virtual modules
  (`build.module`) work inside a `bun build --compile` binary, and so does re-importing a module
  under a new `?h=` URL. Bundles must be built with production JSX (`jsx.development: false` and
  `NODE_ENV` defined as `production`), or they import `react/jsx-dev-runtime`.
- **Verified:** the inline import map in `index.html` leaves Vite's dev server alone (Vite rewrites
  the app's own bare imports before the browser sees them), and a module with bare imports gets
  the app's own React, JSX runtime, motion and `slidecraft` instances in the browser. The release
  binary serves the shims too.
- **Found:** a shim must not hold the module in a variable an export can be named (`motion/react`
  exports `m`).
- **Still open (Phase V2):** watching `components/` and `templates/` needs the polling watcher on
  macOS (directory watchers miss file edits here). Old module instances are never freed, which
  should be fine for one person's session.

---

## 2. Conventions

- As in the UX overhaul: `bun run build` and `bun test` pass at the end of every phase, each phase
  is checked in the browser, and docs and skills change in the phase that changes what they
  describe.
- The Examples vault (`content/`) gets an example vault component and template in Phase V2, and
  the `welcome` deck gets finished slides showing what each phase delivered.
- Vault code is never run outside the trust rule: the server checks trust on every route and in
  every tool that loads a bundle.

---

## 3. Phases

### Phase V1: Registry layers and the `slidecraft` module

No vault loading yet; the built-ins move onto the new structure, and nothing visible changes.

- `defineComponent.ts`: entries get a `source`, and the module gets `setActiveVault`,
  `registerSource(source, defs, templates)`, `clearSource`, `getRegistryVersion`, `subscribe`. The
  getters return the merged view.
- `mdxComponentScope` becomes `getMdxScope()`. `App.tsx`, `exportViewer.tsx`, `deckLoader.tsx`,
  `compileSlide.tsx` and `usePresentation.ts` read it when they render or compile, not at module
  load. A `useRegistryVersion()` hook re-renders the gallery, palette, help panel, toolbar and the
  editor's language service.
- `src/vault-api/index.ts` (the `slidecraft` module), `globalThis.__slidecraftModules`, the import
  map and the re-export shims, generated from the module's export list.
- Settle the open items above with a throwaway component folder.
- Tests: the merged view and its overrides, scope reads after a registration, and the
  `slidecraft` module's export list against a snapshot (an export removed is a failing test).

**Done when** the app behaves as before and a test can register a fake source that overrides
`Stat`.

**Status:** done (2026-11-06). Exports of the `slidecraft` module are recorded in
`tests/fixtures/vault-api-exports.json`; the shims are served at `/vault-runtime/<file>.js`. After
the built-ins register, `defineComponent` works only while a vault component loads (or for a
built-in reloading in the dev server), and it refuses to rename a component that already has a
name.

### Phase V2: Loading vault components

- `server/lib/vaultComponents.ts`: discover `components/<Name>/`, bundle with a hash cache (in
  `.slidecraft/cache/components/`), and collect errors. Serve the bundle and a listing
  (`GET /api/vaults/<vault>/components`).
- Watch the folders; send a `components-changed` event over the existing events channel; the
  client re-imports the changed bundles and re-registers them.
- Server-side registration with the Bun plugin, so `validate_deck`, `checkChangedDecks`, the MCP
  tools and the agent context see the vault's components.
- Trust: the `components` field in `config.json`, the first-open prompt (board 5), a toggle on
  `/settings` per vault, and placeholders for blocked components.
- Gallery: source badges (Built-in, vault name, "overrides built-in"), the source filter, error
  cards (board 1, board 5).
- An example component in `content/components/` used by a `welcome` slide.

- From the PR #9 review, places that go stale when a vault registers after they rendered:
  - The gallery's open detail panel holds the old `RegistryConfig`; it must look its entry up
    again by name on each registry version.
  - Home thumbnails that failed before the vault's bundles loaded stay failed; retry on a
    registry version change.
  - A deck compiled before its vault's components registered fails its `@components` import
    check. Wait for the vault's components before compiling its decks, and give a component
    that is still missing a placeholder for that slide only.
  - Bundled Examples decks (Vite) bind component imports directly, so overrides do not reach
    them. The Examples vault is read-only, so this only matters for its example component:
    load its decks through the runtime compiler when the vault has components.
  - Editor diagnostics refresh on the next edit only; refresh them on a registry change.

**Done when** a hand-written component in a vault works in that vault's decks, editor completions,
palette, help panel and gallery, updates on save, does not show in another vault, and an untrusted
vault loads none.

### Phase V3: Vault templates

- Discover `templates/<id>/index.mdx`, parse the frontmatter, and register them in the vault's
  source. Templates are text, so they are not trust-gated.
- Gallery, palette and **Add slide** list them with their source; the same override rule applies.
- An example template in `content/templates/`.

- Template ids must be unique in the merged view (the gallery and palette key by id): an id
  that clashes with an entry of another name is an error in that template's check.

**Done when** a vault template appears in Add slide and in the gallery, and one with a built-in's
name replaces it.

### Phase V4: The agent creates and edits vault components

- Skill: a vault part in `slidecraft-components` (layout, imports, registry fields, validation),
  a `references/slidecraft-api.md` generated from the `slidecraft` module, and sync into vaults.
- `validate_component` (MCP), per-turn checks on `components/` and `templates/`, and the errors
  passed on to the agent.
- Threads: `target` (`{ kind: 'component' | 'template', name }`), the checkpoint scope set to its
  folder, and a prompt that names the skill and the folder.
- Gallery: the **New** menu (component, template), **Edit with agent** on vault entries, the
  new-component view with conversation and live preview (board 2), and the agent docked in the
  detail sheet (board 4).
- `references/vault-components.md` regenerated into the vault's copy of the presentations skill.

**Done when** asking the agent in the gallery for a new component produces a working one in
`components/<Name>/` with a live preview, validation passes, and Undo this turn removes it.

### Phase V5: Copying, comparing and resetting built-ins

- Build step: the copyable built-ins and their sources, embedded in the binary.
- `POST /api/vaults/<vault>/components/copy { name }`: write the folder with rewritten imports
  and `.slidecraft-origin.json`. Refuse a non-copyable built-in with the reason.
- Gallery: **Edit with agent** on a built-in opens the copy dialog (board 3), then the agent on
  the copy (board 4). **Built-in / Vault copy** preview toggle, **Reset to built-in**, and a note
  when the app's built-in has changed since the copy was made.

**Done when** copying `Timeline` gives a vault copy that renders the same as the built-in until
edited, every built-in marked copyable copies and compiles (a test runs them all), and reset
restores the built-in.

### Phase V6: Export, MCP, docs

- HTML export: inline the used bundles and the import map; the viewer registers them first. PDF
  goes through the app, so it needs only a test.
- `bun run mcp --vault <name>`: vault components in deck validation and `validate_component`,
  under the trust rule.
- Docs: `docs/component-registry.md` (sources and overrides), `docs/guide.md` (vault components,
  trust, copy and reset), `docs/creating-presentations.md`, `README.md`, `AGENTS.md` (the vault
  layout), and the skills.

**Done when** an exported deck that uses a vault component and an overridden built-in plays
offline as in the app, and the docs describe it.

---

## 4. Risks

- **The `slidecraft` module becomes an API.** Every export is a promise to vault code. Start with
  what the copyable built-ins need, add on request, and never remove; the snapshot test guards it.
- **Copies go stale.** A copied built-in misses the app's fixes. The origin record and the
  "built-in has changed" note keep it visible; reset is one click.
- **Running vault code.** The trust prompt is the only guard, and it cannot sandbox. Keep the
  wording plain and the default for vaults from elsewhere "ask".
- **Registry reads at load time.** Anything that captured the registry once (a constant scope, a
  language service built at start) shows stale components. Phase V1 moves every consumer to lazy
  reads; a test registers a source after start and checks each consumer.
- **Compiled binaries.** Bundling and virtual modules inside `--compile` are the least certain
  part; Phase V1 checks them first, and the fallback is per-file transpiling.

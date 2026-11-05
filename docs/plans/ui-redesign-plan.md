# Slidecraft UI redesign plan

A new look for the app around the slides: the home page, settings, the deck workspace, the
gallery and the presenter window. Slides are not part of it; they keep rendering in their deck's
own theme. The interface moves from hand-written global CSS to Tailwind with Radix-based
components, gains a light and a dark theme, and gets a calmer, more modern layout.

This plan overrides `docs/slidecraft-styleguide.md` where they disagree (the dark-only rule, the
colour roles and the patterns). It changes nothing in `implementation-plan.md` or
`ux-overhaul-plan.md` beyond the look of the screens they describe.

Date of decisions: 2026-11-05. The mockups are on the design canvas
<https://claude.ai/artifact/UfWhD9V1Jy7pQST2sBHsqQ> (row B, the settings screen, the token sheet
and the typography row).

---

## 1. Decisions

| Topic | Decision |
|---|---|
| Direction | **Overhaul**, not a reskin: new layouts and a new component layer, page by page. |
| Toolkit | **Tailwind CSS v4** plus **Radix** primitives in the shadcn/ui pattern: small components copied into `src/ui/`, owned by the repository, no component-library runtime. Icons from `lucide-react`. |
| Slides stay untouched | Tailwind is **scoped to the app chrome**: no preflight, and every utility carries the `tw:` prefix, so no class a deck, a slide component or `presentation.css` uses can collide with a utility. The export viewer never loads the Tailwind stylesheet. |
| Themes | **Light, Dark and System**; System is the default and follows `prefers-color-scheme`. |
| Accent | Brand yellow `#f5b400` in light mode. In dark mode a colour the user picks, **violet `#9b8afb`** by default, with indigo, coral and mint offered. The logo keeps brand yellow in both. |
| Where the choice lives | **Per user, in the browser** (`localStorage`), not in `config.json`. Read before first paint so no page flashes the wrong theme. |
| Typography | **Zilla Slab 600** for display headings and the wordmark, **Source Sans 3** for all interface text (today's brand fonts), **Geist Mono** for numbers and code. |
| Workspace scope | Restyle the existing Code / Split / Preview workspace in the new layout first. The click-to-edit Design view of the mockups is a later, separate phase. |
| Rollout | Page by page, each phase its own branch and pull request: foundation, settings, home, workspace, gallery and presenter, then the old CSS goes. The welcome deck is updated where a phase changes what authors see. |
| Presenter and player | The full-screen player and the presenter window stay dark in every theme (the room stays dark); the presenter can be set to follow the app later. |

---

## 2. Tokens

Components name a role, never a colour. Each role is a CSS custom property `--sc-<role>` with a
light value (on `:root` and `[data-sc-theme="light"]`) and a dark value (on
`[data-sc-theme="dark"]`), so a subtree such as the presenter can force a theme. They are mapped
into Tailwind's theme so `tw:bg-panel`, `tw:text-muted` and so on resolve to them. The `sc`
prefix keeps them apart from the slide tokens (`--accent`, `--bg`, `--text`, `--muted`) and from
the `data-theme` attribute deck themes already set.

| Role | Light | Dark | Use |
|---|---|---|---|
| `ground` | `#ededea` | `#09090b` | window background |
| `panel` | `#ffffff` | `#121214` | sidebar cards, agent panel, main card |
| `panel-alt` | `#f7f7f5` | `#17171a` | slide list, card headers |
| `raised` | `#ffffff` | `#1c1c1f` | composer, floating bars, menus |
| `field` | `#f0f0ee` | `#1f1f23` | inputs, chips, message bubbles |
| `line` | `#e4e4e7` | `#26262b` | 1 px borders |
| `fg` | `#0a0a0a` | `#f4f4f5` | body and headings |
| `fg-2` | `#3f3f46` | `#d4d4d8` | secondary copy, buttons |
| `muted` | `#6b6b70` | `#a1a1aa` | meta and captions (at least 4.5:1) |
| `primary` / `on-primary` | `#0a0a0a` / `#ffffff` | `#f4f4f5` / `#0a0a0a` | the primary button inverts |
| `accent` | `#f5b400` | user choice, `#9b8afb` | selection, focus, highlights |
| `accent-tint` | `#fef7e0` | accent at 16 % | context chips, selected fills |
| `on-accent-tint` | `#7a5600` | accent | text on the tint |
| `focus` | `#a87b00` | accent | focus rings and selection outlines (yellow is 1.8:1 on white) |
| `brand` | `#f5b400` | `#f5b400` | the logo only |
| `agent` | `#0a7363` | `#2bb39c` | agent presence, success |
| `added` / `removed` | `#0a7363` / `#b42318` | `#5fd3bf` / `#f87171` | diffs, errors |
| `canvas` / `canvas-dot` | `#e4e4e0` / `#d2d2cd` | `#0e0e10` / `#232327` | behind the slide preview |

Text roles meet 4.5:1 on every surface they sit on and outlines 3:1. Rules: dark is not inverted light (surfaces get lighter as they rise, and 1 px rings replace
shadows); radii are 8 px for controls, 10–14 px for cards and panels; transitions keep the
existing 150 / 300 / 500 ms scale.

---

## 3. Architecture

- **Tailwind:** `@tailwindcss/vite` in `vite.config.ts` (the viewer config inherits it, which is
  harmless: only `src/styles/app.css` uses Tailwind, and only `main.tsx` imports it).
  `app.css` imports `tailwindcss/theme.css` with `prefix(tw)` and `tailwindcss/utilities.css` with
  `source(none)`, never `preflight.css`; `@source '../'` limits class scanning to `src/`, and
  `@theme inline` maps the tokens. The few base rules the chrome needs (font, focus ring, form
  controls inheriting font) are scoped to `.sc-app`, which the `src/ui` components also put on
  their portalled content (Radix renders dialogs, menus and tooltips into `<body>`).
- **Cascade layers:** CSS outside a layer beats every layered rule, so the global `*` reset (and
  the bare `kbd` rule) move into the lowest layer, `sc-reset`, declared first in `global.css`;
  `main.tsx` imports `global.css` before `app.css` so that order holds. Slides are unaffected,
  since the reset has zero specificity anyway.
- **Components:** `src/ui/` holds the primitives (button, icon button, input, select, segmented
  control, switch, badge, card, dialog, dropdown menu, tooltip) built on `radix-ui`, with
  `class-variance-authority` for variants and a `cn()` helper (`clsx` plus `tailwind-merge`
  configured for the `tw` prefix).
- **Appearance:** `src/appearance/` holds the store: `{ theme: 'light' | 'dark' | 'system',
  darkAccent }` under the `localStorage` key `slidecraft.appearance`, a resolver that turns the
  choice and the media query into `data-sc-theme` and `data-sc-accent` on `<html>`, and a
  `useAppearance()` hook. An inline script in `index.html` applies the stored choice before the
  app loads. Storage failures fall back to System and violet.
- **Old CSS:** `tool.css`, `editor.css` and `chat.css` (gone in R3) stay until the pages that use them are
  rebuilt, and are deleted in the last phase. `presentation.css` and the slide parts of
  `global.css` are not touched.
- **Monaco:** a light and a dark editor theme, following the app (Phase R4).

---

## 4. Phases

### Phase R1: Foundation

Tailwind, the tokens, the `src/ui/` primitives, the appearance store with the pre-paint script,
Geist Mono, and tests for the store and the resolver. No page changes yet; nothing a user sees
changes.

**Done when:** a utility such as `tw:bg-panel` renders with the right colour in both themes, the
slide CSS and the export viewer are unchanged, and typecheck, tests and build pass.

**Status (2026-11-05): done.** `src/styles/app.css` (Tailwind without preflight, `tw:` prefix,
the tokens), `src/appearance/` (store, resolver, `useAppearance`), the pre-paint script in
`index.html` (tested against the module in `tests/appearance.test.ts`), and `src/ui/` (button,
input and field, select, segmented control, switch, badge, card, status dot, kbd, tooltip, dialog,
menu, logo). The `*` reset and the palette's `kbd` rule moved into the `sc-reset` layer. Checked in
the browser: `tw:bg-panel` and `tw:px-3` apply over the reset and follow the theme, the existing
pages are unchanged, and the legacy `.text-accent` class still works.

### Phase R2: Settings

The settings page in the new layout: a settings sidebar (Appearance, Vaults, Agent) with the
**Appearance** section (theme cards for Light, Dark and System with previews, the dark accent
swatches with a live preview), and the existing vault and agent settings moved into the new
components.

**Done when:** changing the theme or the accent applies at once and survives a reload, and every
existing vault action still works.

**Status (2026-11-05): done.** `src/settings/SettingsPage.tsx` is rebuilt on `src/ui`: a sidebar
with Appearance, Vaults and Agent (the section is in the address, `/settings#vaults`, which the
home page's vault actions open), theme cards whose previews are drawn with the real tokens by
forcing `data-sc-theme` on a subtree, the dark accent swatches with a dark preview, vault rows with
a read-only switch and a confirmation dialog for removing, and the agent picker as radio cards.
The settings rules in `tool.css` are gone. The welcome deck has an Appearance slide after Vaults.
Checked in the browser in light and dark: theme and accent apply at once and survive a reload.

### Phase R3: Home and the conversation

The home page in the new layout: the app sidebar (sections, vaults with the vault switcher, agent
status, the theme switch, settings), the deck grid with the new cards, filters and sorting, the
new-deck card and the gallery link. The agent conversation moves here from R4, because the home
page embeds it; until R4 the workspace shows it with a forced dark theme.

**Status (2026-11-05): done.** `src/home/HomePage.tsx` and `PresentationCard.tsx` are rebuilt on
`src/ui`: a sidebar (Presentations, the gallery, Settings, the vaults with the current one's deck
count, Add vault, a Light/Dark/System switch, the agent's status), the question box under the
heading, filters (name in the top bar with ⌘K, folder and sort above the grid), cards with a
hover overlay for Present and Dev, and **New deck** as a dialog. `src/agent/AgentChat.tsx` keeps its
logic with new markup (Radix selects for the thread and agent, badges for context chips, cards for
tool steps, checkpoints, diffs, checks and approvals). `chat.css`, the home rules in `tool.css`,
`home/icons.tsx` and `VaultSwitcher.tsx` are gone. The welcome deck's home screenshot and the
guide are updated. Checked in the browser at 1440 px in light and dark, the new-deck dialog, and
the conversation in the workspace.

### Phase R4: Workspace

The deck workspace in the new layout: header with the deck name and save state, the view switch,
the theme picker, present and save; the slide list; the code and preview panes on the dotted
canvas; the agent panel (already restyled in R3) on the right, without its forced dark theme.
Monaco follows the app theme.

**Status (2026-11-05): done.** `src/editor/EditorPage.tsx` is rebuilt on `src/ui`: a header with
back, the deck name and save state, an *Agent is editing* badge, the Preview/Split/Code switch, a
popover for the deck's theme, scheme and accent, Format (in the code views only), Help, Save and Present; then the slide
rail, the code and preview in one rounded pane (the preview centred at 16:9 on the dotted canvas),
the help panel, and the conversation on the right (no longer forced dark; a tab brings it back
when hidden). Resizing measures each pane from its own edge. `SlideSidebar`, `SlidePreview`,
`SlideStill`, `ContextualToolbar`, `SelectionToolbar` and `HelpPanel` moved to the new chrome;
`src/ui` gained `Popover` and `NativeSelect`. Monaco has `slidecraft-light` and `slidecraft-dark`
themes that follow the app, with Geist Mono. The workspace rules in `editor.css` are gone; the
insert palette and image picker keep theirs until R5. The welcome deck's editor and workspace
screenshots and the guide are updated. Checked in the browser at 1440 px in light and dark.

### Phase R5: Gallery, presenter and the rest

The gallery, the presenter window chrome, dialogs and pickers (image picker, insert palette,
command palette, help), error and empty screens. Then `tool.css` and `editor.css` are
removed, and `docs/slidecraft-styleguide.md` is rewritten for the new system.

**Status (2026-11-05): done, in two pull requests.** R5a: the command palette, shortcuts modal,
insert palette and image picker on a shared `Sheet` overlay in `src/ui` (the player and presenter
force it dark), the deck error screen, the render-error box and a `LoadingScreen`; `editor.css`
removed. R5b: the gallery (header with search, tabs and the preview settings; cards; the detail
panel on `Sheet`) and the presenter window (forced dark, keeping its class names as hooks for the
tests); `tool.css` removed and the presenter rules pruned from `presentation.css`; the style guide
rewritten. The full-screen player's own chrome (overview, reader view, dev toolbar, drawing
toolbar, progress) stays in `presentation.css`: it is always dark and sits over the slides. The
welcome deck's gallery, presenter and error screenshots are retaken.

### Phase R6: Design view (later)

The click-to-edit Design view of the mockups: selecting an element on the slide, the floating
element toolbar and the insert bar. Planned separately when R1–R5 are done.

---

## 5. Working method

Each phase is a branch (`redesign/r<n>-<name>`) and a pull request. Before merging: typecheck,
tests and build pass, the changed screens are checked in the running app in both themes, and the
pull request has been reviewed.

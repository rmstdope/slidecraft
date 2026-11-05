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
- **Old CSS:** `tool.css`, `editor.css` and `chat.css` stay until the pages that use them are
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

### Phase R2: Settings

The settings page in the new layout: a settings sidebar (Appearance, Vaults, Agent) with the
**Appearance** section (theme cards for Light, Dark and System with previews, the dark accent
swatches with a live preview), and the existing vault and agent settings moved into the new
components.

**Done when:** changing the theme or the accent applies at once and survives a reload, and every
existing vault action still works.

### Phase R3: Home

The home page in the new layout: the app sidebar (sections, vaults with the vault switcher, agent
status, the theme switch, settings), the deck grid with the new cards, filters and sorting, the
new-deck card and the gallery link.

### Phase R4: Workspace

The deck workspace in the new layout: header with the deck name and save state, the view switch,
the theme picker, present and save; the slide list; the code and preview panes on the dotted
canvas; the agent panel on the right with the new message, step and checkpoint styles and the
composer. Monaco follows the app theme.

### Phase R5: Gallery, presenter and the rest

The gallery, the presenter window chrome, dialogs and pickers (image picker, insert palette,
command palette, help), error and empty screens. Then `tool.css`, `editor.css` and `chat.css` are
removed, and `docs/slidecraft-styleguide.md` is rewritten for the new system.

### Phase R6: Design view (later)

The click-to-edit Design view of the mockups: selecting an element on the slide, the floating
element toolbar and the insert bar. Planned separately when R1–R5 are done.

---

## 5. Working method

Each phase is a branch (`redesign/r<n>-<name>`) and a pull request. Before merging: typecheck,
tests and build pass, the changed screens are checked in the running app in both themes, and the
pull request has been reviewed.

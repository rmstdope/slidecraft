# Component registry

The registry is the list of every slide component and template, with its metadata. It is the
single source of truth for everything that lists components:

- the editor's insert palette (`⌘K`), contextual toolbar, help panel and completions;
- the gallery (`/gallery`) and the docs site's component catalogue;
- the chat assistant's system prompt and the `AGENTS.md` the server writes into content folders;
- `tests/registry.test.ts`.

The workflow for adding a component is in the [`slidecraft-components` skill](../skills/slidecraft-components/SKILL.md).
This page is the reference for the fields.

## Where it lives

`src/components/slides/defineComponent.ts` holds the registry. Each component file calls
`defineComponent({ Component, registry, toolbar })`, which records the definition and sets the
component's `displayName`. `getAllComponents()`, `getAllTemplates()`, `getComponentById()` and
`getToolbarConfig()` read it. Templates are defined with `defineTemplate()` in `templates.ts`.

The registry has layers: the built-ins, and each vault's own components (`components/<Name>/` in
the vault, [vault components plan](plans/vault-components-plan.md)). The getters return the merged
view for the active vault, or for the vault passed to them; a vault entry with a built-in's name
hides the built-in there. Vault code registers only while the app loads it (`captureDefinitions`),
and a folder may define only the component named like the folder and parts of it.

A built-in can be copied into a vault (V5) when its file holds only it and its parts and every
import is `react`, `motion/react` or something the `slidecraft` module exports. `bun run skills`
works that out into `shared/builtinCopies.json` (with the reason for each that cannot), and a test
copies every copyable built-in and checks it renders as the built-in. To make one copyable, export
what it needs from `src/vault-api/index.ts`.

Everything that reads the registry sees the same layers: the app and the gallery, the server's
own registry for `validate_deck`, `validate_component`, the agent context and `bun run mcp --vault`
(`server/lib/serverRegistry.ts`), and the HTML export (V6). The export carries the bundle of each
vault component folder the deck uses, base64 in its payload, plus an import map whose `slidecraft`,
`react`, `react/jsx-runtime` and `motion/react` are `data:` shims onto the viewer's own modules;
the viewer registers them under the deck's vault before it renders. A vault whose components may
not run exports none of its code, so its slides show placeholders and built-ins stay.

## Fields

| Field | Rule |
|---|---|
| `id` | unique, kebab-case (`two-column`); used in URLs and as a stable key |
| `name` | PascalCase, exactly the export name and the JSX tag (`TwoColumn`) |
| `category` | `component`, or `template` for whole-slide snippets |
| `description` | one sentence ending with a period; what it is, not how to use it |
| `props` | every prop an author may write: `name`, `type` (TypeScript-like text), `default` (the literal, as a string), `description` |
| `snippet` | the smallest useful MDX, inserted at the cursor |
| `previewCode` | MDX inside a `<Slide>` that looks good as a thumbnail; may set `scheme` and `accent` |
| `keywords` | extra search words (synonyms people type: "bullets", "kpi", "flowchart") |
| `useCases` | short phrases shown in the gallery and help panel |
| `parent` | for a part that only makes sense inside another component (`ListItem`, `SignalNode`, `SignalBypass`, `TracedPoint`, `Milestone`): the parent's name. Parts stay in the MDX scope and completions, but the gallery, help panel, palette (until searched), agent docs and site catalogue show them inside the parent's entry |

Guidelines:

- **Defaults must match the code.** If the component defaults `width` to 1600, write `default: '1600'`.
- **Types are documentation.** Write the union of allowed strings (`'"left" | "center"'`) rather
  than `string` when the set is closed.
- **Snippets compile on their own** inside a slide, with no imports beyond `@components`.
- **Previews show the component at its best**, not every prop at once.
- Props that only exist for internal use (`className`) are left out.

## Toolbar

`toolbar` lists the props the contextual toolbar can edit when the cursor is on the component:

| `type` | Control | Extra fields |
|---|---|---|
| `boolean` | toggle | – |
| `select` | dropdown | `options` |
| `number` | stepper | `min`, `max`, `step` |
| `image` | image picker (library, deck images, upload) | – |

Leave out props with structured values (arrays of objects); authors edit those in code.

## Variants and templates

- A **variant** is a registry entry for a preset of another component, named with the variant
  in parentheses. The help panel lists components only and leaves variants out (any name with a
  parenthesis). Parts (`parent` set) are shown inside their parent's entry.
- A **template** is a whole slide (`category: 'template'`, no props). The palette's "Add slide"
  and the editor's **Add slide** button list templates; a template's `snippet` is a complete
  `<Slide>…</Slide>`. Frame templates (folio title, section, content) preview inside
  `<Presentation theme="folio">`.

## Updating an entry

Change the definition next to the component, then run `bun test tests/registry.test.ts`. Nothing
else needs editing: every consumer reads the registry at build or run time, and the docs-site
catalogue is generated from it by `bun run build:site`.

## Help panel

The editor's **Help** panel lists every component with its description, props and snippet,
straight from the registry, followed by the editor's keyboard shortcuts.

## Checklist

- [ ] `name` equals the export name and the file's component
- [ ] `id` is kebab-case and unique
- [ ] `description` is one sentence ending with a period
- [ ] every author-facing prop is listed, with a correct default
- [ ] `snippet` and `previewCode` compile (the registry test checks)
- [ ] `keywords` include the words people would search for
- [ ] the toolbar covers the props worth changing without typing
- [ ] the component is exported from `src/components/slides/index.ts`

import type { DeckModule, DeckModuleLoader } from './deckTypes'

/**
 * The repo's example decks, bundled by Vite in development (HMR, local .tsx imports) and for
 * the static docs site. Production builds alias this module to bundledDecks.empty.ts and load
 * every deck at runtime (Part 1 §14.1).
 */
export const presentationModules: Record<string, DeckModuleLoader> = import.meta.glob<DeckModule>('/content/*/index.mdx')

/** Content-folder themes next to those decks, for the static site (no server to list them). */
export const bundledThemeSpecs: Record<string, unknown> = import.meta.glob('/content/themes/*/theme.json', { eager: true, import: 'default' })

/** Their asset files as URLs, keyed by repo path (`/content/themes/<id>/<file>`). */
export const bundledThemeAssets: Record<string, string> = import.meta.glob('/content/themes/*/**/*.{svg,png,jpg,jpeg,webp,avif,gif,woff,woff2,ttf,otf}', {
  eager: true,
  query: '?url',
  import: 'default',
})

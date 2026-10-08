import type { DeckModule, DeckModuleLoader } from './deckTypes'

/**
 * The repo's example decks, bundled by Vite in development (HMR, local .tsx imports) and for
 * the static docs site. Production builds alias this module to bundledDecks.empty.ts and load
 * every deck at runtime (Part 1 §14.1).
 */
export const presentationModules: Record<string, DeckModuleLoader> = import.meta.glob<DeckModule>('/content/*/index.mdx')

import { BUILT_IN_SOURCE_ID, type DeckRef } from '@shared/decks.ts'
import { presentationModules } from './bundledDecks'
import type { DeckModuleLoader } from './deckTypes'

export class DeckNotFoundError extends Error {
  constructor(deck: DeckRef) {
    super(`Presentation "${deck.path}" not found in source "${deck.source}"`)
    this.name = 'DeckNotFoundError'
  }
}

const bundledKey = (deck: DeckRef) => `/content/${deck.path}/index.mdx`

export const isBundled = (deck: DeckRef, builtInSourceId = BUILT_IN_SOURCE_ID): boolean =>
  deck.source === builtInSourceId && !deck.path.includes('/') && !!presentationModules[bundledKey(deck)]

/**
 * Pick a loader for a deck (Part 3 §1.2): the Vite-bundled module for a top-level built-in deck
 * that was bundled (dev server, static site), else the runtime compiler. A stale or missing
 * bundle never hides a deck: the runtime compiler is always the fallback.
 */
export function deckModuleLoader(deck: DeckRef, options: { builtInSourceId?: string; defaultSource?: string; runtime?: boolean } = {}): DeckModuleLoader {
  const runtime = () => import('./deckLoader').then(({ loadDeck }) => loadDeck(deck, options.defaultSource))
  if (!options.runtime && isBundled(deck, options.builtInSourceId)) {
    const bundled = presentationModules[bundledKey(deck)]
    return () => bundled().catch(runtime)
  }
  return runtime
}

/** Names of the decks bundled into this build (dev server and static site only). */
export function bundledDeckNames(): string[] {
  return Object.keys(presentationModules)
    .map((key) => /\/content\/(.+)\/index\.mdx$/.exec(key)?.[1])
    .filter((name): name is string => !!name)
    .sort()
}

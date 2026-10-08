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

/**
 * Pick a loader for a deck (Part 3 §1.2): the Vite-bundled module when the deck is a top-level
 * built-in deck that was bundled, else the runtime in-browser compiler (Phase 5).
 */
export function deckModuleLoader(deck: DeckRef): DeckModuleLoader {
  const bundled = presentationModules[bundledKey(deck)]
  if (deck.source === BUILT_IN_SOURCE_ID && !deck.path.includes('/') && bundled) return bundled
  return () => Promise.reject(new DeckNotFoundError(deck))
}

/** Names of the decks bundled into this build (dev server and static site only). */
export function bundledDeckNames(): string[] {
  return Object.keys(presentationModules)
    .map((key) => /\/content\/(.+)\/index\.mdx$/.exec(key)?.[1])
    .filter((name): name is string => !!name)
    .sort()
}

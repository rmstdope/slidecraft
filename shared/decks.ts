/** Deck identity (Part 4 §3.6): a mounted content source id plus a folder path inside it. */
export interface DeckRef {
  source: string
  path: string
}

export interface PresentationInfo extends DeckRef {
  name: string
  createdAt: number
  updatedAt: number
  readOnly: boolean
  builtIn: boolean
}

export interface ContentSourceInfo {
  id: string
  path: string
  include: string[]
  readOnly: boolean
  builtIn: boolean
}

export const BUILT_IN_SOURCE_ID = 'built-in'

/** First path segments that belong to the app and can never be a deck slug. */
export const RESERVED_DECK_NAMES = new Set([
  'api',
  'chat',
  'content',
  'content-source',
  'edit',
  'gallery',
  'images',
])

export const deckKey = (ref: DeckRef): string => `${ref.source}:${ref.path}`

export const deckName = (ref: DeckRef): string => {
  const segments = ref.path.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? ref.path
}

export const deckQuery = (ref: DeckRef): string =>
  new URLSearchParams({ source: ref.source, path: ref.path }).toString()

export const sameDeck = (a: DeckRef | undefined, b: DeckRef | undefined): boolean =>
  !!a && !!b && a.source === b.source && a.path === b.path

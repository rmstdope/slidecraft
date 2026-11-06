/**
 * Deck identity (Part 4 §3.6): a vault id plus a folder path inside it. The field is still
 * called `source` (a vault is a content source with a name).
 */
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

/** A vault as the server reports it. */
export interface ContentSourceInfo {
  id: string
  /** Shown in the app ("Work", "Private"). */
  name: string
  path: string
  include: string[]
  readOnly: boolean
  /** The repository's example decks. */
  builtIn: boolean
  /** Opened with --content for this run only; not in the config file. */
  temporary: boolean
  /** Whether the vault's own components may run (vault components plan, V2). */
  components: 'trusted' | 'blocked' | 'ask'
}

export type VaultInfo = ContentSourceInfo

/** The vault id of the repository's example decks (also in the static docs site). */
export const BUILT_IN_SOURCE_ID = 'examples'
export const BUILT_IN_VAULT_NAME = 'Examples'

/** A vault id from a name: lower-case words joined by dashes. */
export const vaultIdFromName = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'vault'

/** First path segments that belong to the app and can never be a deck slug. */
export const RESERVED_DECK_NAMES = new Set([
  'api',
  'v',
  'settings',
  'chat',
  'content',
  'content-source',
  'components',
  'edit',
  'gallery',
  'images',
  'themes',
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

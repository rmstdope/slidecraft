import type { ComponentType } from 'react'
import { sameDeck, type DeckRef } from '@shared/decks.ts'
import { appPath } from './basePath'

/**
 * What the URL asks for, before any deck is loaded (Part 3 §1.4, vaults from UX overhaul U1).
 * Every page except settings lives in a vault: `/v/<vault>/…`. The older shapes (`/<name>`,
 * `/edit/<name>`, `/chat`, `/gallery`, with `?source=&path=`) still parse, marked `legacy`, so
 * the app can replace them with the canonical URL.
 */
export type Route =
  | { type: 'root' }
  | { type: 'settings' }
  | { type: 'home'; vault: string; legacy?: boolean }
  | { type: 'gallery'; vault: string; legacy?: boolean }
  | { type: 'chat'; vault: string; deck?: DeckRef; legacy?: boolean }
  | { type: 'editor'; deck: DeckRef; legacy?: boolean }
  | { type: 'presentation'; deck: DeckRef; presenter: boolean; legacy?: boolean }

/** The app's view state machine (Part 3 §1.3). */
export type ViewState =
  | { type: 'loading' }
  | { type: 'home'; vault: string }
  | { type: 'settings' }
  | { type: 'presentation'; deck: DeckRef; content: ComponentType }
  | { type: 'presentation-error'; deck: DeckRef; error: string }
  | { type: 'editor'; deck: DeckRef }
  | { type: 'chat'; vault: string; deck?: DeckRef }
  | { type: 'presenter'; deck: DeckRef; content: ComponentType }
  | { type: 'gallery'; vault: string }

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

/** The vault a route belongs to (none for the root and settings). */
export const routeVault = (route: Route): string | undefined =>
  route.type === 'root' || route.type === 'settings' ? undefined : 'vault' in route ? route.vault : route.deck.source

export function parseRoute(route: string, search: string, defaultVault = ''): Route {
  const path = route.replace(/\/+$/, '')
  const params = new URLSearchParams(search)
  const presenter = params.has('presenter')
  if (path === '') return { type: 'root' }
  if (path === 'settings') return { type: 'settings' }

  if (path === 'v' || path.startsWith('v/')) {
    const [rawVault = '', ...rest] = path.slice(2).split('/')
    const vault = decode(rawVault)
    if (!vault) return { type: 'root' }
    const [first, ...tail] = rest.map(decode)
    const deckPath = tail.join('/')
    if (first === undefined || first === '') return { type: 'home', vault }
    if (first === 'gallery' && !tail.length) return { type: 'gallery', vault }
    if (first === 'chat') return { type: 'chat', vault, deck: deckPath ? { source: vault, path: deckPath } : undefined }
    if (first === 'edit' && deckPath) return { type: 'editor', deck: { source: vault, path: deckPath } }
    return { type: 'presentation', deck: { source: vault, path: rest.map(decode).join('/') }, presenter }
  }

  // Older URLs: the deck name in the path, optionally qualified by ?source=&path=.
  const vault = params.get('source') || defaultVault
  const legacyDeck = (name: string): DeckRef => ({ source: vault, path: params.get('path') || name })
  if (path === 'gallery') return { type: 'gallery', vault, legacy: true }
  if (path === 'chat') return { type: 'chat', vault, legacy: true }
  if (path.startsWith('chat/')) return { type: 'chat', vault, deck: legacyDeck(decode(path.slice('chat/'.length))), legacy: true }
  if (path.startsWith('edit/')) return { type: 'editor', deck: legacyDeck(decode(path.slice('edit/'.length))), legacy: true }
  return { type: 'presentation', deck: legacyDeck(decode(path)), presenter, legacy: true }
}

/** The canonical URL for a legacy route, keeping the query flags that still mean something. */
export function canonicalUrl(route: Route, search: string, hash = ''): string | undefined {
  if (!('legacy' in route) || !route.legacy) return undefined
  const params = new URLSearchParams(search)
  params.delete('source')
  params.delete('path')
  const query = params.toString() ? `?${params}` : ''
  switch (route.type) {
    case 'home':
      return homeUrl(route.vault) + hash
    case 'gallery':
      return galleryUrl(route.vault) + query
    case 'chat':
      return (route.deck ? chatUrl(route.deck) : vaultChatUrl(route.vault)) + query
    case 'editor':
      return appPath(`/v/${encodeURIComponent(route.deck.source)}/edit/${encodePath(route.deck.path)}`) + query + hash
    case 'presentation':
      return appPath(`/v/${encodeURIComponent(route.deck.source)}/${encodePath(route.deck.path)}`) + query + hash
  }
}

/**
 * Hash writes (#slide-N-step-S) fire popstate. When the deck already on screen is the same deck
 * in the same presenter/audience mode, the router must do nothing, or every step would recompile
 * the deck and replay every entry animation (Part 0 §0.9).
 */
export function isSameDeckView(view: ViewState, route: Route): boolean {
  if (route.type !== 'presentation') return false
  if (view.type === 'presentation') return !route.presenter && sameDeck(view.deck, route.deck)
  if (view.type === 'presenter') return route.presenter && sameDeck(view.deck, route.deck)
  return false
}

export interface PresentationUrlOptions {
  dev?: boolean
  presenter?: boolean
  readOnly?: boolean
  slide?: number // 1-based
}

const deckBase = (deck: DeckRef) => `/v/${encodeURIComponent(deck.source)}`

export function presentationUrl(deck: DeckRef, options: PresentationUrlOptions = {}): string {
  const params = new URLSearchParams()
  if (options.dev) params.set('mode', 'dev')
  if (options.readOnly) params.set('readOnly', '1')
  if (options.presenter) params.set('presenter', 'true')
  const query = params.toString() ? `?${params}` : ''
  const hash = options.slide ? `#slide-${options.slide}` : ''
  return appPath(`${deckBase(deck)}/${encodePath(deck.path)}${query}${hash}`)
}

export function editorUrl(deck: DeckRef, slide?: number): string {
  return appPath(`${deckBase(deck)}/edit/${encodePath(deck.path)}${slide ? `?slide=${slide}` : ''}`)
}

export const chatUrl = (deck: DeckRef): string => appPath(`${deckBase(deck)}/chat/${encodePath(deck.path)}`)
export const vaultChatUrl = (vault: string): string => appPath(`/v/${encodeURIComponent(vault)}/chat`)

/** A vault's home page, or `/` (which opens the last vault) without one. */
export const homeUrl = (vault?: string): string => appPath(vault ? `/v/${encodeURIComponent(vault)}/` : '/')
export const galleryUrl = (vault: string): string => appPath(`/v/${encodeURIComponent(vault)}/gallery`)
export const settingsUrl = (): string => appPath('/settings')

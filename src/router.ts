import type { ComponentType } from 'react'
import { deckQuery, deckName, sameDeck, type DeckRef } from '@shared/decks.ts'
import { appPath } from './basePath'

/** What the URL asks for, before any deck is resolved or loaded (Part 3 §1.4). */
export type Route =
  | { type: 'home' }
  | { type: 'gallery' }
  | { type: 'chat'; name?: string }
  | { type: 'editor'; name: string }
  | { type: 'presentation'; name: string; presenter: boolean }

/** The app's view state machine (Part 3 §1.3). */
export type ViewState =
  | { type: 'loading' }
  | { type: 'home' }
  | { type: 'presentation'; deck: DeckRef; content: ComponentType }
  | { type: 'presentation-error'; deck: DeckRef; error: string }
  | { type: 'editor'; deck: DeckRef }
  | { type: 'chat'; deck?: DeckRef }
  | { type: 'presenter'; deck: DeckRef; content: ComponentType }
  | { type: 'gallery' }

const decode = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function parseRoute(route: string, search: string): Route {
  const path = route.replace(/\/+$/, '')
  if (path === '') return { type: 'home' }
  if (path === 'gallery') return { type: 'gallery' }
  if (path === 'chat') return { type: 'chat' }
  if (path.startsWith('chat/')) return { type: 'chat', name: decode(path.slice('chat/'.length)) }
  if (path.startsWith('edit/')) return { type: 'editor', name: decode(path.slice('edit/'.length)) }
  const params = new URLSearchParams(search)
  return { type: 'presentation', name: decode(path), presenter: params.has('presenter') }
}

/** Build a deck ref from a route name and the query string (Part 3 §1.4 resolveRouteDeck). */
export function resolveRouteDeck(name: string, search: string, defaultSource: string): DeckRef {
  const params = new URLSearchParams(search)
  return { source: params.get('source') || defaultSource, path: params.get('path') || name }
}

/**
 * Hash writes (#slide-N-step-S) fire popstate. When the deck already on screen is the same deck
 * in the same presenter/audience mode, the router must do nothing, or every step would recompile
 * the deck and replay every entry animation (Part 0 §0.9).
 */
export function isSameDeckView(view: ViewState, route: Route, deck: DeckRef | undefined): boolean {
  if (route.type !== 'presentation') return false
  if (view.type === 'presentation') return !route.presenter && sameDeck(view.deck, deck)
  if (view.type === 'presenter') return route.presenter && sameDeck(view.deck, deck)
  return false
}

export interface PresentationUrlOptions {
  dev?: boolean
  presenter?: boolean
  readOnly?: boolean
  slide?: number // 1-based
}

export function presentationUrl(deck: DeckRef, options: PresentationUrlOptions = {}): string {
  const params = new URLSearchParams(deckQuery(deck))
  if (options.dev) params.set('mode', 'dev')
  if (options.readOnly) params.set('readOnly', '1')
  if (options.presenter) params.set('presenter', 'true')
  const hash = options.slide ? `#slide-${options.slide}` : ''
  return appPath(`/${encodeURIComponent(deckName(deck))}?${params}${hash}`)
}

export function editorUrl(deck: DeckRef, slide?: number): string {
  const params = new URLSearchParams(deckQuery(deck))
  if (slide) params.set('slide', String(slide))
  return appPath(`/edit/${encodeURIComponent(deckName(deck))}?${params}`)
}

export function chatUrl(deck?: DeckRef): string {
  return deck ? appPath(`/chat/${encodeURIComponent(deckName(deck))}?${deckQuery(deck)}`) : appPath('/chat')
}

export const homeUrl = (): string => appPath('/')
export const galleryUrl = (): string => appPath('/gallery')

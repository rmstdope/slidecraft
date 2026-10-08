/** Editor client API (Part 3 §2.2). Every call resolves to `{ data?, error? }`; nothing throws. */
import { deckName, deckQuery, type DeckRef } from '@shared/decks.ts'
import { appPath } from '../basePath'

export interface ApiResult<T> {
  data?: T
  error?: string
}

export interface ImageInfo {
  name: string
  path: string
  size: number
  modified: number
}

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(appPath(path), init)
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; details?: string }
    if (!res.ok) return { error: body.details ? `${body.error}: ${body.details}` : (body.error ?? `HTTP ${res.status}`) }
    return { data: body }
  } catch (error) {
    return { error: `Network error: ${(error as Error).message}` }
  }
}

const deckUrl = (deck: DeckRef) => `/api/mdx/${encodeURIComponent(deckName(deck))}?${deckQuery(deck)}`

export const loadMdx = (deck: DeckRef) => call<{ content: string; readOnly: boolean }>(deckUrl(deck))

export const saveMdx = (deck: DeckRef, content: string) =>
  call<{ success: boolean }>(deckUrl(deck), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })

export const listLibraryImages = () => call<{ images: ImageInfo[] }>('/api/images/library')

export const listPresentationImages = (deck: DeckRef) => call<{ images: ImageInfo[] }>(`/api/images/${encodeURIComponent(deckName(deck))}?${deckQuery(deck)}`)

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export function uploadImage(file: File, storage: 'library' | 'presentation', deck?: DeckRef) {
  const form = new FormData()
  form.set('file', file)
  form.set('storage', storage)
  if (deck) {
    form.set('presentation', deckName(deck))
    form.set('source', deck.source)
    form.set('path', deck.path)
  }
  return call<{ path: string }>('/api/images/upload', { method: 'POST', body: form })
}

export const deleteImage = (path: string, deck?: DeckRef) =>
  call<{ success: boolean }>('/api/images', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, source: deck?.source, deckPath: deck?.path }) })

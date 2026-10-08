/** Small fetch helpers for the app shell. They never throw: failures become `{ error }`. */
import type { ContentSourceInfo, DeckRef, PresentationInfo } from '@shared/decks.ts'
import { deckName, deckQuery } from '@shared/decks.ts'
import { appPath } from './basePath'

export interface ApiResult<T> {
  data?: T
  error?: string
  status?: number
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(appPath(path), init)
    const body = (await res.json().catch(() => ({}))) as T & { error?: string; details?: string }
    if (!res.ok) return { error: body.details ? `${body.error}: ${body.details}` : (body.error ?? `HTTP ${res.status}`), status: res.status }
    return { data: body, status: res.status }
  } catch (error) {
    return { error: `Network error: ${(error as Error).message}` }
  }
}

export interface ContentsState {
  current: ContentSourceInfo & { name: string | null; dir: string }
  sources: ContentSourceInfo[]
  options: { name: string; dir: string }[]
  configFile: string
}

export interface ContentThemeInfo {
  id: string
  source: string
  raw: unknown
  errors: string[]
  baseUrl: string
}

export const fetchContents = () => request<ContentsState>('/api/contents')
export const fetchPresentations = () => request<PresentationInfo[]>('/api/presentations')
export const fetchThemes = () => request<ContentThemeInfo[]>('/api/themes')
export const fetchDeckSource = (deck: DeckRef) =>
  request<{ content: string; deck: DeckRef; readOnly: boolean }>(`/api/mdx/${encodeURIComponent(deckName(deck))}?${deckQuery(deck)}`)

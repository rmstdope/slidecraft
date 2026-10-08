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

/** Saves a blob as a download. */
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const exportPath = (deck: DeckRef, pdf: boolean) => `/api/export/${encodeURIComponent(deckName(deck))}${pdf ? '/pdf' : ''}?${deckQuery(deck)}`

/** Exports a deck as one offline HTML file and downloads it (Part 3 §1.6). */
export async function downloadHtmlExport(deck: DeckRef): Promise<ApiResult<true>> {
  const result = await request<{ html: string; name: string }>(exportPath(deck, false), { method: 'POST' })
  if (!result.data) return { error: result.error, status: result.status }
  download(new Blob([result.data.html], { type: 'text/html' }), `${result.data.name}.html`)
  return { data: true }
}

/** Exports a deck as a PDF (rendered by the server's headless Chrome) and downloads it. */
export async function downloadPdfExport(deck: DeckRef): Promise<ApiResult<true>> {
  try {
    const res = await fetch(appPath(exportPath(deck, true)), { method: 'POST' })
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string }
      return { error: body.details ?? body.error ?? `HTTP ${res.status}`, status: res.status }
    }
    download(await res.blob(), `${deckName(deck)}.pdf`)
    return { data: true }
  } catch (error) {
    return { error: `Network error: ${(error as Error).message}` }
  }
}

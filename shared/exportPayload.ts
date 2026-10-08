/** The data a single-file HTML export embeds next to the viewer (Part 4 §8). */
import type { DeckRef } from './decks.ts'

export interface ExportedTheme {
  id: string
  source: string
  raw: unknown
  /** Theme-relative path → data URL. */
  assets: Record<string, string>
}

export interface ExportPayload {
  name: string
  deck: DeckRef
  /** The compiled MDX function body, base64 of UTF-8. */
  code: string
  /** Deck-relative asset path → data URL, for string props such as `src="images/a.png"`. */
  assets: Record<string, string>
  /** Content-folder themes the deck uses (built-in themes are part of the viewer). */
  themes: ExportedTheme[]
}

export const PAYLOAD_ELEMENT_ID = 'slidecraft-deck'

/** `./images/a.png`, `images/a.png` and `<deck>/images/a.png` all name the same asset. */
export function assetKey(src: string, deckName?: string): string {
  let key = src.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '')
  if (deckName && key.startsWith(`${deckName}/`)) key = key.slice(deckName.length + 1)
  return key
}

export const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
}

export const mimeType = (file: string): string => MIME_TYPES[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

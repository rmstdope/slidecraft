/**
 * Themes from content folders (plan Phase 4b): fetched from the server, registered with the theme
 * registry, and refreshed when a theme folder changes. Decks re-render through the registry store.
 */
import { fetchThemes } from '../api'
import { IS_STATIC } from '../basePath'
import { subscribeServerEvents } from '../hooks/useSSE'
import { BUILTIN_SOURCE, registerTheme, unregisterSource } from './registry'

let started = false
const loadedSources = new Set<string>()

export async function loadContentThemes(): Promise<void> {
  const result = await fetchThemes()
  if (!result.data) return
  for (const source of loadedSources) if (source !== BUILTIN_SOURCE) unregisterSource(source)
  loadedSources.clear()
  for (const theme of result.data) {
    loadedSources.add(theme.source)
    if (theme.raw) registerTheme({ id: theme.id, source: theme.source, raw: theme.raw, baseUrl: theme.baseUrl })
    if (theme.errors.length) console.warn(`Theme "${theme.id}" in ${theme.source}:`, theme.errors.join('; '))
  }
}

/** Load content themes once and keep them current. */
export function startContentThemes(): Promise<void> {
  if (started || IS_STATIC) return Promise.resolve()
  started = true
  subscribeServerEvents((message) => {
    if (message.type === 'themes-updated') void loadContentThemes()
  })
  return loadContentThemes()
}

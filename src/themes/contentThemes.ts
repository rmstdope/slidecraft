/**
 * Themes from content folders (plan Phase 4b): fetched from the server, registered with the theme
 * registry, and refreshed when a theme folder changes. Decks re-render through the registry store.
 */
import { fetchThemes } from '../api'
import { IS_STATIC } from '../basePath'
import { bundledThemeAssets, bundledThemeSpecs } from '../bundledDecks'
import { BUILT_IN_SOURCE_ID } from '@shared/decks.ts'
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

/** The repo's own theme folders, bundled into the build (the static site has no server). */
export function registerBundledThemes(source = BUILT_IN_SOURCE_ID): number {
  let count = 0
  for (const [file, raw] of Object.entries(bundledThemeSpecs)) {
    const id = /\/content\/themes\/([^/]+)\/theme\.json$/.exec(file)?.[1]
    if (!id) continue
    const prefix = `/content/themes/${id}/`
    const assets: Record<string, string> = {}
    for (const [path, url] of Object.entries(bundledThemeAssets)) if (path.startsWith(prefix)) assets[path.slice(prefix.length)] = url
    registerTheme({ id, source, raw, baseUrl: prefix, assets })
    count++
  }
  return count
}

/** Load content themes once and keep them current. */
export function startContentThemes(): Promise<void> {
  if (started) return Promise.resolve()
  if (IS_STATIC) {
    started = true
    registerBundledThemes()
    return Promise.resolve()
  }
  started = true
  subscribeServerEvents((message) => {
    if (message.type === 'themes-updated') void loadContentThemes()
  })
  return loadContentThemes()
}

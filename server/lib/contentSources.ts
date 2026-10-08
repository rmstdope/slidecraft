/**
 * Content sources (Part 4 §3.3): every configured directory stays mounted; the default only
 * governs legacy name-only URLs. Precedence for the default: CLI flag → env var → config default →
 * the fallback directory.
 */
import { join, resolve } from 'node:path'
import { BUILT_IN_SOURCE_ID, type ContentSourceInfo } from '../../shared/decks.ts'
import { expandHome, FALLBACK_CONTENT_DIR, IS_BUNDLED, PUBLIC_DIR, readConfig, requestedContent, type AppConfig, type SourceDescriptor } from './paths.ts'

export interface ContentSource extends ContentSourceInfo {}

export const LEGACY_INCLUDE = ['*/index.mdx']
export const DESCRIPTOR_INCLUDE = ['*/index.mdx', 'presentations/*/index.mdx']

function normalizeIncludes(id: string, include: string | string[] | undefined, fallback: string[]): string[] {
  const raw = include === undefined ? fallback : Array.isArray(include) ? include : [include]
  const cleaned = [
    ...new Set(
      raw
        .map((p) => String(p).replace(/\\/g, '/').trim())
        .filter((p) => p !== '' && !p.startsWith('/'))
        .map((p) => p.replace(/^(\.\/)+/, ''))
        .filter((p) => !p.split('/').includes('..')),
    ),
  ]
  if (cleaned.length === 0) throw new Error(`Content source "${id}" must define at least one safe include pattern`)
  return cleaned
}

export function normalizeContentSource(id: string, value: string | SourceDescriptor, builtIn = false): ContentSource {
  const legacy = typeof value === 'string'
  const rawPath = legacy ? value : value?.path
  if (typeof rawPath !== 'string' || rawPath.trim() === '') throw new Error(`Content source "${id}" must define a path`)
  return {
    id,
    path: resolve(expandHome(rawPath.trim())),
    include: legacy ? [...LEGACY_INCLUDE] : normalizeIncludes(id, value.include, DESCRIPTOR_INCLUDE),
    readOnly: legacy ? false : value.readOnly === true,
    builtIn,
  }
}

const uniqueId = (wanted: string, taken: Set<string>) => {
  if (!taken.has(wanted)) return wanted
  let n = 2
  while (taken.has(`${wanted}-${n}`)) n++
  return `${wanted}-${n}`
}

export function normalizeContentSources(config: AppConfig, requested: string | undefined, fallbackPath: string): { sources: ContentSource[]; defaultSourceId: string } {
  const sources = Object.entries(config.contents ?? {}).map(([id, value]) => normalizeContentSource(id, value))
  const ids = new Set(sources.map((s) => s.id))
  let defaultSourceId: string | undefined

  if (requested) {
    const byId = sources.find((s) => s.id === requested)
    const path = byId ? byId.path : resolve(expandHome(requested))
    const existing = sources.find((s) => s.path === path)
    if (existing) defaultSourceId = existing.id
    else {
      const id = uniqueId('default', ids)
      ids.add(id)
      sources.unshift(normalizeContentSource(id, path))
      defaultSourceId = id
    }
  } else if (config.default && sources.some((s) => s.id === config.default)) {
    defaultSourceId = config.default
  }

  const fallback = resolve(fallbackPath)
  const mounted = sources.find((s) => s.path === fallback)
  if (mounted) mounted.builtIn = true
  else {
    const id = uniqueId(BUILT_IN_SOURCE_ID, ids)
    sources.push({ ...normalizeContentSource(id, { path: fallback, include: DESCRIPTOR_INCLUDE }), builtIn: true })
  }
  defaultSourceId ??= sources.find((s) => s.builtIn)!.id
  return { sources, defaultSourceId }
}

// Process state: the mounted sources and the current default. Read through the getters.
let state = normalizeContentSources(readConfig(), requestedContent(), FALLBACK_CONTENT_DIR)

export const getContentSources = (): ContentSource[] => state.sources
export const getContentSource = (id: string): ContentSource | undefined => state.sources.find((s) => s.id === id)
export const getDefaultContentSource = (): ContentSource => getContentSource(state.defaultSourceId)!
export const getContentDir = (): string => getDefaultContentSource().path

/** Shared image library: in the content directory for the binary, in public/ in a checkout. */
export const getLibraryDir = (): string => (IS_BUNDLED ? join(getContentDir(), '.slidecraft', 'library') : join(PUBLIC_DIR, 'images', 'library'))

/** Switch the default source for this process; the config file is never written. */
export function setContentByName(id: string): boolean {
  if (!getContentSource(id)) return false
  state = { ...state, defaultSourceId: id }
  return true
}

/** For tests and the content-dir script: replace the mounted sources. */
export function initContentSources(config: AppConfig, requested: string | undefined, fallbackPath: string): void {
  state = normalizeContentSources(config, requested, fallbackPath)
}

import { mergeThemeSpecs, parseThemeSpec, type ThemeSpec } from '@shared/themes.ts'
import { appPath } from '../basePath'
import { BUILTIN_THEMES } from './builtin'

export const BUILTIN_SOURCE = 'builtin'
export const DEFAULT_THEME_ID = 'slidecraft'

export interface ThemeEntry {
  id: string
  /** Content source id the theme folder lives in, or "builtin". */
  source: string
  spec: ThemeSpec
  /** URL of the theme folder, ending with "/". */
  baseUrl: string
  assets: Record<string, string>
  errors: string[]
}

export interface ResolvedTheme {
  key: string
  id: string
  source: string
  /** Fully merged spec: every theme ends up on top of the default theme. Asset paths are URLs. */
  spec: ThemeSpec
  errors: string[]
}

const entries = new Map<string, ThemeEntry>()
const cache = new Map<string, ResolvedTheme>()
const listeners = new Set<() => void>()
let version = 0

const keyOf = (source: string, id: string) => `${source}:${id}`

function changed() {
  cache.clear()
  version += 1
  listeners.forEach((listener) => listener())
}

export const subscribeThemes = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export const getThemesVersion = (): number => version

/** A theme-relative path as a URL; absolute app paths and data:/http URLs pass through. */
export function themeAssetUrl(path: string, entry: Pick<ThemeEntry, 'baseUrl' | 'assets'>): string {
  if (/^(data:|blob:|https?:|\/\/)/i.test(path)) return path
  if (path.startsWith('/')) return appPath(path)
  const relative = path.replace(/^\.\//, '')
  return entry.assets[relative] ?? `${entry.baseUrl}${relative}`
}

/** Replace every asset path in a spec with a URL, so merged themes keep each asset's own folder. */
function withAssetUrls(spec: ThemeSpec, entry: ThemeEntry): ThemeSpec {
  const url = (p: string | null | undefined) => (typeof p === 'string' ? themeAssetUrl(p, entry) : p)
  const frames = spec.frames ? Object.fromEntries(Object.entries(spec.frames).map(([name, f]) => [name, f.svg ? { ...f, svg: url(f.svg) as string } : f])) : undefined
  const font = (f: NonNullable<ThemeSpec['fonts']>['display']) => (f?.files ? { ...f, files: f.files.map((file) => ({ ...file, src: url(file.src) as string })) } : f)
  return {
    ...spec,
    frames,
    logos: spec.logos ? { onDark: url(spec.logos.onDark), onLight: url(spec.logos.onLight) } : undefined,
    fonts: spec.fonts ? { display: font(spec.fonts.display), body: font(spec.fonts.body) } : undefined,
  }
}

export interface RegisterThemeInput {
  id: string
  source: string
  raw: unknown
  baseUrl: string
  assets?: Record<string, string>
}

/** Register a theme folder's theme.json. Re-registering the same source and id replaces it. */
export function registerTheme({ id, source, raw, baseUrl, assets = {} }: RegisterThemeInput): ThemeEntry {
  const { spec, errors } = parseThemeSpec(raw)
  const entry: ThemeEntry = {
    id,
    source,
    spec: spec ?? { name: id },
    baseUrl: baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    assets,
    errors,
  }
  entries.set(keyOf(source, id), entry)
  changed()
  return entry
}

export function unregisterSource(source: string): void {
  for (const key of [...entries.keys()]) if (key.startsWith(`${source}:`)) entries.delete(key)
  changed()
}

/** A content source's own theme wins over a built-in theme with the same id. */
function lookup(id: string, source?: string): ThemeEntry | undefined {
  return (source ? entries.get(keyOf(source, id)) : undefined) ?? entries.get(keyOf(BUILTIN_SOURCE, id))
}

function build(entry: ThemeEntry, seen: string[]): ResolvedTheme {
  const key = keyOf(entry.source, entry.id)
  const cached = cache.get(key)
  if (cached) return cached
  const errors = [...entry.errors]
  const own = withAssetUrls(entry.spec, entry)
  let base: ResolvedTheme | undefined
  if (own.extends) {
    const parent = lookup(own.extends, entry.source)
    if (!parent) errors.push(`extends "${own.extends}", which is not a known theme`)
    else if (seen.includes(keyOf(parent.source, parent.id))) errors.push(`extends "${own.extends}", which creates a cycle`)
    else base = build(parent, [...seen, key])
  }
  if (base) errors.push(...base.errors.map((e) => `via "${base!.id}": ${e}`))
  const defaultEntry = entries.get(keyOf(BUILTIN_SOURCE, DEFAULT_THEME_ID))
  if (!base && defaultEntry && key !== keyOf(BUILTIN_SOURCE, DEFAULT_THEME_ID)) base = build(defaultEntry, [...seen, key])
  const spec = base ? mergeThemeSpecs(base.spec, own) : own
  const resolved: ResolvedTheme = { key, id: entry.id, source: entry.source, spec, errors }
  cache.set(key, resolved)
  return resolved
}

/** The theme a deck or slide asks for, falling back to the default theme when unknown. */
export function resolveTheme(id?: string, source?: string): ResolvedTheme {
  const wanted = id?.trim() || DEFAULT_THEME_ID
  const entry = lookup(wanted, source)
  if (entry) return build(entry, [])
  const fallback = build(entries.get(keyOf(BUILTIN_SOURCE, DEFAULT_THEME_ID))!, [])
  return { ...fallback, errors: [`Unknown theme "${wanted}"`, ...fallback.errors] }
}

export interface ThemeSummary {
  id: string
  source: string
  name: string
  description?: string
  frames: string[]
}

/** Themes available to decks in a source: its own themes, then built-ins it does not override. */
export function listThemes(source?: string): ThemeSummary[] {
  const seen = new Set<string>()
  const out: ThemeSummary[] = []
  const all = [...entries.values()].sort((a, b) => (a.source === source ? -1 : 0) - (b.source === source ? -1 : 0))
  for (const entry of all) {
    if (entry.source !== BUILTIN_SOURCE && entry.source !== source) continue
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    const resolved = resolveTheme(entry.id, source)
    out.push({ id: entry.id, source: entry.source, name: resolved.spec.name, description: resolved.spec.description, frames: Object.keys(resolved.spec.frames ?? {}) })
  }
  return out
}

for (const theme of BUILTIN_THEMES) registerTheme({ id: theme.id, source: BUILTIN_SOURCE, raw: theme.raw, baseUrl: '/', assets: theme.assets })

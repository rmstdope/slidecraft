/** Deck refs on disk (Part 4 §3.7–3.8): safe resolution, include globs and discovery. */
import { existsSync, statSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { deckName, type DeckRef, type PresentationInfo } from '../../shared/decks.ts'
import { getContentSource, getContentSources, getDefaultContentSource, type ContentSource } from './contentSources.ts'

/** `**\/` → any directories, `**` → anything, `*` → one segment, `?` → one character. */
export function globToRegex(glob: string): RegExp {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') {
      out += '(?:.*/)?'
      i += 2
    } else if (c === '*' && glob[i + 1] === '*') {
      out += '.*'
      i += 1
    } else if (c === '*') out += '[^/]*'
    else if (c === '?') out += '[^/]'
    else out += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`)
}

export const matchesSourceInclude = (source: ContentSource, relativePath: string): boolean =>
  source.include.some((pattern) => globToRegex(pattern).test(relativePath))

export interface ResolvedDeck {
  source: ContentSource
  deckDir: string
  mdxPath: string
}

const inside = (root: string, path: string) => path === root || path.startsWith(root + sep)

export function resolveDeckRefInSources(ref: DeckRef, sources: ContentSource[] = getContentSources()): ResolvedDeck | null {
  const source = sources.find((s) => s.id === ref.source)
  if (!source || typeof ref.path !== 'string') return null
  const path = ref.path.replace(/\\/g, '/')
  if (path === '' || path.includes('\0') || isAbsolute(path) || path.startsWith('/')) return null
  const segments = path.split('/')
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return null
  const deckDir = resolve(source.path, ...segments)
  if (!inside(source.path, deckDir)) return null
  if (!matchesSourceInclude(source, `${segments.join('/')}/index.mdx`)) return null
  return { source, deckDir, mdxPath: join(deckDir, 'index.mdx') }
}

export function resolveWritableDeckRefInSources(ref: DeckRef, sources?: ContentSource[]): { error: 'invalid' | 'read-only' } | { resolved: ResolvedDeck } {
  const resolved = resolveDeckRefInSources(ref, sources)
  if (!resolved) return { error: 'invalid' }
  if (resolved.source.readOnly) return { error: 'read-only' }
  return { resolved }
}

/** A file inside a deck folder, or null when the path escapes it. */
export function resolveDeckFile(resolved: ResolvedDeck, file: string): string | null {
  const target = resolve(resolved.deckDir, file.replace(/^\.\//, ''))
  return inside(resolved.deckDir, target) && !file.includes('\0') ? target : null
}

export const legacyDeckRef = (name: string): DeckRef => ({ source: getDefaultContentSource().id, path: name })

/** `?source&path` qualify a deck; a bare name resolves against the default source. */
export function deckRefFromUrl(url: URL, legacyName: string): DeckRef {
  return { source: url.searchParams.get('source') || getDefaultContentSource().id, path: url.searchParams.get('path') || legacyName }
}

async function walk(dir: string, found: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) await walk(full, found)
    else if (entry.name === 'index.mdx') found.push(full)
  }
}

async function latestMtime(dir: string): Promise<number> {
  let latest = 0
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      latest = Math.max(latest, entry.isDirectory() ? await latestMtime(full) : (await stat(full)).mtimeMs)
    }
  } catch {
    /* removed mid-walk */
  }
  return latest
}

export async function discoverSource(source: ContentSource): Promise<PresentationInfo[]> {
  if (!existsSync(source.path)) return []
  const files: string[] = []
  await walk(source.path, files)
  const decks: PresentationInfo[] = []
  for (const file of files.sort()) {
    const rel = relative(source.path, file).split(sep).join('/')
    if (!matchesSourceInclude(source, rel)) continue
    const path = rel.replace(/\/?index\.mdx$/, '')
    if (!path || !resolveDeckRefInSources({ source: source.id, path }, [source])) continue
    try {
      const dir = statSync(join(source.path, path))
      decks.push({
        source: source.id,
        path,
        name: deckName({ source: source.id, path }),
        createdAt: dir.birthtimeMs || dir.ctimeMs,
        updatedAt: Math.max(dir.mtimeMs, statSync(file).mtimeMs, await latestMtime(join(source.path, path))),
        readOnly: source.readOnly,
        builtIn: source.builtIn,
      })
    } catch {
      /* deck disappeared mid-walk */
    }
  }
  return decks
}

export async function discoverContentSources(sources: ContentSource[], filters: { source?: string; path?: string } = {}): Promise<PresentationInfo[]> {
  const selected = filters.source ? sources.filter((s) => s.id === filters.source) : sources
  const all = (await Promise.all(selected.map(discoverSource))).flat()
  return all
    .filter((deck) => !filters.path || deck.path.startsWith(filters.path))
    .sort((a, b) => a.source.localeCompare(b.source) || a.path.localeCompare(b.path))
}

export const discoverPresentations = (filters: { source?: string; path?: string } = {}) => discoverContentSources(getContentSources(), filters)

export { getContentSource }

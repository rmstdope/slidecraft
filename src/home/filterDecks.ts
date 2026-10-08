import type { PresentationInfo } from '@shared/decks.ts'

export type DeckSort = 'updated' | 'created' | 'alphabetical'

export interface DeckFilters {
  /** Free text over name, path and display name. */
  q: string
  /** Exact source id, or '' for all. */
  source: string
  /** Case-insensitive substring of the path. */
  path: string
  sort: DeckSort
}

export const DEFAULT_FILTERS: DeckFilters = { q: '', source: '', path: '', sort: 'updated' }

/** "quarterly-review" → "Quarterly Review" (the last path segment of nested decks). */
export function displayName(nameOrPath: string): string {
  const slug = nameOrPath.split('/').pop() ?? nameOrPath
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

const byName = (a: PresentationInfo, b: PresentationInfo) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

/** The decks the home grid shows (Part 3 §1.5 visiblePresentations). */
export function filterDecks(decks: readonly PresentationInfo[], f: DeckFilters): PresentationInfo[] {
  const q = f.q.trim().toLowerCase()
  const path = f.path.trim().toLowerCase()
  const visible = decks.filter(
    (d) =>
      (!f.source || d.source === f.source) &&
      (!path || d.path.toLowerCase().includes(path)) &&
      (!q || [d.name, d.path, displayName(d.path)].some((s) => s.toLowerCase().includes(q))),
  )
  if (f.sort === 'alphabetical') return visible.sort(byName)
  const key = f.sort === 'created' ? 'createdAt' : 'updatedAt'
  return visible.sort((a, b) => b[key] - a[key] || byName(a, b))
}

/** Filters from the home URL (`?q=&filterSource=&filterPath=&sort=`). */
export function filtersFromSearch(search: string): DeckFilters {
  const p = new URLSearchParams(search)
  const sort = p.get('sort')
  return {
    q: p.get('q') ?? '',
    source: p.get('filterSource') ?? '',
    path: p.get('filterPath') ?? '',
    sort: sort === 'created' || sort === 'alphabetical' ? sort : 'updated',
  }
}

/** The query string for the filters; empty values and the default sort are left out. */
export function searchFromFilters(f: DeckFilters): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.source) p.set('filterSource', f.source)
  if (f.path) p.set('filterPath', f.path)
  if (f.sort !== 'updated') p.set('sort', f.sort)
  const s = p.toString()
  return s ? `?${s}` : ''
}

/**
 * External edits reach the browser through this watcher (Part 4 §6). On some machines directory
 * watchers miss edits to existing files (plan §5), so file-system events are only the fast path:
 * a modification-time poll every second is the safety net. A change is broadcast only when a
 * file's mtime really changed, so the two paths never double-report.
 */
import { existsSync, statSync, watch, type FSWatcher } from 'node:fs'
import { join, sep } from 'node:path'
import { getContentSources, type ContentSource } from './contentSources.ts'
import { discoverSource, matchesSourceInclude } from './decks.ts'
import { broadcast, notifyPresentation } from './events.ts'
import { discoverThemes } from './themes.ts'

const DEBOUNCE_MS = 150
const POLL_MS = Number(process.env.SLIDECRAFT_WATCH_POLL_MS ?? 1000)
const RESCAN_EVERY = 5 // polls between full rescans for new or removed decks

interface Tracked {
  mtime: number
  kind: 'deck' | 'theme'
  source: string
  path: string
}

const watchers: FSWatcher[] = []
const tracked = new Map<string, Tracked>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let poller: ReturnType<typeof setInterval> | undefined
let polls = 0

const mtimeOf = (file: string): number | undefined => {
  try {
    return statSync(file).mtimeMs
  } catch {
    return undefined
  }
}

function debounce(key: string, fn: () => void) {
  clearTimeout(timers.get(key))
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key)
      fn()
    }, DEBOUNCE_MS),
  )
}

/** Compare one tracked file's mtime and broadcast when it changed. */
function check(file: string): void {
  const entry = tracked.get(file)
  if (!entry) return
  const mtime = mtimeOf(file)
  if (mtime === undefined) {
    tracked.delete(file)
    if (entry.kind === 'deck') notifyPresentation('presentation-deleted', { source: entry.source, path: entry.path })
    else broadcast({ type: 'themes-updated', source: entry.source, timestamp: Date.now() })
    return
  }
  if (mtime === entry.mtime) return
  entry.mtime = mtime
  if (entry.kind === 'deck') notifyPresentation('presentation-updated', { source: entry.source, path: entry.path })
  else broadcast({ type: 'themes-updated', source: entry.source, timestamp: Date.now() })
}

/** Find decks and themes in a source; start tracking new ones (announcing them unless initial). */
async function scan(source: ContentSource, announce: boolean): Promise<void> {
  for (const deck of await discoverSource(source)) {
    const file = join(source.path, deck.path, 'index.mdx')
    if (tracked.has(file)) continue
    tracked.set(file, { mtime: mtimeOf(file) ?? 0, kind: 'deck', source: source.id, path: deck.path })
    if (announce) notifyPresentation('presentation-created', deck)
  }
  for (const theme of discoverThemes(source)) {
    const file = join(source.path, 'themes', theme.id, 'theme.json')
    if (tracked.has(file)) continue
    tracked.set(file, { mtime: mtimeOf(file) ?? 0, kind: 'theme', source: source.id, path: theme.id })
    if (announce) broadcast({ type: 'themes-updated', source: source.id, timestamp: Date.now() })
  }
}

function onFsEvent(source: ContentSource, filename: string | null): void {
  if (!filename) return
  const rel = filename.split(sep).join('/')
  const file = join(source.path, rel)
  if (tracked.has(file)) return debounce(file, () => check(file))
  // Unknown path: a new deck or theme, or a change inside a theme folder (assets): rescan.
  if ((rel.endsWith('/index.mdx') && matchesSourceInclude(source, rel)) || rel.startsWith('themes/')) {
    debounce(`scan:${source.id}`, () => {
      void scan(source, true)
      if (rel.startsWith('themes/') && !rel.endsWith('theme.json')) broadcast({ type: 'themes-updated', source: source.id, timestamp: Date.now() })
    })
  }
}

export async function startFileWatcher(): Promise<void> {
  for (const source of getContentSources()) {
    if (!existsSync(source.path)) continue
    await scan(source, false)
    try {
      watchers.push(watch(source.path, { recursive: true }, (_event, filename) => onFsEvent(source, filename ? String(filename) : null)))
    } catch (error) {
      console.warn(`Watching ${source.path} failed (polling only): ${(error as Error).message}`)
    }
  }
  poller = setInterval(() => {
    for (const file of [...tracked.keys()]) check(file)
    if (++polls % RESCAN_EVERY === 0) for (const source of getContentSources()) if (existsSync(source.path)) void scan(source, true)
  }, POLL_MS)
}

export function stopFileWatcher(): void {
  watchers.splice(0).forEach((w) => w.close())
  clearInterval(poller)
  timers.forEach(clearTimeout)
  timers.clear()
  tracked.clear()
}

export async function restartFileWatcher(): Promise<void> {
  stopFileWatcher()
  await startFileWatcher()
}

/**
 * After the server writes a deck itself (it broadcasts its own event): record the file and its
 * mtime so neither the poll nor a rescan announces the same change again.
 */
export function noteOwnWrite(file: string, deck?: { source: string; path: string }): void {
  const mtime = mtimeOf(file)
  if (mtime === undefined) return
  const entry = tracked.get(file)
  if (entry) entry.mtime = mtime
  else if (deck) tracked.set(file, { mtime, kind: 'deck', source: deck.source, path: deck.path })
}

export const trackedFileCount = (): number => tracked.size


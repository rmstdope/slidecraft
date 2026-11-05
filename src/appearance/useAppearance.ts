import { useCallback, useSyncExternalStore } from 'react'
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearance,
  DARK_QUERY,
  readAppearance,
  writeAppearance,
  type Appearance,
  type ResolvedTheme,
} from './appearance'

/**
 * One store for the whole page: the person's choice, the system preference, and the theme they
 * resolve to. Changes made in another tab (the presenter window, a second deck) arrive through the
 * storage event.
 */
interface Snapshot {
  appearance: Appearance
  theme: ResolvedTheme
}

const listeners = new Set<() => void>()
let snapshot: Snapshot | undefined
let started = false

const media = (): MediaQueryList | undefined =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : undefined

function refresh(appearance: Appearance = readAppearance()): void {
  const theme = applyAppearance(document.documentElement, appearance, media()?.matches ?? false)
  snapshot = { appearance, theme }
  for (const l of listeners) l()
}

function start(): void {
  if (started || typeof window === 'undefined') return
  started = true
  media()?.addEventListener('change', () => refresh(snapshot?.appearance))
  window.addEventListener('storage', (e) => {
    if (e.key === APPEARANCE_STORAGE_KEY || e.key === null) refresh()
  })
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): Snapshot {
  if (!snapshot) refresh()
  return snapshot!
}

/** Applies a new appearance at once and remembers it in this browser. */
export function setAppearance(next: Appearance): void {
  writeAppearance(next)
  refresh(next)
}

/** Call once at start-up so the attributes follow system changes before any page subscribes. */
export function startAppearance(): void {
  start()
  refresh()
}

export function useAppearance(): Snapshot & { update: (patch: Partial<Appearance>) => void } {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const update = useCallback((patch: Partial<Appearance>) => setAppearance({ ...getSnapshot().appearance, ...patch }), [])
  return { ...current, update }
}

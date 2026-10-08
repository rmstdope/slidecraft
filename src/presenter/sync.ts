/**
 * Cross-window sync (Part 5 §B.3–B.4) through one BroadcastChannel per deck: navigation, the
 * presenter's pointer and live annotation strokes. localStorage keeps what must survive a reload.
 */
import type { DeckRef } from '@shared/decks.ts'
import type { Annotation, Point } from '../drawing/types'

export type SyncMessage =
  | { type: 'hello' }
  | { type: 'nav'; current: number; step: number }
  | { type: 'pointer'; slideIndex: number; point: Point | null }
  | { type: 'annotation-preview'; slideIndex: number; annotation: Annotation | null }

/** Identity shared by audience and presenter windows: source and path, so equal slugs never mix. */
export function deckSyncKey(deck: DeckRef | undefined): string {
  if (deck) return `${deck.source}:${deck.path}`
  return typeof window === 'undefined' ? 'deck' : window.location.pathname
}

export const storageKeys = (deckKey: string) => ({
  timer: `slidecraft-timer-${deckKey}`,
  annotations: `slidecraft-annotations-${deckKey}`,
})

const isPoint = (p: unknown): p is Point => !!p && typeof (p as Point).x === 'number' && typeof (p as Point).y === 'number'

/** Validates an incoming envelope; anything for another deck or of unknown shape is dropped. */
export function parseSyncMessage(data: unknown, deckKey: string): SyncMessage | null {
  if (!data || typeof data !== 'object') return null
  const { deck, message } = data as { deck?: unknown; message?: Record<string, unknown> }
  if (deck !== deckKey || !message || typeof message !== 'object') return null
  switch (message.type) {
    case 'hello':
      return { type: 'hello' }
    case 'nav':
      return typeof message.current === 'number' && typeof message.step === 'number' ? { type: 'nav', current: message.current, step: message.step } : null
    case 'pointer':
      return typeof message.slideIndex === 'number' && (message.point === null || isPoint(message.point))
        ? { type: 'pointer', slideIndex: message.slideIndex, point: message.point as Point | null }
        : null
    case 'annotation-preview':
      return typeof message.slideIndex === 'number' && (message.annotation === null || typeof message.annotation === 'object')
        ? { type: 'annotation-preview', slideIndex: message.slideIndex, annotation: message.annotation as Annotation | null }
        : null
    default:
      return null
  }
}

export interface SyncChannel {
  post(message: SyncMessage): void
  subscribe(listener: (message: SyncMessage) => void): () => void
  close(): void
}

/** A channel for one deck; a no-op where BroadcastChannel does not exist. */
export function createSyncChannel(deckKey: string): SyncChannel {
  const listeners = new Set<(message: SyncMessage) => void>()
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(`slidecraft-sync-${deckKey}`)
  if (channel) {
    channel.onmessage = (event) => {
      const message = parseSyncMessage(event.data, deckKey)
      if (message) listeners.forEach((l) => l(message))
    }
  }
  let closed = false
  return {
    post(message) {
      if (closed) return
      try {
        channel?.postMessage({ deck: deckKey, message })
      } catch {
        /* closed underneath us */
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    // Children unmount after their parent's cleanup ran; their farewell messages (pointer gone,
    // stroke cancelled) still go out because the channel closes a tick later.
    close() {
      listeners.clear()
      setTimeout(() => {
        closed = true
        channel?.close()
      }, 0)
    },
  }
}

export function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode or quota: sync still works through the channel */
  }
}

/** Calls `fn` at most once per `ms`, always with the latest arguments (trailing call included). */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: A | undefined
  const run = () => {
    last = Date.now()
    timer = undefined
    if (pending) fn(...pending)
    pending = undefined
  }
  const call = (...args: A) => {
    pending = args
    const wait = ms - (Date.now() - last)
    if (wait <= 0) run()
    else timer ??= setTimeout(run, wait)
  }
  call.cancel = () => {
    clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  return call
}

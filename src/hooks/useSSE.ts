/**
 * One shared EventSource per page (Part 3 §1.10): browsers allow only six HTTP/1.1 connections per
 * origin, so one stream per thumbnail would starve the page. Disabled in static builds.
 */
import { useEffect, useRef } from 'react'
import type { DeckRef } from '@shared/decks.ts'
import { appPath, IS_STATIC } from '../basePath'

export interface ServerMessage {
  type: string
  source?: string
  path?: string
  name?: string
  [key: string]: unknown
}

type Listener = (message: ServerMessage) => void

const listeners = new Set<Listener>()
let source: EventSource | null = null

function connect() {
  if (source || IS_STATIC || typeof EventSource === 'undefined') return
  source = new EventSource(appPath('/api/events'))
  source.onmessage = (event) => {
    let message: ServerMessage
    try {
      message = JSON.parse(event.data) as ServerMessage
    } catch {
      return
    }
    listeners.forEach((listener) => listener(message))
  }
  source.onerror = () => {
    /* EventSource reconnects by itself */
  }
}

export function subscribeServerEvents(listener: Listener): () => void {
  listeners.add(listener)
  connect()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      source?.close()
      source = null
    }
  }
}

const DECK_EVENTS = new Set(['presentation-updated', 'presentation-created'])
const DEBOUNCE_MS = 300

/** Call `onUpdated` (debounced) when the given deck changes on disk. */
export function useSSE(deck: DeckRef | undefined, onUpdated: () => void): void {
  const callback = useRef(onUpdated)
  callback.current = onUpdated
  const key = deck ? `${deck.source}:${deck.path}` : ''
  useEffect(() => {
    if (!deck) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeServerEvents((message) => {
      if (!DECK_EVENTS.has(message.type) || message.source !== deck.source || message.path !== deck.path) return
      clearTimeout(timer)
      timer = setTimeout(() => callback.current(), DEBOUNCE_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [key])
}

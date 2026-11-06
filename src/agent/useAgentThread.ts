import { useCallback, useEffect, useRef, useState } from 'react'
import type { AgentBackendId, AgentBackendInfo, AgentEvent, MessageContext, ThreadInfo, ThreadTarget } from '@shared/agent.ts'
import type { DeckRef } from '@shared/decks.ts'
import { subscribeServerEvents } from '../hooks/useSSE'
import * as api from './api'
import { addEvent } from './threadEvents'

/** Put a thread first-by-recency in the list, replacing an older copy. */
const upsert = (list: ThreadInfo[], info: ThreadInfo): ThreadInfo[] => [info, ...list.filter((t) => t.id !== info.id)].sort((a, b) => b.updatedAt - a.updatedAt)

export interface AgentThreadState {
  backends: AgentBackendInfo[] | null
  threads: ThreadInfo[]
  thread: ThreadInfo | null
  events: AgentEvent[]
  error?: string
  sending: boolean
  select(id: string | null): void
  /** `backend` applies when the message starts a new conversation. */
  send(text: string, context?: MessageContext, backend?: AgentBackendId): Promise<boolean>
  stop(): void
  answer(approvalId: string, allow: boolean): void
}

/**
 * One conversation of a deck (or of the vault when `deck` is absent): the thread list, the shown
 * thread's events kept live from the shared SSE stream, and the actions. The most recent thread
 * opens by itself; a new one is created with the first message.
 */
export function useAgentThread(vault: string, deck: DeckRef | undefined, onEvent?: (event: AgentEvent) => void, target?: ThreadTarget): AgentThreadState {
  const [backends, setBackends] = useState<AgentBackendInfo[] | null>(null)
  const [threads, setThreads] = useState<ThreadInfo[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>([])
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)
  const idRef = useRef<string | null>(null)
  idRef.current = threadId
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const deckPath = deck?.path
  const targetKey = target ? `${target.kind}:${target.name}` : ''
  const targetRef = useRef(target)
  targetRef.current = target
  /** Whether a thread belongs in this list: the deck's, the target's, or the vault's own. */
  const belongs = useCallback(
    (t: ThreadInfo) => {
      const want = targetRef.current
      if (want) return t.target?.kind === want.kind && t.target.name === want.name
      return deckPath ? t.deck?.path === deckPath : !t.deck && !t.target
    },
    [deckPath, targetKey],
  )

  // The thread list, opening the most recent thread.
  useEffect(() => {
    let live = true
    void api.fetchBackends().then((r) => live && setBackends(r.data ?? []))
    void api.fetchThreads(vault, deckPath ? { source: vault, path: deckPath } : undefined, targetRef.current).then((r) => {
      if (!live) return
      const list = (r.data ?? []).filter(belongs)
      setThreads(list)
      setThreadId((current) => current ?? list[0]?.id ?? null)
    })
    return () => {
      live = false
    }
  }, [vault, deckPath, belongs])

  const load = useCallback(
    (id: string) =>
      void api.fetchThread(vault, id).then((r) => {
        if (idRef.current !== id) return
        if (r.data) {
          const { events: stored, ...info } = r.data
          setEvents(stored)
          setThreads((list) => upsert(list, info))
        } else setError(r.error)
      }),
    [vault],
  )

  useEffect(() => {
    setEvents([])
    setError(undefined)
    if (threadId) load(threadId)
  }, [threadId, load])

  // Live events; after a reconnect, reload the thread in case events were missed.
  useEffect(
    () =>
      subscribeServerEvents((message) => {
        if (message.type === 'connected' && idRef.current) load(idRef.current)
        if (message.type === 'agent-event' && message.thread === idRef.current) {
          const event = message.event as AgentEvent
          setEvents((list) => addEvent(list, event))
          onEventRef.current?.(event)
        }
        if (message.type === 'agent-thread') {
          const info = message.thread as ThreadInfo
          if (info.vault !== vault || !belongs(info)) return
          setThreads((list) => upsert(list, info))
        }
      }),
    [vault, belongs, load],
  )

  const send = useCallback(
    async (text: string, context?: MessageContext, backend?: AgentBackendId) => {
      setSending(true)
      setError(undefined)
      let id = idRef.current
      if (!id) {
        const created = await api.createThread(vault, deckPath ? { source: vault, path: deckPath } : undefined, backend, targetRef.current)
        if (!created.data) {
          setSending(false)
          setError(created.error)
          return false
        }
        id = created.data.id
        idRef.current = id
        setThreads((list) => upsert(list, created.data!))
        setThreadId(id)
      }
      const sent = await api.sendMessage(vault, id, text, context)
      setSending(false)
      if (!sent.data) setError(sent.error)
      else setThreads((list) => upsert(list, sent.data!))
      return !!sent.data
    },
    [vault, deckPath, targetKey],
  )

  const thread = threads.find((t) => t.id === threadId) ?? null
  return {
    backends,
    threads,
    thread,
    events,
    error,
    sending,
    select: setThreadId,
    send,
    stop: () => threadId && void api.stopThread(vault, threadId),
    answer: (approvalId, allow) => threadId && void api.answerApproval(vault, threadId, approvalId, allow).then((r) => r.error && setError(r.error)),
  }
}

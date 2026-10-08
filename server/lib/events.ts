/** Server-Sent Events (Part 4 §6): one stream per browser tab, heartbeat every 5 s, no replay. */
import { deckName, type DeckRef } from '../../shared/decks.ts'
import { corsHeaders } from './http.ts'

export type ServerEvent =
  | { type: 'connected'; timestamp: number }
  | { type: 'presentation-updated' | 'presentation-created' | 'presentation-deleted'; source: string; path: string; name: string; timestamp: number }
  | { type: 'themes-updated'; source: string; timestamp: number }
  | { type: 'chat-tool-call'; conversationId: string; toolCall: unknown; timestamp: number }
  | { type: 'chat-iteration'; conversationId: string; iteration: number; maxIterations: number; timestamp: number }

type Client = ReadableStreamDefaultController<Uint8Array>

const clients = new Set<Client>()
const encoder = new TextEncoder()
const HEARTBEAT_MS = 5000

const frame = (event: unknown) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`)

function send(client: Client, chunk: Uint8Array): boolean {
  try {
    client.enqueue(chunk)
    return true
  } catch {
    clients.delete(client)
    return false
  }
}

export function broadcast(event: ServerEvent): void {
  const chunk = frame(event)
  for (const client of [...clients]) send(client, chunk)
}

export const clientCount = (): number => clients.size

export function eventsResponse(): Response {
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let self: Client | undefined
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      self = controller
      clients.add(controller)
      send(controller, frame({ type: 'connected', timestamp: Date.now() }))
      heartbeat = setInterval(() => {
        if (!send(controller, encoder.encode(': ping\n\n'))) clearInterval(heartbeat)
      }, HEARTBEAT_MS)
    },
    cancel() {
      clearInterval(heartbeat)
      if (self) clients.delete(self)
    },
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...corsHeaders },
  })
}

export function notifyPresentation(type: 'presentation-updated' | 'presentation-created' | 'presentation-deleted', ref: DeckRef): void {
  broadcast({ type, source: ref.source, path: ref.path, name: deckName(ref), timestamp: Date.now() })
}

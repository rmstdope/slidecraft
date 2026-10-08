import type { ChatRequest, ChatResponse } from '@shared/chat.ts'
import { deckName, type DeckRef } from '@shared/decks.ts'
import { appPath } from '../basePath'

/** POST /api/chat; throws with the server's message on failure. */
export async function sendChat(request: ChatRequest): Promise<ChatResponse> {
  const res = await fetch(appPath('/api/chat'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  const body = (await res.json().catch(() => ({}))) as ChatResponse & { error?: string; details?: string }
  if (!res.ok) throw new Error(body.details ? `${body.error}: ${body.details}` : (body.error ?? `HTTP ${res.status}`))
  return body
}

export type ApplyFixResult = { success: true } | { success: false; message: string }

/** Replace one slide by hand, bypassing the model (Part 5 §A.5). */
export async function applyFix(deck: DeckRef, slideIndex: number, content: string): Promise<ApplyFixResult> {
  try {
    const res = await fetch(appPath('/api/apply-fix'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ presentationName: deckName(deck), deck, slideIndex, content }),
    })
    const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; details?: string; validationError?: { message: string } }
    if (res.ok && body.success) return { success: true }
    return { success: false, message: body.validationError?.message ?? body.details ?? body.error ?? `HTTP ${res.status}` }
  } catch (error) {
    return { success: false, message: (error as Error).message }
  }
}

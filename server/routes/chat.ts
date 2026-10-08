/** POST /api/chat (Part 5 §A.4, §A.6): one JSON request, one JSON response; progress over SSE. */
import type { ChatRequest, ChatResponse } from '../../shared/chat.ts'
import type { DeckRef } from '../../shared/decks.ts'
import { buildAgentContext, buildSystemPrompt, type DeckContext } from '../lib/chat/prompt.ts'
import { runClaudeCode, runCopilot } from '../lib/chat/cliProviders.ts'
import { httpConfig, openAiCaller, runHttpChat } from '../lib/chat/httpProvider.ts'
import { getDefaultContentSource } from '../lib/contentSources.ts'
import { legacyDeckRef, resolveDeckRefInSources } from '../lib/decks.ts'
import { readDeckSource } from '../lib/deckStore.ts'
import { broadcast } from '../lib/events.ts'
import { errorJson, json, readJson, readOnlyError } from '../lib/http.ts'

const isRef = (v: unknown): v is DeckRef => !!v && typeof (v as DeckRef).source === 'string' && typeof (v as DeckRef).path === 'string'

export async function handleChat(request: Request): Promise<Response> {
  const body = await readJson<ChatRequest>(request)
  if (!body || !Array.isArray(body.messages)) return errorJson(400, 'messages must be an array')
  const messages = body.messages.filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string')
  const last = [...messages].reverse().find((m) => m.role === 'user')
  if (!last) return errorJson(400, 'No user message')

  // The deck being discussed, if any.
  let ref: DeckRef | undefined
  if (isRef(body.deck)) ref = body.deck
  else if (typeof body.presentationName === 'string' && body.presentationName) ref = legacyDeckRef(body.presentationName)
  const resolved = ref ? resolveDeckRefInSources(ref) : null
  if (ref && !resolved) return errorJson(400, 'Invalid presentation reference', 'invalid_presentation')
  const source = resolved?.source ?? getDefaultContentSource()
  if (source.readOnly) return readOnlyError(source.id)
  const deck: DeckContext | null =
    ref && resolved
      ? {
          ref,
          source: await readDeckSource(resolved),
          currentSlideIndex: Number.isInteger(body.currentSlideIndex) && body.currentSlideIndex! >= 0 ? body.currentSlideIndex : undefined,
          contentDir: source.path,
        }
      : null

  const provider = body.provider ?? 'http'
  try {
    let response: ChatResponse
    if (provider === 'claude-code' || provider === 'copilot') {
      if (typeof body.conversationId !== 'string' || !body.conversationId) return errorJson(400, 'conversationId is required for CLI providers')
      const input = {
        message: last.content,
        conversationId: body.conversationId,
        cwd: source.path,
        contextPrompt: await buildAgentContext(deck, source.path),
        deck: ref,
        sourceId: source.id,
      }
      response = provider === 'claude-code' ? await runClaudeCode(input) : await runCopilot(input)
    } else {
      const conversationId = body.conversationId
      response = await runHttpChat({
        systemPrompt: await buildSystemPrompt(deck, source.path),
        history: messages,
        deck: ref,
        conversationId,
        callModel: openAiCaller(httpConfig()),
        onIteration: (iteration, maxIterations) =>
          conversationId && broadcast({ type: 'chat-iteration', conversationId, iteration, maxIterations, timestamp: Date.now() }),
        onToolCall: (toolCall) => conversationId && broadcast({ type: 'chat-tool-call', conversationId, toolCall, timestamp: Date.now() }),
      })
    }
    return json(response)
  } catch (error) {
    return errorJson(500, (error as Error).message)
  }
}


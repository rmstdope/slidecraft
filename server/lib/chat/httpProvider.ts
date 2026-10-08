/**
 * The HTTP provider (Part 5 §A.6.1, §A.7): an OpenAI-compatible chat-completions endpoint and a
 * server-side tool loop over the deck tools. Progress goes out as SSE events.
 */
import type { ChatResponse, ChatToolCall, ChatValidationError, ChatMessage } from '../../../shared/chat.ts'
import { deckName, type DeckRef } from '../../../shared/decks.ts'
import { readConfig } from '../paths.ts'
import { executeTool, TOOL_DEFINITIONS, toolDeckRef, type ToolResult } from '../tools.ts'

export const MAX_ITERATIONS = 30

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  tool_call_id?: string
}

export interface ModelReply {
  message: ApiMessage
  finish_reason?: string
}

export type CallModel = (messages: ApiMessage[], tools: unknown[]) => Promise<ModelReply>

export interface HttpConfig {
  url: string
  model: string
  apiKey: string | undefined
}

/** Env wins over the config file's `ai` block; the key only ever comes from the environment. */
export function httpConfig(env = process.env, config = readConfig() as { ai?: { url?: string; model?: string } }): HttpConfig {
  return {
    url: env.SLIDECRAFT_AI_URL ?? config.ai?.url ?? 'https://api.openai.com/v1/chat/completions',
    model: env.SLIDECRAFT_AI_MODEL ?? config.ai?.model ?? 'gpt-4.1',
    apiKey: env.AI_API_KEY ?? env.OPENAI_API_KEY,
  }
}

export function openAiCaller(config: HttpConfig, fetchImpl: typeof fetch = fetch): CallModel {
  return async (messages, tools) => {
    if (!config.apiKey) throw new Error('AI_API_KEY environment variable is required for the AI API provider')
    const res = await fetchImpl(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, tools, tool_choice: 'auto' }),
    })
    if (!res.ok) throw new Error(`AI API error ${res.status}: ${(await res.text()).slice(0, 500)}`)
    const body = (await res.json()) as { choices?: ModelReply[] }
    const choice = body.choices?.[0]
    if (!choice?.message) throw new Error('AI API returned no message')
    return choice
  }
}

export const apiTools = () =>
  TOOL_DEFINITIONS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }))

const MUTATING = new Set(TOOL_DEFINITIONS.filter((t) => t.mutates).map((t) => t.name))

export interface HttpChatInput {
  systemPrompt: string
  history: ChatMessage[]
  deck?: DeckRef
  conversationId?: string
  callModel: CallModel
  runTool?: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
  onIteration?: (iteration: number, max: number) => void
  onToolCall?: (call: ChatToolCall) => void
  maxIterations?: number
}

/** The agentic loop: call the model, run its tool calls, feed results back, until it answers. */
export async function runHttpChat(input: HttpChatInput): Promise<ChatResponse> {
  const max = input.maxIterations ?? MAX_ITERATIONS
  const runTool = input.runTool ?? ((name, args) => executeTool(name, args, { deck: input.deck }))
  const messages: ApiMessage[] = [{ role: 'system', content: input.systemPrompt }, ...input.history.map((m) => ({ role: m.role, content: m.content }))]
  const tools = apiTools()
  const log: ChatToolCall[] = []
  // Keyed by slide: a later retry on the same slide replaces the earlier failure.
  const failures = new Map<string, ChatValidationError>()
  let modified: DeckRef | undefined

  const done = (message: string, error?: string): ChatResponse => ({
    message,
    ...(log.length ? { toolCalls: log } : {}),
    ...(modified ? { modifiedPresentation: deckName(modified), modifiedDeck: modified } : {}),
    ...(failures.size ? { validationErrors: [...failures.values()] } : {}),
    ...(error ? { error } : {}),
  })

  for (let iteration = 1; iteration <= max; iteration++) {
    input.onIteration?.(iteration, max)
    const reply = await input.callModel(messages, tools)
    messages.push(reply.message)
    const calls = reply.message.tool_calls ?? []
    if (calls.length === 0) return done(reply.message.content ?? '')

    for (const call of calls) {
      let args: Record<string, unknown> = {}
      try {
        const parsed: unknown = JSON.parse(call.function.arguments || '{}')
        if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>
      } catch {
        /* the model sent broken JSON: run with no arguments and let the tool complain */
      }
      const name = call.function.name
      const result = await runTool(name, args)
      const entry: ChatToolCall = { tool: name, args, result: result.success ? 'success' : 'error', ...(result.data !== undefined ? { data: result.data } : {}), ...(result.error ? { error: result.error } : {}) }
      log.push(entry)
      input.onToolCall?.(entry)

      const slideKey = typeof args.index === 'number' ? String(args.index) : 'unknown'
      if (result.success) {
        if (MUTATING.has(name) && typeof args.name === 'string') modified = toolDeckRef(args.name, { deck: input.deck })
        failures.delete(slideKey)
      } else if (result.error?.includes('Validation failed')) {
        failures.set(slideKey, {
          tool: name,
          ...(typeof args.index === 'number' ? { slideIndex: args.index } : {}),
          error: result.error,
          ...(typeof args.content === 'string' ? { failedContent: args.content } : {}),
        })
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }
  }
  return done(
    failures.size
      ? 'The AI ran into validation errors it could not resolve. Review the errors below and fix them by hand.'
      : 'Maximum iterations reached. Please try again with a simpler request.',
    'max_iterations',
  )
}

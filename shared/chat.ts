/** The chat contract between the chat page and `POST /api/chat` (Part 5 §A.4). */
import type { DeckRef } from './decks.ts'

export type ChatProvider = 'http' | 'claude-code' | 'copilot'
export const CHAT_PROVIDERS: { id: ChatProvider; label: string; hint: string }[] = [
  { id: 'http', label: 'AI API', hint: 'Any OpenAI-compatible endpoint; the server runs the tool loop' },
  { id: 'claude-code', label: 'Claude Code', hint: 'The claude CLI edits the files itself' },
  { id: 'copilot', label: 'Copilot CLI', hint: 'The copilot CLI edits the files itself' },
]

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatToolCall {
  tool: string
  args: Record<string, unknown>
  result: 'success' | 'error'
  data?: unknown
  error?: string
}

export interface ChatValidationError {
  tool: string
  slideIndex?: number
  error: string
  /** The slide the model tried to write, for manual repair. */
  failedContent?: string
}

export interface ChatRequest {
  messages: ChatMessage[]
  deck?: DeckRef
  presentationName?: string
  /** 0-based slide the user is looking at. */
  currentSlideIndex?: number
  provider?: ChatProvider
  /** Required for the CLI providers: their sessions are keyed by it. */
  conversationId?: string
}

export interface ChatResponse {
  message: string
  toolCalls?: ChatToolCall[]
  /** Deck whose file changed; the chat page switches its preview to it. */
  modifiedPresentation?: string
  /** The deck ref of `modifiedPresentation`, when known. */
  modifiedDeck?: DeckRef
  error?: string
  validationErrors?: ChatValidationError[]
}

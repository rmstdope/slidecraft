import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAT_PROVIDERS, type ChatMessage, type ChatProvider, type ChatToolCall, type ChatValidationError } from '@shared/chat.ts'
import { deckName, type DeckRef } from '@shared/decks.ts'
import { subscribeServerEvents, useSSE } from '../hooks/useSSE'
import { chatUrl, presentationUrl } from '../router'
import { sendChat } from './api'
import { MessageBubble, ToolCalls, ValidationErrors, WorkingBubble } from './components'

const PROVIDER_KEY = 'slidecraft-chat-provider'

function initialProvider(): ChatProvider {
  try {
    const stored = localStorage.getItem(PROVIDER_KEY)
    if (CHAT_PROVIDERS.some((p) => p.id === stored)) return stored as ChatProvider
  } catch {
    /* storage unavailable */
  }
  return 'http'
}

const newConversationId = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)

/** The chat assistant (Part 5 §A.2): conversation on the left, the deck's live preview on the right. */
export default function ChatPage({ deck: initialDeck, onExit }: { deck?: DeckRef; onExit(): void }) {
  const [deck, setDeck] = useState<DeckRef | undefined>(initialDeck)
  const [provider, setProvider] = useState<ChatProvider>(initialProvider)
  const [conversationId, setConversationId] = useState(newConversationId)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  // Keyed by the index of the user message that produced them.
  const [toolCalls, setToolCalls] = useState<Map<number, ChatToolCall[]>>(new Map())
  const [validation, setValidation] = useState<Map<number, ChatValidationError[]>>(new Map())
  const [liveCalls, setLiveCalls] = useState<ChatToolCall[]>([])
  const [liveIteration, setLiveIteration] = useState<{ iteration: number; maxIterations: number } | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const loadingRef = useRef(false)
  loadingRef.current = loading

  const previewUrl = deck ? presentationUrl(deck) : null

  useEffect(() => inputRef.current?.focus(), [])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, liveCalls, loading])

  const adoptDeck = useCallback((next: DeckRef) => {
    setDeck(next)
    window.history.replaceState(null, '', chatUrl(next))
  }, [])

  /** Reload the preview, keeping the slide it shows. */
  const refreshPreview = useCallback(() => {
    const frame = frameRef.current
    let hash = ''
    try {
      hash = frame?.contentWindow?.location.hash ?? ''
    } catch {
      /* cross-origin */
    }
    if (frame && previewUrl) frame.src = `${previewUrl}${hash}`
    else setPreviewKey((k) => k + 1)
  }, [previewUrl])

  /** The 0-based slide shown in the preview, from its URL hash. */
  const currentSlideIndex = (): number | undefined => {
    try {
      const hash = frameRef.current?.contentWindow?.location.hash ?? ''
      const match = /^#slide-(\d+)/.exec(hash)
      return match ? Number(match[1]) - 1 : 0
    } catch {
      return undefined
    }
  }

  // The open deck changed on disk (an agent saved it): refresh the preview.
  useSSE(deck, refreshPreview)

  // Progress of this conversation's request; and a deck an agent creates becomes the open deck.
  useEffect(
    () =>
      subscribeServerEvents((event) => {
        if (event.type === 'chat-iteration' && event.conversationId === conversationId) {
          setLiveIteration({ iteration: event.iteration as number, maxIterations: event.maxIterations as number })
        } else if (event.type === 'chat-tool-call' && event.conversationId === conversationId) {
          setLiveCalls((calls) => [...calls, event.toolCall as ChatToolCall])
        } else if (event.type === 'presentation-created' && !deck && loadingRef.current && event.source && event.path) {
          adoptDeck({ source: event.source, path: event.path })
        }
      }),
    [conversationId, deck, adoptDeck],
  )

  const chooseProvider = (next: ChatProvider) => {
    if (next === provider) return
    try {
      localStorage.setItem(PROVIDER_KEY, next)
    } catch {
      /* storage unavailable */
    }
    setProvider(next)
    setMessages([])
    setToolCalls(new Map())
    setValidation(new Map())
    setConversationId(newConversationId())
  }

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userIndex = messages.length
    const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(history)
    setInput('')
    setLoading(true)
    setLiveCalls([])
    setLiveIteration(null)
    try {
      const res = await sendChat({ messages: history, deck, currentSlideIndex: deck ? currentSlideIndex() : undefined, provider, conversationId })
      setMessages((m) => [...m, { role: 'assistant', content: res.message || (res.error ? `Error: ${res.error}` : 'Done') }])
      if (res.toolCalls?.length) setToolCalls((map) => new Map(map).set(userIndex, res.toolCalls!))
      if (res.validationErrors?.length) setValidation((map) => new Map(map).set(userIndex, res.validationErrors!))
      if (res.modifiedDeck && (!deck || res.modifiedDeck.source !== deck.source || res.modifiedDeck.path !== deck.path)) adoptDeck(res.modifiedDeck)
      else if (res.modifiedPresentation) refreshPreview()
    } catch (error) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${(error as Error).message}` }])
    } finally {
      setLoading(false)
      setLiveCalls([])
      setLiveIteration(null)
      inputRef.current?.focus()
    }
  }

  const resize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(200, el.scrollHeight)}px`
  }

  const removeError = (userIndex: number, fixed: ChatValidationError) =>
    setValidation((map) => {
      const next = new Map(map)
      const left = (next.get(userIndex) ?? []).filter((e) => e !== fixed)
      if (left.length) next.set(userIndex, left)
      else next.delete(userIndex)
      return next
    })

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-header__left">
          <button type="button" className="tool-button" onClick={onExit}>
            ← Exit
          </button>
          <h1>Chat</h1>
        </div>
        <div className="chat-providers" role="radiogroup" aria-label="AI provider">
          {CHAT_PROVIDERS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={provider === p.id} className={provider === p.id ? 'is-active' : ''} title={p.hint} disabled={loading} onClick={() => chooseProvider(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="chat-header__right">{deck && <span>Editing: <strong>{deckName(deck)}</strong></span>}</div>
      </header>

      <div className="chat-body">
        <section className="chat-panel">
          <div ref={listRef} className="chat-messages">
            {messages.length === 0 && !loading && (
              <div className="chat-empty">
                <div className="chat-empty__icon" aria-hidden>
                  💬
                </div>
                <h2>{deck ? `Editing "${deckName(deck)}"` : 'Start a conversation'}</h2>
                <p>
                  {deck
                    ? 'Ask me to modify slides, change themes, add content, or reorganize your presentation.'
                    : 'Tell me about the presentation you want to create, or open an existing one to edit.'}
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-row is-${m.role}`}>
                <MessageBubble role={m.role} content={m.content} />
                {m.role === 'assistant' && toolCalls.get(i - 1) && <ToolCalls calls={toolCalls.get(i - 1)!} />}
                {m.role === 'assistant' && validation.get(i - 1) && <ValidationErrors deck={deck} errors={validation.get(i - 1)!} onFixed={(e) => removeError(i - 1, e)} />}
              </div>
            ))}
            {loading && <WorkingBubble iteration={liveIteration} calls={liveCalls} />}
          </div>
          <div className="chat-input">
            <div className="chat-input__row">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                disabled={loading}
                placeholder={deck ? 'Ask me to modify your presentation...' : 'Describe the presentation you want to create...'}
                onChange={(e) => {
                  setInput(e.target.value)
                  resize(e.target)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
              />
              <button type="button" className="chat-send" disabled={!input.trim() || loading} onClick={() => void send()} aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />
                </svg>
              </button>
            </div>
            <p className="chat-input__hint">Press Enter to send, Shift+Enter for a new line</p>
          </div>
        </section>

        <section className="chat-preview">
          <div className="chat-preview__header">
            <span>Preview</span>
            {previewUrl && (
              <button type="button" className="tool-button" onClick={refreshPreview}>
                Refresh
              </button>
            )}
          </div>
          {previewUrl ? (
            <iframe key={`${previewUrl}-${previewKey}`} ref={frameRef} className="chat-preview__frame" src={previewUrl} title="Presentation preview" />
          ) : (
            <div className="chat-preview__empty">Preview will appear when a presentation is created</div>
          )}
        </section>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentEvent, MessageContext } from '@shared/agent.ts'
import { deckName, type DeckRef } from '@shared/decks.ts'
import { pendingApproval, toTurns, type Turn, type TurnItem } from './threadEvents'
import { useAgentThread } from './useAgentThread'

interface Props {
  vault: string
  /** The deck the conversation is about; absent for a vault-level conversation. */
  deck?: DeckRef
  /** What is on screen when a message is sent (slide, selection). */
  getContext?: () => MessageContext | undefined
  /** The agent wrote a deck file (a vault-level conversation creating a deck). */
  onDeckWritten?: (deck: DeckRef) => void
  /** A turn started or ended (the editor locks while the agent works). */
  onRunningChange?: (running: boolean) => void
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** The agent conversation panel (UX overhaul U2): streamed text, tool calls, approvals, stop. */
export function AgentChat({ vault, deck, getContext, onDeckWritten, onRunningChange }: Props) {
  const onEvent = (event: AgentEvent) => {
    if (event.type !== 'file-changed' || !onDeckWritten) return
    const match = /^(.+)\/index\.mdx$/.exec(event.path)
    if (match) onDeckWritten({ source: vault, path: match[1] })
  }
  const state = useAgentThread(vault, deck, onEvent)
  const { backends, threads, thread, events, error, sending } = state
  const turns = useMemo(() => toTurns(events), [events])
  const running = !!thread?.running || sending
  const waiting = pendingApproval(turns)
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => onRunningChange?.(running), [running, onRunningChange])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [events])

  const claude = backends?.find((b) => b.id === 'claude-code')
  const unavailable = backends !== null && !claude?.available

  const send = async () => {
    const text = input.trim()
    if (!text || running) return
    setInput('')
    if (!(await state.send(text, getContext?.()))) setInput(text)
    inputRef.current?.focus()
  }

  return (
    <section className="agent-chat" aria-label="Agent conversation">
      <div className="agent-chat__bar">
        <select
          className="agent-chat__threads"
          aria-label="Conversation"
          value={thread?.id ?? ''}
          disabled={running}
          onChange={(e) => state.select(e.target.value || null)}
        >
          <option value="">New conversation</option>
          {threads.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} · {when(t.updatedAt)}
            </option>
          ))}
        </select>
        <button type="button" className="tool-button" disabled={running || !thread} onClick={() => state.select(null)}>
          New
        </button>
      </div>

      <div ref={listRef} className="agent-chat__log" aria-live="polite">
        {unavailable && (
          <div className="agent-setup">
            <strong>Connect an agent</strong>
            <p>{claude?.detail ?? 'Install Claude Code and sign in: run `claude` once in a terminal.'}</p>
            <p>Until then, edit the deck by hand in the code view.</p>
          </div>
        )}
        {!unavailable && turns.length === 0 && (
          <div className="agent-empty">
            <h2>{deck ? `Working on ${deckName(deck)}` : 'What do you want to present?'}</h2>
            <p>{deck ? 'Ask for a change: a new slide, a shorter title, another theme. The agent edits the file and the preview follows.' : 'Describe the talk, paste your notes, or ask for a change across decks.'}</p>
          </div>
        )}
        {turns.map((turn) => (
          <TurnView key={turn.turn} turn={turn} onAnswer={state.answer} />
        ))}
        {running && !waiting && (
          <div className="agent-working" role="status">
            <span className="chat-dots" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            Working…
          </div>
        )}
        {error && (
          <p className="agent-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="chat-input">
        <div className="chat-input__row">
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            disabled={unavailable}
            placeholder={deck ? 'Ask for a change…' : 'Describe the presentation…'}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          {running ? (
            <button type="button" className="chat-send is-stop" onClick={state.stop} aria-label="Stop the agent" title="Stop">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <rect width="14" height="14" rx="2" fill="currentColor" />
              </svg>
            </button>
          ) : (
            <button type="button" className="chat-send" disabled={!input.trim() || unavailable} onClick={() => void send()} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />
              </svg>
            </button>
          )}
        </div>
        <p className="chat-input__hint">{claude?.available ? `${claude.name} ${claude.version ?? ''} · ` : ''}Enter to send, Shift+Enter for a new line</p>
      </div>
    </section>
  )
}

function TurnView({ turn, onAnswer }: { turn: Turn; onAnswer(id: string, allow: boolean): void }) {
  return (
    <div className="agent-turn">
      {turn.user && (
        <div className="chat-row is-user">
          <div className="chat-bubble is-user">
            {turn.user.text}
            {(turn.user.slide !== undefined || turn.user.selection) && (
              <span className="agent-turn__context">
                {turn.user.slide !== undefined ? `Slide ${turn.user.slide + 1}` : ''}
                {turn.user.selection ? `${turn.user.slide !== undefined ? ' · ' : ''}selection` : ''}
              </span>
            )}
          </div>
        </div>
      )}
      {turn.items.map((item) => (
        <ItemView key={item.key} item={item} onAnswer={onAnswer} />
      ))}
      {turn.done && (turn.files.length > 0 || !turn.done.ok) && (
        <div className={`agent-done${turn.done.ok ? '' : ' is-bad'}`}>
          {turn.done.stopped ? 'Stopped. ' : !turn.done.ok ? `Failed: ${turn.done.error ?? 'unknown error'}. ` : ''}
          {turn.files.length > 0 && `Changed ${turn.files.join(', ')}`}
        </div>
      )}
    </div>
  )
}

function ItemView({ item, onAnswer }: { item: TurnItem; onAnswer(id: string, allow: boolean): void }) {
  if (item.kind === 'text') return <div className="chat-bubble is-assistant agent-text">{item.text}</div>
  if (item.kind === 'tools') {
    return (
      <ul className="agent-tools">
        {item.tools.map(({ call, state, error }) => (
          <li key={call.id} className={`agent-tool is-${state}`} title={error}>
            <span className="agent-tool__dot" aria-hidden />
            <span className="agent-tool__summary">{call.summary}</span>
            {state === 'failed' && <span className="agent-tool__state">failed</span>}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className={`agent-approval${item.answer === undefined ? ' is-open' : ''}`} role={item.answer === undefined ? 'alertdialog' : undefined} aria-label="The agent asks for permission">
      <div>
        <strong>{item.answer === undefined ? 'Allow this?' : item.answer ? 'Allowed' : 'Not allowed'}</strong>
        <code>{item.summary}</code>
        {item.detail && <span className="agent-approval__detail">{item.detail}</span>}
      </div>
      {item.answer === undefined && (
        <div className="agent-approval__actions">
          <button type="button" className="tool-button is-primary" onClick={() => onAnswer(item.id, true)}>
            Allow
          </button>
          <button type="button" className="tool-button" onClick={() => onAnswer(item.id, false)}>
            Deny
          </button>
        </div>
      )}
    </div>
  )
}

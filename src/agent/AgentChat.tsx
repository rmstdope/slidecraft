import { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentBackendId, AgentEvent, MessageContext, TurnDiff } from '@shared/agent.ts'
import { fetchAgentSettings, fetchTurnDiff, undoTurn, uploadAttachment } from './api'
import { deckName, type DeckRef } from '@shared/decks.ts'
import { Markdown } from './markdown'
import { pendingApproval, toTurns, type Turn, type TurnItem } from './threadEvents'
import { useAgentThread } from './useAgentThread'

interface Props {
  vault: string
  /** The deck the conversation is about; absent for a vault-level conversation. */
  deck?: DeckRef
  /** What is on screen (slide, selection): shown as chips and sent with the message. */
  context?: MessageContext
  /** Runs before a message goes out, e.g. saving the editor; false cancels the send. */
  beforeSend?: () => Promise<boolean>
  /** The home page variant: no thread bar until there is a conversation, a shorter log. */
  compact?: boolean
  /** Shows a collapse button in the bar. */
  onCollapse?: () => void
  /** The agent wrote a deck file (a vault-level conversation creating a deck). */
  onDeckWritten?: (deck: DeckRef) => void
  /** A turn started or ended (the editor locks while the agent works). */
  onRunningChange?: (running: boolean) => void
}

const when = (ms: number) => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

/** The agent conversation panel (UX overhaul U2): streamed text, tool calls, approvals, stop. */
export function AgentChat({ vault, deck, context, beforeSend, compact, onCollapse, onDeckWritten, onRunningChange }: Props) {
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
  // Chips the person removed; a chip comes back when what it shows changes.
  const [dismissed, setDismissed] = useState<{ slide?: number; selection?: string }>({})
  const chips = {
    slide: context?.slide !== undefined && context.slide !== dismissed.slide ? context.slide : undefined,
    selection: context?.selection?.trim() && context.selection !== dismissed.selection ? context.selection : undefined,
  }
  // Files dropped or picked for the next message, already uploaded into the vault.
  const [attachments, setAttachments] = useState<{ name: string; path: string }[]>([])
  const [uploading, setUploading] = useState(0)
  const [dropping, setDropping] = useState(false)
  const [attachError, setAttachError] = useState<string>()
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const attach = async (files: File[]) => {
    setAttachError(undefined)
    for (const file of files) {
      setUploading((n) => n + 1)
      const result = await uploadAttachment(vault, deck?.path, file)
      setUploading((n) => n - 1)
      if (result.data) setAttachments((list) => [...list, { name: file.name, path: result.data!.path }])
      else setAttachError(`${file.name}: ${result.error}`)
    }
  }

  useEffect(() => onRunningChange?.(running), [running, onRunningChange])
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [events])

  // The agent of the conversation on screen, or the one a new conversation will use.
  const [choice, setChoice] = useState<AgentBackendId | null>(null)
  useEffect(() => {
    void fetchAgentSettings().then((r) => r.data && setChoice((c) => c ?? r.data!.backend))
  }, [])
  const ready = backends?.filter((b) => b.available) ?? []
  const backendId: AgentBackendId = thread?.backend ?? choice ?? ready[0]?.id ?? 'claude-code'
  const backend = backends?.find((b) => b.id === backendId)
  const unavailable = backends !== null && !backend?.available

  const send = async () => {
    const text = input.trim()
    if (!text || running || uploading) return
    if (beforeSend && !(await beforeSend())) return
    setInput('')
    const files = attachments.map((a) => a.path)
    const sent: MessageContext | undefined =
      chips.slide !== undefined || chips.selection || files.length ? { slide: chips.slide, selection: chips.selection, attachments: files.length ? files : undefined } : undefined
    if (await state.send(text, sent, thread ? undefined : backendId)) setAttachments([])
    else setInput(text)
    inputRef.current?.focus()
  }

  return (
    <section
      className={`agent-chat${compact ? ' is-compact' : ''}${dropping ? ' is-dropping' : ''}`}
      aria-label="Agent conversation"
      onDragOver={(e) => {
        if (unavailable || ![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(e) => {
        if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) setDropping(false)
      }}
      onDrop={(e) => {
        setDropping(false)
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        void attach([...e.dataTransfer.files])
      }}
    >
      {(!compact || threads.length > 0) && (
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
        {!thread && ready.length > 1 && (
          <select className="agent-chat__backend" aria-label="Agent for the new conversation" value={backendId} onChange={(e) => setChoice(e.target.value as AgentBackendId)}>
            {ready.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        {onCollapse && (
          <button type="button" className="tool-button" onClick={onCollapse} aria-label="Hide the conversation" title="Hide the conversation">
            ⟨
          </button>
        )}
      </div>
      )}

      <div ref={listRef} className="agent-chat__log" aria-live="polite">
        {unavailable && (
          <div className="agent-setup">
            <strong>Connect an agent</strong>
            <p>{backend?.detail ?? 'Install Claude Code and sign in: run `claude` once in a terminal.'}</p>
            <p>Until then, edit the deck by hand in the code view.</p>
          </div>
        )}
        {!unavailable && turns.length === 0 && !compact && (
          <div className="agent-empty">
            <h2>{deck ? `Working on ${deckName(deck)}` : 'What do you want to present?'}</h2>
            <p>{deck ? 'Ask for a change: a new slide, a shorter title, another theme. The agent edits the file and the preview follows.' : 'Describe the talk, paste your notes, or ask for a change across decks.'}</p>
          </div>
        )}
        {turns.map((turn) => (
          <TurnView key={turn.turn} turn={turn} vault={vault} threadId={thread?.id} running={running} onAnswer={state.answer} />
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
        {(chips.slide !== undefined || chips.selection || attachments.length > 0 || uploading > 0) && (
          <div className="agent-chips" aria-label="Sent with your message">
            {attachments.map((a) => (
              <span key={a.path} className="agent-chip" title={a.path}>
                📎 {a.name}
                <button type="button" aria-label={`Do not send ${a.name}`} onClick={() => setAttachments((list) => list.filter((x) => x !== a))}>
                  ×
                </button>
              </span>
            ))}
            {uploading > 0 && <span className="agent-chip">Uploading…</span>}
            {chips.slide !== undefined && (
              <span className="agent-chip">
                Slide {chips.slide + 1}
                <button type="button" aria-label="Do not send the slide" onClick={() => setDismissed((d) => ({ ...d, slide: chips.slide }))}>
                  ×
                </button>
              </span>
            )}
            {chips.selection && (
              <span className="agent-chip" title={chips.selection}>
                Selection: {chips.selection.length > 40 ? `${chips.selection.slice(0, 39).trim()}…` : chips.selection}
                <button type="button" aria-label="Do not send the selection" onClick={() => setDismissed((d) => ({ ...d, selection: chips.selection }))}>
                  ×
                </button>
              </span>
            )}
          </div>
        )}
        {attachError && (
          <p className="agent-error" role="alert">
            {attachError}
          </p>
        )}
        <div className="chat-input__row">
          <button type="button" className="agent-attach" disabled={unavailable} onClick={() => fileRef.current?.click()} aria-label="Attach files" title="Attach files (or drop them here)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])]
              e.target.value = ''
              if (files.length) void attach(files)
            }}
          />
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            disabled={unavailable}
            placeholder={deck ? 'Ask for a change…' : 'What do you want to present? Describe the talk or paste your notes…'}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const files = [...e.clipboardData.files]
              if (!files.length) return
              e.preventDefault()
              void attach(files)
            }}
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
            <button type="button" className="chat-send" disabled={!input.trim() || unavailable || uploading > 0} onClick={() => void send()} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" />
              </svg>
            </button>
          )}
        </div>
        <p className="chat-input__hint" title={backend && !backend.approvals ? backend.detail : undefined}>
          {backend?.available ? `${backend.name} ${backend.version ?? ''}${backend.approvals ? '' : ' (cannot ask: edits in the vault only)'} · ` : ''}Enter to send, Shift+Enter for a new line
        </p>
      </div>
    </section>
  )
}

function TurnView({ turn, vault, threadId, running, onAnswer }: { turn: Turn; vault: string; threadId?: string; running: boolean; onAnswer(id: string, allow: boolean): void }) {
  const context = turn.user && [
    turn.user.slide !== undefined ? `Slide ${turn.user.slide + 1}` : '',
    turn.user.selection ? 'selection' : '',
    turn.user.attachments?.length ? `${turn.user.attachments.length} file${turn.user.attachments.length === 1 ? '' : 's'}` : '',
  ].filter(Boolean)
  return (
    <div className="agent-turn">
      {turn.user && (
        <div className="chat-row is-user">
          <div className="chat-bubble is-user">
            {turn.user.text}
            {context && context.length > 0 && <span className="agent-turn__context">{context.join(' · ')}</span>}
          </div>
        </div>
      )}
      {turn.items.map((item) => (
        <ItemView key={item.key} item={item} onAnswer={onAnswer} />
      ))}
      {turn.done && !turn.done.ok && <div className="agent-done is-bad">{turn.done.stopped ? 'Stopped.' : `Failed: ${turn.done.error ?? 'unknown error'}.`}</div>}
      {turn.done && turn.changes.length > 0 && threadId && <TurnChanges turn={turn} vault={vault} threadId={threadId} running={running} />}
      {turn.done && turn.changes.length === 0 && turn.files.length > 0 && <div className="agent-done">Changed {turn.files.join(', ')}</div>}
      {turn.checks.map((check) => (
        <div key={check.path} className={`agent-check${check.ok ? '' : ' is-bad'}`} role={check.ok ? undefined : 'alert'}>
          <strong>{check.ok ? `Worth a look in ${check.path}` : `${check.path} has problems`}</strong>
          <ul>
            {check.problems.map((p, i) => (
              <li key={i}>
                {p.line ? `Line ${p.line}: ` : ''}
                {p.message}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** What a turn changed, with its diff and "Undo this turn" (UX overhaul U5). */
function TurnChanges({ turn, vault, threadId, running }: { turn: Turn; vault: string; threadId: string; running: boolean }) {
  const [diff, setDiff] = useState<TurnDiff | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const names = turn.changes.map((c) => `${c.path}${c.status === 'added' ? ' (new)' : c.status === 'deleted' ? ' (deleted)' : ''}`)

  const showDiff = async () => {
    if (open) return setOpen(false)
    setOpen(true)
    const result = await fetchTurnDiff(vault, threadId, turn.turn)
    if (result.data) setDiff(result.data)
    else setError(result.error)
  }
  const undo = async () => {
    setBusy(true)
    setError(undefined)
    const result = await undoTurn(vault, threadId, turn.turn)
    setBusy(false)
    if (!result.data) {
      setError(result.error)
      // A refused undo shows what is there now against the turn.
      if (!open) void showDiff()
    }
  }

  return (
    <div className={`agent-changes${turn.undone ? ' is-undone' : ''}`}>
      <div className="agent-changes__bar">
        <span className="agent-changes__what">
          {turn.undone ? 'Undone: ' : 'Changed '}
          {names.join(', ')}
        </span>
        <button type="button" className="tool-button" aria-expanded={open} onClick={() => void showDiff()}>
          {open ? 'Hide diff' : 'Diff'}
        </button>
        {!turn.undone && (
          <button type="button" className="tool-button" disabled={busy || running} onClick={() => void undo()} title={running ? 'Wait for the agent to finish' : 'Put these files back as they were before this turn'}>
            {busy ? 'Undoing…' : 'Undo this turn'}
          </button>
        )}
      </div>
      {error && (
        <p className="agent-error" role="alert">
          {error}
        </p>
      )}
      {open && (diff ? <DiffView diff={diff} /> : !error && <p className="agent-changes__loading">Loading the diff…</p>)}
    </div>
  )
}

function DiffView({ diff }: { diff: TurnDiff }) {
  return (
    <div className="agent-diff">
      {diff.files.map((file) => (
        <section key={file.path} className="agent-diff__file">
          <header>
            {file.path} <span className={`agent-diff__status is-${file.status}`}>{file.status}</span>
          </header>
          {file.binary && <p className="agent-diff__note">A binary file: no line diff.</p>}
          {file.tooLarge && <p className="agent-diff__note">Too large to show as a diff.</p>}
          {file.hunks?.map((hunk, i) => (
            <pre key={i} className="agent-diff__hunk">
              {hunk.lines.map((line, j) => (
                <span key={j} className={`agent-diff__line is-${line.kind}`}>
                  {line.kind === 'add' ? '+ ' : line.kind === 'remove' ? '- ' : '  '}
                  {line.text}
                  {'\n'}
                </span>
              ))}
            </pre>
          ))}
        </section>
      ))}
    </div>
  )
}

function ItemView({ item, onAnswer }: { item: TurnItem; onAnswer(id: string, allow: boolean): void }) {
  if (item.kind === 'text')
    return (
      <div className="chat-bubble is-assistant agent-text">
        <Markdown text={item.text} />
      </div>
    )
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

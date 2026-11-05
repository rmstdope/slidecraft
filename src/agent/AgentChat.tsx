import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowUp, Check, PanelLeftClose, Paperclip, Plus, Square, X } from 'lucide-react'
import type { AgentBackendId, AgentEvent, MessageContext, TurnDiff } from '@shared/agent.ts'
import { fetchAgentSettings, fetchTurnDiff, undoTurn, uploadAttachment } from './api'
import { deckName, type DeckRef } from '@shared/decks.ts'
import type { DiffLine } from '@shared/lineDiff.ts'
import { Badge, Button, cn, Select, StatusDot } from '../ui'
import { Markdown } from './markdown'
import { pendingApproval, toTurns, type ToolState, type Turn, type TurnItem } from './threadEvents'
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

/** Radix Select has no empty value; this stands for "a new conversation". */
const NEW_THREAD = '__new__'

/** Agent replies: the small Markdown subset, styled for the chrome. */
const proseClass =
  'tw:leading-relaxed tw:[&_p]:my-1.5 tw:[&_p:first-child]:mt-0 tw:[&_p:last-child]:mb-0 tw:[&_ul]:my-1.5 tw:[&_ul]:list-disc tw:[&_ul]:pl-5 tw:[&_ol]:my-1.5 tw:[&_ol]:list-decimal tw:[&_ol]:pl-5 tw:[&_li]:my-0.5 tw:[&_strong]:font-semibold tw:[&_code]:rounded tw:[&_code]:bg-field tw:[&_code]:px-1 tw:[&_code]:font-mono tw:[&_code]:text-[12.5px] tw:[&_pre]:my-2 tw:[&_pre]:overflow-x-auto tw:[&_pre]:rounded-lg tw:[&_pre]:bg-field tw:[&_pre]:p-3 tw:[&_pre]:font-mono tw:[&_pre]:text-[12.5px]'

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

  const chipClose = 'tw:-mr-1 tw:grid tw:size-4 tw:place-items-center tw:rounded tw:hover:bg-black/10 tw:[&_svg]:size-3'

  return (
    // `agent-chat` is a hook, not a style: the workspace's paste handler checks for it.
    <section
      className={cn('agent-chat tw:flex tw:min-h-0 tw:flex-col tw:rounded-[inherit]', compact ? 'tw:w-full' : 'tw:h-full', dropping && 'tw:shadow-[inset_0_0_0_2px_var(--sc-focus)]')}
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
        <div className={cn('tw:flex tw:items-center tw:gap-2 tw:px-3 tw:py-2.5', !compact && 'tw:border-b tw:border-line')}>
          <StatusDot tone={unavailable ? 'muted' : 'agent'} className="tw:ml-1" />
          <Select
            aria-label="Conversation"
            className="tw:h-8 tw:min-w-0 tw:flex-1 tw:bg-transparent tw:px-2 tw:font-semibold tw:hover:bg-field"
            value={thread?.id ?? NEW_THREAD}
            disabled={running}
            onValueChange={(v) => state.select(v === NEW_THREAD ? null : v)}
            options={[{ value: NEW_THREAD, label: 'New conversation' }, ...threads.map((t) => ({ value: t.id, label: `${t.title} · ${when(t.updatedAt)}` }))]}
          />
          {!thread && ready.length > 1 && (
            <Select
              aria-label="Agent for the new conversation"
              className="tw:h-8 tw:text-[13px]"
              value={backendId}
              onValueChange={(v) => setChoice(v)}
              options={ready.map((b) => ({ value: b.id, label: b.name }))}
            />
          )}
          <Button size="icon-sm" variant="ghost" disabled={running || !thread} onClick={() => state.select(null)} aria-label="New conversation" title="New conversation">
            <Plus aria-hidden />
          </Button>
          {onCollapse && (
            <Button size="icon-sm" variant="ghost" onClick={onCollapse} aria-label="Hide the conversation" title="Hide the conversation">
              <PanelLeftClose aria-hidden />
            </Button>
          )}
        </div>
      )}

      {/* The live region is always rendered (a region that appears with its first update is often not announced); its padding goes when it is empty. */}
      <div
        ref={listRef}
        className={cn('tw:flex tw:flex-col tw:gap-3.5 tw:overflow-y-auto tw:px-4 tw:text-[14px]', compact ? 'tw:max-h-[360px] tw:py-3 tw:empty:py-0' : 'tw:flex-1 tw:py-4')}
        aria-live="polite"
      >
        {unavailable && (
          <div className="tw:flex tw:flex-col tw:gap-1 tw:rounded-xl tw:bg-accent-tint tw:px-4 tw:py-3 tw:text-on-accent-tint">
            <strong className="tw:font-semibold">Connect an agent</strong>
            <p>{backend?.detail ?? 'Install Claude Code and sign in: run `claude` once in a terminal.'}</p>
            <p>Until then, edit the deck by hand in the code view.</p>
          </div>
        )}
        {!unavailable && turns.length === 0 && !compact && (
          <div className="tw:m-auto tw:flex tw:max-w-[300px] tw:flex-col tw:gap-2 tw:py-8 tw:text-center">
            <h2 className="tw:font-display tw:text-[22px] tw:leading-tight tw:font-semibold">{deck ? `Working on ${deckName(deck)}` : 'What do you want to present?'}</h2>
            <p className="tw:text-muted">
              {deck ? 'Ask for a change: a new slide, a shorter title, another theme. The agent edits the file and the preview follows.' : 'Describe the talk, paste your notes, or ask for a change across decks.'}
            </p>
          </div>
        )}
        {turns.map((turn) => (
          <TurnView key={turn.turn} turn={turn} vault={vault} threadId={thread?.id} running={running} onAnswer={state.answer} />
        ))}
        {running && !waiting && (
          <div className="tw:flex tw:items-center tw:gap-2 tw:text-[13px] tw:text-muted" role="status">
            <span className="tw:flex tw:gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="tw:size-1.5 tw:animate-pulse tw:rounded-full tw:bg-agent" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </span>
            Working…
          </div>
        )}
        {error && (
          <p className="tw:text-[13px] tw:text-removed" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className={cn(compact ? 'tw:p-0' : 'tw:p-3')}>
        <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-[14px] tw:bg-raised tw:px-3 tw:py-2.5 tw:shadow-[0_0_0_1px_var(--sc-line),var(--sc-elev)] tw:focus-within:shadow-[0_0_0_2px_var(--sc-focus),var(--sc-elev)]">
          {(chips.slide !== undefined || chips.selection || attachments.length > 0 || uploading > 0) && (
            <div className="tw:flex tw:flex-wrap tw:gap-1.5" aria-label="Sent with your message">
              {attachments.map((a) => (
                <Badge key={a.path} tone="accent" title={a.path}>
                  <Paperclip className="tw:size-3" aria-hidden />
                  {a.name}
                  <button type="button" className={chipClose} aria-label={`Do not send ${a.name}`} onClick={() => setAttachments((list) => list.filter((x) => x !== a))}>
                    <X aria-hidden />
                  </button>
                </Badge>
              ))}
              {uploading > 0 && <Badge>Uploading…</Badge>}
              {chips.slide !== undefined && (
                <Badge tone="accent">
                  Slide {chips.slide + 1}
                  <button type="button" className={chipClose} aria-label="Do not send the slide" onClick={() => setDismissed((d) => ({ ...d, slide: chips.slide }))}>
                    <X aria-hidden />
                  </button>
                </Badge>
              )}
              {chips.selection && (
                <Badge tone="accent" title={chips.selection}>
                  Selection: {chips.selection.length > 40 ? `${chips.selection.slice(0, 39).trim()}…` : chips.selection}
                  <button type="button" className={chipClose} aria-label="Do not send the selection" onClick={() => setDismissed((d) => ({ ...d, selection: chips.selection }))}>
                    <X aria-hidden />
                  </button>
                </Badge>
              )}
            </div>
          )}
          {attachError && (
            <p className="tw:text-[13px] tw:text-removed" role="alert">
              {attachError}
            </p>
          )}
          <textarea
            ref={inputRef}
            rows={2}
            value={input}
            disabled={unavailable}
            aria-label="Message the agent"
            placeholder={deck ? 'Ask for a change…' : 'What do you want to present? Describe the talk or paste your notes…'}
            className="tw:max-h-[200px] tw:min-h-[44px] tw:w-full tw:resize-none tw:border-0 tw:bg-transparent tw:text-[14px] tw:text-fg tw:outline-none tw:placeholder:text-muted tw:disabled:opacity-60"
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
          <div className="tw:flex tw:items-center tw:gap-2">
            <Button size="icon-sm" variant="quiet" disabled={unavailable} onClick={() => fileRef.current?.click()} aria-label="Attach files" title="Attach files (or drop them here)">
              <Paperclip aria-hidden />
            </Button>
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
            <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-[12px] tw:text-muted" title={backend && !backend.approvals ? backend.detail : undefined}>
              {backend?.available ? `${backend.name} ${backend.version ?? ''}${backend.approvals ? '' : ' (cannot ask: edits in the vault only)'} · ` : ''}Enter to send, Shift+Enter for a new line
            </span>
            {running ? (
              <Button size="icon-sm" variant="danger" className="tw:rounded-full" onClick={state.stop} aria-label="Stop the agent" title="Stop">
                <Square className="tw:size-3! tw:fill-current" aria-hidden />
              </Button>
            ) : (
              <Button size="icon-sm" variant="primary" className="tw:rounded-full" disabled={!input.trim() || unavailable || uploading > 0} onClick={() => void send()} aria-label="Send">
                <ArrowUp aria-hidden />
              </Button>
            )}
          </div>
        </div>
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
    <div className="tw:flex tw:flex-col tw:gap-3">
      {turn.user && (
        <div className="tw:flex tw:max-w-[88%] tw:flex-col tw:gap-1 tw:self-end tw:rounded-[14px_14px_4px_14px] tw:bg-field tw:px-3 tw:py-2.5 tw:whitespace-pre-wrap">
          {turn.user.text}
          {context && context.length > 0 && <span className="tw:text-[12px] tw:text-muted">{context.join(' · ')}</span>}
        </div>
      )}
      {turn.items.map((item) => (
        <ItemView key={item.key} item={item} onAnswer={onAnswer} />
      ))}
      {turn.done && !turn.done.ok && <div className="tw:text-[13px] tw:text-removed">{turn.done.stopped ? 'Stopped.' : `Failed: ${turn.done.error ?? 'unknown error'}.`}</div>}
      {turn.done && turn.changes.length > 0 && threadId && <TurnChanges turn={turn} vault={vault} threadId={threadId} running={running} />}
      {turn.done && turn.changes.length === 0 && turn.files.length > 0 && <div className="tw:text-[13px] tw:text-muted">Changed {turn.files.join(', ')}</div>}
      {turn.checks.map((check) => (
        <div
          key={check.path}
          className={cn('tw:flex tw:flex-col tw:gap-1 tw:rounded-xl tw:px-3.5 tw:py-2.5 tw:text-[13px]', check.ok ? 'tw:bg-accent-tint tw:text-on-accent-tint' : 'tw:bg-field tw:text-removed tw:shadow-[inset_0_0_0_1px_var(--sc-removed)]')}
          role={check.ok ? undefined : 'alert'}
        >
          <strong className="tw:flex tw:items-center tw:gap-1.5 tw:font-semibold">
            <AlertTriangle className="tw:size-3.5" aria-hidden />
            {check.ok ? `Worth a look in ${check.path}` : `${check.path} has problems`}
          </strong>
          <ul className="tw:flex tw:flex-col tw:gap-0.5">
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
    <div className={cn('tw:overflow-hidden tw:rounded-xl tw:shadow-hairline', turn.undone && 'tw:opacity-70')}>
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:bg-panel-alt tw:px-3 tw:py-2">
        <Check className={cn('tw:size-3.5 tw:shrink-0', turn.undone ? 'tw:text-muted' : 'tw:text-added')} aria-hidden />
        <span className="tw:min-w-0 tw:flex-1 tw:text-[13px] tw:font-medium tw:break-words">
          {turn.undone ? 'Undone: ' : 'Changed '}
          {names.join(', ')}
        </span>
        <Button size="sm" variant="ghost" className="tw:h-7" aria-expanded={open} onClick={() => void showDiff()}>
          {open ? 'Hide diff' : 'Diff'}
        </Button>
        {!turn.undone && (
          <Button size="sm" className="tw:h-7" disabled={busy || running} onClick={() => void undo()} title={running ? 'Wait for the agent to finish' : 'Put these files back as they were before this turn'}>
            {busy ? 'Undoing…' : 'Undo this turn'}
          </Button>
        )}
      </div>
      {error && (
        <p className="tw:px-3 tw:py-2 tw:text-[13px] tw:text-removed" role="alert">
          {error}
        </p>
      )}
      {open && (diff ? <DiffView diff={diff} /> : !error && <p className="tw:px-3 tw:py-2 tw:text-[13px] tw:text-muted">Loading the diff…</p>)}
    </div>
  )
}

const DIFF_LINE: Record<DiffLine['kind'], string> = { add: 'tw:bg-added/10 tw:text-added', remove: 'tw:bg-removed/10 tw:text-removed', same: 'tw:text-muted' }

function DiffView({ diff }: { diff: TurnDiff }) {
  return (
    <div className="tw:flex tw:max-h-[420px] tw:flex-col tw:overflow-auto tw:border-t tw:border-line">
      {diff.files.map((file) => (
        <section key={file.path} className="tw:flex tw:flex-col">
          <header className="tw:flex tw:items-center tw:gap-2 tw:px-3 tw:py-1.5 tw:font-mono tw:text-[12px] tw:text-fg-2">
            {file.path}
            <Badge className="tw:h-5">{file.status}</Badge>
          </header>
          {file.binary && <p className="tw:px-3 tw:pb-2 tw:text-[12px] tw:text-muted">A binary file: no line diff.</p>}
          {file.tooLarge && <p className="tw:px-3 tw:pb-2 tw:text-[12px] tw:text-muted">Too large to show as a diff.</p>}
          {file.hunks?.map((hunk, i) => (
            <pre key={i} className="tw:m-0 tw:border-t tw:border-line tw:py-1 tw:font-mono tw:text-[12px] tw:leading-[1.6]">
              {hunk.lines.map((line, j) => (
                <span key={j} className={cn('tw:block tw:px-3 tw:whitespace-pre-wrap', DIFF_LINE[line.kind])}>
                  {line.kind === 'add' ? '+ ' : line.kind === 'remove' ? '- ' : '  '}
                  {line.text}
                </span>
              ))}
            </pre>
          ))}
        </section>
      ))}
    </div>
  )
}

const TOOL_DOT: Record<ToolState, string> = {
  running: 'tw:animate-pulse tw:bg-agent',
  waiting: 'tw:animate-pulse tw:bg-accent',
  ok: 'tw:bg-agent',
  failed: 'tw:bg-removed',
  denied: 'tw:bg-muted',
}

function ItemView({ item, onAnswer }: { item: TurnItem; onAnswer(id: string, allow: boolean): void }) {
  if (item.kind === 'text')
    return (
      <div className={cn('tw:text-fg', proseClass)}>
        <Markdown text={item.text} />
      </div>
    )
  if (item.kind === 'tools') {
    return (
      <ul className="tw:flex tw:flex-col tw:gap-1 tw:rounded-xl tw:bg-panel-alt tw:px-3 tw:py-2 tw:shadow-hairline">
        {item.tools.map(({ call, state, error }) => (
          <li key={call.id} className="tw:flex tw:items-center tw:gap-2 tw:font-mono tw:text-[12px] tw:text-fg-2" title={error}>
            <span aria-hidden className={cn('tw:size-1.5 tw:shrink-0 tw:rounded-full', TOOL_DOT[state])} />
            <span className="tw:min-w-0 tw:truncate">{call.summary}</span>
            {state === 'failed' && <span className="tw:text-removed">failed</span>}
            {state === 'denied' && <span className="tw:text-muted">denied</span>}
          </li>
        ))}
      </ul>
    )
  }
  const open = item.answer === undefined
  return (
    <div
      className={cn('tw:flex tw:flex-col tw:gap-2.5 tw:rounded-xl tw:px-3.5 tw:py-3', open ? 'tw:bg-accent-tint tw:shadow-[inset_0_0_0_1px_var(--sc-focus)]' : 'tw:bg-field')}
      role={open ? 'alertdialog' : undefined}
      aria-label="The agent asks for permission"
    >
      <div className="tw:flex tw:flex-col tw:gap-1">
        <strong className={cn('tw:font-semibold', open && 'tw:text-on-accent-tint')}>{open ? 'Allow this?' : item.answer ? 'Allowed' : 'Not allowed'}</strong>
        <code className="tw:font-mono tw:text-[12px] tw:break-all tw:text-fg">{item.summary}</code>
        {item.detail && <span className="tw:text-[12px] tw:text-muted">{item.detail}</span>}
      </div>
      {open && (
        <div className="tw:flex tw:gap-2">
          <Button size="sm" variant="primary" onClick={() => onAnswer(item.id, true)}>
            Allow
          </Button>
          <Button size="sm" onClick={() => onAnswer(item.id, false)}>
            Deny
          </Button>
        </div>
      )}
    </div>
  )
}

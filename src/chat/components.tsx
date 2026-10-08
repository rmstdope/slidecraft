import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ChatToolCall, ChatValidationError } from '@shared/chat.ts'
import type { DeckRef } from '@shared/decks.ts'
import { SlideEditor } from '../editor/components/SlideEditor'
import { registryLanguageService } from '../language-service'
import { applyFix } from './api'

export function MessageBubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  return (
    <motion.div className={`chat-bubble is-${role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {content}
    </motion.div>
  )
}

export function ToolCalls({ calls, defaultOpen = false }: { calls: ChatToolCall[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const passed = calls.filter((c) => c.result === 'success').length
  const failed = calls.length - passed
  return (
    <div className="chat-tools">
      <button type="button" className="chat-tools__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {calls.length} tool call{calls.length === 1 ? '' : 's'}
        {passed > 0 && <span className="is-ok">{passed} passed</span>}
        {failed > 0 && <span className="is-bad">{failed} failed</span>}
        <span className={`chat-tools__chevron${open ? ' is-open' : ''}`}>⌄</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            {calls.map((call, i) => (
              <div key={i} className={`chat-tool ${call.result === 'success' ? 'is-ok' : 'is-bad'}`}>
                <div className="chat-tool__head">
                  <code>{call.tool}</code> <span>{call.result === 'success' ? 'completed' : 'failed'}</span>
                </div>
                {call.error && <pre className="chat-tool__error">{call.error}</pre>}
                {call.data !== undefined && <pre className="chat-tool__data">{JSON.stringify(call.data, null, 2)}</pre>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FixEditor({ deck, error, onFixed }: { deck: DeckRef; error: ChatValidationError; onFixed(): void }) {
  const [content, setContent] = useState(error.failedContent ?? '')
  const [message, setMessage] = useState(error.error)
  const [busy, setBusy] = useState(false)
  const service = useMemo(() => registryLanguageService(), [])
  const apply = async () => {
    if (error.slideIndex === undefined) return
    setBusy(true)
    const result = await applyFix(deck, error.slideIndex, content)
    setBusy(false)
    if (result.success) onFixed()
    else setMessage(result.message)
  }
  return (
    <div className="chat-fix">
      <div className="chat-fix__slide">{error.slideIndex !== undefined ? `Slide ${error.slideIndex + 1}` : 'Slide unknown'}</div>
      <pre className="chat-fix__message">{message}</pre>
      {error.failedContent !== undefined && error.slideIndex !== undefined && (
        <>
          <div className="chat-fix__editor">
            <SlideEditor
              path={`chat-fix/${deck.source}/${deck.path}/${error.slideIndex}.mdx`}
              value={content}
              readOnly={false}
              service={() => service}
              onChange={setContent}
              onSave={() => void apply()}
              onCursor={() => {}}
              onSelection={() => {}}
            />
          </div>
          <button type="button" className="tool-button is-primary" disabled={busy || !content.trim()} onClick={() => void apply()}>
            {busy ? 'Applying…' : 'Apply Fix'}
          </button>
        </>
      )}
    </div>
  )
}

export function ValidationErrors({ deck, errors, onFixed }: { deck?: DeckRef; errors: ChatValidationError[]; onFixed(error: ChatValidationError): void }) {
  return (
    <div className="chat-errors">
      <div className="chat-errors__title">Validation Error — Fix Required</div>
      {errors.map((error, i) =>
        deck ? (
          <FixEditor key={`${error.slideIndex}-${i}`} deck={deck} error={error} onFixed={() => onFixed(error)} />
        ) : (
          <pre key={i} className="chat-fix__message">
            {error.error}
          </pre>
        ),
      )}
    </div>
  )
}

export function WorkingBubble({ iteration, calls }: { iteration: { iteration: number; maxIterations: number } | null; calls: ChatToolCall[] }) {
  return (
    <div className="chat-working">
      <div className="chat-bubble is-assistant is-working">
        <span>Working…</span>
        {iteration && (
          <>
            <small>
              Iteration {iteration.iteration} of {iteration.maxIterations}
            </small>
            <span className="chat-working__bar">
              <span style={{ width: `${(iteration.iteration / iteration.maxIterations) * 100}%` }} />
            </span>
          </>
        )}
      </div>
      {calls.length > 0 ? (
        <ToolCalls calls={calls} defaultOpen />
      ) : (
        <div className="chat-dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  )
}

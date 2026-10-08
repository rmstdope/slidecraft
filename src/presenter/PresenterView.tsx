import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { SlideThumbnail } from '../components/editor/SlideThumbnail'
import { KeyboardShortcutsModal } from '../components/editor/KeyboardShortcutsModal'
import type { DeckAnalysis } from '../components/slides/analyzeDeck'
import type { NavState } from '../components/slides/navigation'
import { useDrawing } from '../drawing/DrawingContext'
import { DrawingOverlay } from '../drawing/DrawingOverlay'
import { clientPointToSlide } from '../drawing/geometry'
import type { Annotation, Point } from '../drawing/types'
import { isTypingTarget } from '../utils/environment'
import { readStored, storageKeys, throttle, writeStored, type SyncChannel } from './sync'
import type { NavActions } from './useDeckNavigation'

const formatTime = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Talk timer; the start time survives reloads (Part 5 §B.3). */
function useTimer(deckKey: string) {
  const key = storageKeys(deckKey).timer
  const [startedAt, setStartedAt] = useState<number | null>(() => readStored<number>(key))
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (startedAt === null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [startedAt])
  const start = useCallback(() => {
    const t = Date.now()
    writeStored(key, t)
    setStartedAt(t)
    setNow(t)
  }, [key])
  const reset = useCallback(() => {
    writeStored(key, null)
    setStartedAt(null)
  }, [key])
  return { running: startedAt !== null, elapsed: startedAt === null ? 0 : now - startedAt, start, reset }
}

export interface PresenterViewProps {
  analysis: DeckAnalysis
  nav: NavState
  actions: NavActions
  deckKey: string
  deckLabel: string
  channel: SyncChannel
}

/** The speaker's window (Part 5 §B.5): current and next slide, notes, timer and controls. */
export function PresenterView({ analysis, nav, actions, deckKey, deckLabel, channel }: PresenterViewProps) {
  const { slides, notes, stepCounts } = analysis
  const total = slides.length
  const current = Math.min(nav.current, total - 1)
  const stepsOnSlide = stepCounts[current] ?? 0
  const timer = useTimer(deckKey)
  const drawing = useDrawing()
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // Pointer over the current slide → a red dot in the audience window (Part 5 §B.4).
  const lastPoint = useRef<Point | null>(null)
  const publishPointer = useRef(throttle((slideIndex: number, point: Point | null) => channel.post({ type: 'pointer', slideIndex, point }), 32)).current
  const clearPointer = useCallback(() => {
    publishPointer.cancel()
    lastPoint.current = null
    channel.post({ type: 'pointer', slideIndex: current, point: null })
  }, [channel, current, publishPointer])
  useEffect(() => {
    const beat = setInterval(() => lastPoint.current && channel.post({ type: 'pointer', slideIndex: current, point: lastPoint.current }), 500)
    return () => clearInterval(beat)
  }, [channel, current])
  useEffect(() => {
    clearPointer()
    channel.post({ type: 'annotation-preview', slideIndex: current, annotation: null })
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener('blur', clearPointer)
    return () => window.removeEventListener('blur', clearPointer)
  }, [clearPointer])
  useEffect(
    () => () => {
      channel.post({ type: 'pointer', slideIndex: -1, point: null })
      channel.post({ type: 'annotation-preview', slideIndex: -1, annotation: null })
    },
    [channel],
  )
  const publishPreview = useCallback((annotation: Annotation | null) => channel.post({ type: 'annotation-preview', slideIndex: current, annotation }), [channel, current])

  // Keys (Part 5 §B.6).
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandler.current = (e) => {
    if (isTypingTarget(e.target) || shortcutsOpen || e.metaKey || e.ctrlKey || e.altKey) return
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
    switch (key) {
      case 'ArrowRight':
      case ' ':
      case 'Enter':
        actions.advance()
        break
      case 'ArrowLeft':
      case 'Backspace':
        actions.retreat()
        break
      case 'ArrowDown':
        actions.nextSlide()
        break
      case 'ArrowUp':
        actions.prevSlide()
        break
      case 'Home':
        actions.goTo(0)
        break
      case 'End':
        actions.goTo(total - 1)
        break
      case 'r':
        if (timer.running) timer.reset()
        else timer.start()
        break
      case 'a':
        drawing?.toggleDrawMode()
        break
      case '?':
        setShortcutsOpen(true)
        break
      case 'Escape':
        if (drawing?.isDrawMode) drawing.setDrawMode(false)
        else window.close()
        break
      default:
        return
    }
    e.preventDefault()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandler.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    document.title = `Presenter: ${deckLabel}`
  }, [deckLabel])

  const atEnd = current >= total - 1 && nav.step >= stepsOnSlide
  const note: ReactNode = notes[current]

  return (
    <div className="presenter">
      <header className="presenter__header">
        <div>
          <h1>Presenter View</h1>
          <span className="presenter__deck">{deckLabel}</span>
        </div>
        <div className="presenter__timer">
          <span className={`presenter__time${timer.running ? ' is-running' : ''}`}>{formatTime(timer.elapsed)}</span>
          {timer.running ? (
            <button type="button" className="tool-button" onClick={timer.reset}>
              Reset
            </button>
          ) : (
            <button type="button" className="tool-button is-primary" onClick={timer.start}>
              Start Timer
            </button>
          )}
        </div>
      </header>

      <div className="presenter__progress" aria-hidden>
        <div style={{ width: `${((current + 1) / Math.max(1, total)) * 100}%` }} />
      </div>

      <main className="presenter__main">
        <section className="presenter__slides">
          <span className="presenter__label">Current slide</span>
          <div
            ref={previewRef}
            className="presenter__current"
            onPointerMove={(e) => {
              const point = clientPointToSlide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
              lastPoint.current = point
              publishPointer(current, point)
            }}
            onPointerLeave={clearPointer}
          >
            {slides[current] && (
              <SlideThumbnail>
                {slides[current]}
              </SlideThumbnail>
            )}
            <DrawingOverlay slideIndex={current} onPreviewChange={publishPreview} />
          </div>
          <span className="presenter__label">Up next</span>
          <div className="presenter__next">
            {slides[current + 1] ? (
              <div className="presenter__next-frame">
                <SlideThumbnail>{slides[current + 1]}</SlideThumbnail>
              </div>
            ) : (
              <div className="presenter__end">End of presentation</div>
            )}
          </div>
        </section>
        <section className="presenter__notes">
          <span className="presenter__label">Speaker notes</span>
          {note ? (
            <div className="presenter__note-body">{note}</div>
          ) : (
            <p className="presenter__no-notes">
              No notes for this slide. Add notes using the <code>{'<Notes>'}</code> component inside your Slide.
            </p>
          )}
        </section>
      </main>

      <footer className="presenter__controls">
        <button type="button" className="tool-button" disabled={current === 0 && nav.step === 0} onClick={actions.retreat}>
          ← Previous
        </button>
        <div className="presenter__position">
          <span>
            <strong>{current + 1}</strong> / {total}
          </span>
          {stepsOnSlide > 0 && (
            <small>
              step {nav.step} / {stepsOnSlide}
            </small>
          )}
        </div>
        <button type="button" className="tool-button is-primary" disabled={atEnd} onClick={actions.advance}>
          Next →
        </button>
      </footer>

      <div className="presenter__hints" aria-hidden>
        <span>
          <kbd>R</kbd> Timer
        </span>
        <span>
          <kbd>A</kbd> Draw
        </span>
        <span>
          <kbd>Esc</kbd> Close
        </span>
      </div>
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} mode="presenter" />
    </div>
  )
}

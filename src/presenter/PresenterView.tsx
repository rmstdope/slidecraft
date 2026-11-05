import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { SlideThumbnail } from '../components/editor/SlideThumbnail'
import { Button, cn, Kbd, Logo } from '../ui'
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

  // Class names such as presenter__position stay as hooks for the tests; the look is all utilities.
  const label = 'tw:text-[11px] tw:font-semibold tw:tracking-[0.12em] tw:text-accent tw:uppercase'
  return (
    <div data-sc-theme="dark" className="presenter sc-app tw:absolute tw:inset-0 tw:flex tw:flex-col tw:gap-5 tw:overflow-hidden tw:bg-ground tw:px-6 tw:pt-5 tw:pb-8">
      <header className="tw:flex tw:items-center tw:justify-between tw:gap-4">
        <div className="tw:flex tw:items-center tw:gap-3">
          <Logo size={26} />
          <div className="tw:flex tw:flex-col">
            <h1 className="tw:font-display tw:text-[22px] tw:leading-tight tw:font-semibold">Presenter View</h1>
            <span className="tw:text-[13px] tw:text-muted">{deckLabel}</span>
          </div>
        </div>
        <div className="tw:flex tw:items-center tw:gap-4">
          <span className={cn('presenter__time tw:font-mono tw:text-[40px] tw:font-medium tw:tabular-nums', timer.running ? 'is-running tw:text-accent' : 'tw:text-muted')}>{formatTime(timer.elapsed)}</span>
          {timer.running ? (
            <Button onClick={timer.reset}>Reset</Button>
          ) : (
            <Button variant="primary" onClick={timer.start}>
              Start Timer
            </Button>
          )}
        </div>
      </header>

      <div className="tw:h-1 tw:overflow-hidden tw:rounded-full tw:bg-field" aria-hidden>
        <div className="tw:h-full tw:bg-accent tw:transition-[width] tw:duration-300" style={{ width: `${((current + 1) / Math.max(1, total)) * 100}%` }} />
      </div>

      <main className="tw:grid tw:min-h-0 tw:flex-1 tw:grid-cols-[1.5fr_1fr] tw:gap-6">
        <section className="tw:flex tw:min-h-0 tw:flex-col tw:gap-2.5">
          <span className={label}>Current slide</span>
          <div
            ref={previewRef}
            // The largest 16:9 box that leaves room for the header, "up next" and the controls.
            className="tw:relative tw:aspect-video tw:w-[min(100%,calc((100vh-500px)*16/9))] tw:flex-none tw:overflow-hidden tw:rounded-lg tw:bg-black tw:shadow-[0_0_0_2px_var(--sc-accent),0_0_30px_color-mix(in_srgb,var(--sc-accent)_20%,transparent)]"
            onPointerMove={(e) => {
              const point = clientPointToSlide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())
              lastPoint.current = point
              publishPointer(current, point)
            }}
            onPointerLeave={clearPointer}
          >
            {slides[current] && <SlideThumbnail>{slides[current]}</SlideThumbnail>}
            <DrawingOverlay slideIndex={current} onPreviewChange={publishPreview} />
          </div>
          <span className={cn(label, 'tw:mt-2')}>Up next</span>
          <div className="tw:h-[200px] tw:flex-none">
            {slides[current + 1] ? (
              <div className="presenter__next-frame tw:relative tw:aspect-video tw:h-full tw:overflow-hidden tw:rounded-md tw:bg-black tw:shadow-hairline">
                <SlideThumbnail>{slides[current + 1]}</SlideThumbnail>
              </div>
            ) : (
              <div className="presenter__end tw:flex tw:aspect-video tw:h-full tw:items-center tw:justify-center tw:rounded-md tw:border-2 tw:border-dashed tw:border-line tw:text-muted">End of presentation</div>
            )}
          </div>
        </section>
        <section className="tw:flex tw:min-h-0 tw:flex-col tw:gap-3 tw:overflow-y-auto tw:rounded-2xl tw:bg-panel tw:p-5 tw:shadow-hairline">
          <span className={label}>Speaker notes</span>
          {note ? (
            <div className="presenter__note-body tw:text-[24px] tw:leading-[1.6] tw:[&_code]:rounded tw:[&_code]:bg-field tw:[&_code]:px-1.5 tw:[&_code]:font-mono tw:[&_code]:text-[0.85em] tw:[&_ol]:list-decimal tw:[&_ol]:pl-[1.4em] tw:[&_p+p]:mt-[0.6em] tw:[&_strong]:text-accent tw:[&_ul]:list-disc tw:[&_ul]:pl-[1.4em]">
              {note}
            </div>
          ) : (
            <p className="presenter__no-notes tw:text-muted tw:italic">
              No notes for this slide. Add notes using the <code className="tw:font-mono">{'<Notes>'}</code> component inside your Slide.
            </p>
          )}
        </section>
      </main>

      <footer className="presenter__controls tw:flex tw:items-center tw:justify-between tw:border-t tw:border-line tw:pt-4">
        <Button size="lg" className="tw:min-w-36" disabled={current === 0 && nav.step === 0} onClick={actions.retreat}>
          ← Previous
        </Button>
        <div className="presenter__position tw:flex tw:flex-col tw:items-center tw:text-[15px] tw:text-fg-2">
          <span>
            <strong className="tw:text-[22px] tw:text-fg">{current + 1}</strong> / {total}
          </span>
          {stepsOnSlide > 0 && (
            <small className="tw:text-[12px] tw:text-muted">
              step {nav.step} / {stepsOnSlide}
            </small>
          )}
        </div>
        <Button size="lg" variant="primary" className="is-primary tw:min-w-36" disabled={atEnd} onClick={actions.advance}>
          Next →
        </Button>
      </footer>

      <div className="tw:absolute tw:right-6 tw:bottom-2 tw:flex tw:gap-4 tw:text-[11px] tw:text-muted" aria-hidden>
        <span className="tw:flex tw:items-center tw:gap-1.5">
          <Kbd>R</Kbd> Timer
        </span>
        <span className="tw:flex tw:items-center tw:gap-1.5">
          <Kbd>A</Kbd> Draw
        </span>
        <span className="tw:flex tw:items-center tw:gap-1.5">
          <Kbd>Esc</Kbd> Close
        </span>
      </div>
      <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} mode="presenter" theme="dark" />
    </div>
  )
}

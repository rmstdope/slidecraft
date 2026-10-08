import { cloneElement, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from 'motion/react'
import { ALL_STEPS_STATE, StepContext } from '../../animations/stepContext'
import { springs } from '../../animations/springs'
import { resolveTransition, slideVariants } from '../../animations/variants'
import { chatUrl, editorUrl, homeUrl } from '../../router'
import { isExported, isTypingTarget, navigateTo } from '../../utils/environment'
import type { AppMode } from '../../utils/keyboardShortcuts'
import { GlobalCommandPalette, type CommandItem } from '../editor/GlobalCommandPalette'
import { KeyboardShortcutsModal } from '../editor/KeyboardShortcutsModal'
import { DevOverlay } from '../presentation/DevOverlay'
import { Overview } from '../presentation/Overview'
import { PdfView } from '../presentation/PdfView'
import { ProgressIndicator } from '../presentation/ProgressIndicator'
import { analyzeDeck, type DeckAnalysis } from './analyzeDeck'
import { CanvasStage } from './CanvasStage'
import { useDeck } from './deckContext'
import { defineComponent } from './defineComponent'
import {
  advance,
  formatSlideHash,
  goToSlide,
  INITIAL_NAV,
  nextSlide,
  parseSlideHash,
  prevSlide,
  retreat,
  type NavState,
} from './navigation'
import { useInThumbnail } from './thumbnailContext'

export interface PresentationProps {
  children?: ReactNode
}

function readPdfParams(): { only?: number } | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (!params.has('pdf')) return null
  const slide = Number(params.get('slide'))
  return { only: Number.isInteger(slide) && slide > 0 ? slide : undefined }
}

/** The deck root (Part 1 §3). Decides between a still, the PDF render and the live player. */
function PresentationComponent({ children }: PresentationProps) {
  const inThumbnail = useInThumbnail()
  const analysis = useMemo(() => analyzeDeck(children), [children])
  const [pdf] = useState(readPdfParams)
  if (inThumbnail) return analysis.slides[0] ?? null // a deck card shows its first slide
  if (pdf) return <PdfView slides={analysis.slides} only={pdf.only} />
  return <LivePresentation analysis={analysis} />
}

const SWIPE_DISTANCE = 60

function LivePresentation({ analysis }: { analysis: DeckAnalysis }) {
  const { slides, stepCounts } = analysis
  const total = slides.length
  const { deck } = useDeck()
  const exported = useMemo(isExported, [])
  const presenterView = useMemo(() => new URLSearchParams(window.location.search).has('presenter'), [])

  const [nav, setNav] = useState<NavState>(() => {
    const parsed = parseSlideHash(window.location.hash, stepCounts)
    return parsed ? { ...parsed, direction: 0 } : INITIAL_NAV
  })
  const [devMode, setDevMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'dev')
  const [devFitMode, setDevFitMode] = useState(true)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [focused, setFocused] = useState(0)
  const [previewMode, setPreviewMode] = useState(false)
  const columnsRef = useRef(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const actions = useMemo(
    () => ({
      advance: () => setNav((s) => advance(s, stepCounts)),
      retreat: () => setNav((s) => retreat(s, stepCounts)),
      nextSlide: () => setNav((s) => nextSlide(s, stepCounts)),
      prevSlide: () => setNav((s) => prevSlide(s)),
      goTo: (index: number, atLastStep = false) => setNav((s) => goToSlide(s, index, stepCounts, atLastStep)),
    }),
    [stepCounts],
  )

  // A live reload can remove slides; keep the position in range.
  useEffect(() => {
    if (total > 0 && nav.current > total - 1) actions.goTo(total - 1)
  }, [total, nav.current, actions])

  // URL hash mirrors the position (Part 1 §3.4). The first write replaces, later ones push history.
  const firstHashWrite = useRef(true)
  useEffect(() => {
    if (total === 0) return
    const hash = formatSlideHash(nav.current, nav.step)
    if (window.location.hash !== hash) {
      if (firstHashWrite.current) {
        window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${hash}`)
      } else window.location.hash = hash
    }
    firstHashWrite.current = false
  }, [nav.current, nav.step, total])

  // Browser back/forward moves slides and steps.
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseSlideHash(window.location.hash, stepCounts)
      if (!parsed) return
      setNav((s) => {
        if (s.current === parsed.current && s.step === parsed.step) return s
        const direction = parsed.current !== s.current ? Math.sign(parsed.current - s.current) : parsed.step >= s.step ? 1 : -1
        return { ...parsed, direction }
      })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [stepCounts])

  // Dev mode is state; the URL follows so links and reloads keep it.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (devMode) url.searchParams.set('mode', 'dev')
    else if (url.searchParams.get('mode') === 'dev') url.searchParams.delete('mode')
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url)
  }, [devMode])

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }, [])

  const openOverview = useCallback(() => {
    setFocused(nav.current)
    setOverviewOpen(true)
  }, [nav.current])

  const openPresenter = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('presenter', 'true')
    window.open(url, 'presenter-view', 'width=1200,height=800,menubar=no,toolbar=no')
  }, [])

  const editSlide = useCallback(() => {
    if (deck) navigateTo(editorUrl(deck, nav.current + 1))
  }, [deck, nav.current])

  const canPresent = !presenterView && !exported
  const stepsOnSlide = stepCounts[nav.current] ?? 0

  // Keyboard map (Part 1 §3.7). The handler is rebuilt every render and read through a ref.
  const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {})
  keyHandler.current = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target) || paletteOpen || shortcutsOpen) return
    const mod = event.metaKey || event.ctrlKey
    if (mod && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      setPaletteOpen(true)
      return
    }
    if (mod || event.altKey) return // leave browser shortcuts alone
    if (event.key === '?') {
      setShortcutsOpen(true)
      return
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    switch (key) {
      case 'd':
        setDevMode((d) => !d)
        return
      case 'f':
        if (devMode) setDevFitMode((f) => !f)
        else toggleFullscreen()
        return
      case 'm':
        openOverview()
        return
      case 'p':
        if (canPresent) openPresenter()
        return
    }

    if (overviewOpen) {
      switch (key) {
        case 'Escape':
          setOverviewOpen(false)
          break
        case 'ArrowRight':
          setFocused((f) => Math.min(total - 1, f + 1))
          break
        case 'ArrowLeft':
          setFocused((f) => Math.max(0, f - 1))
          break
        case 'ArrowDown':
          setFocused((f) => Math.min(total - 1, f + columnsRef.current))
          break
        case 'ArrowUp':
          setFocused((f) => Math.max(0, f - columnsRef.current))
          break
        case 'Enter':
        case ' ':
          actions.goTo(focused)
          setOverviewOpen(false)
          break
        case 'Tab':
          setPreviewMode((p) => !p)
          break
        case 'Home':
          setFocused(0)
          break
        case 'End':
          setFocused(total - 1)
          break
        default:
          return
      }
      event.preventDefault()
      return
    }

    switch (key) {
      case 'Escape':
        if (exported || !deck) openOverview()
        else editSlide()
        break
      case 'Tab':
        openOverview()
        break
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
      default:
        return
    }
    event.preventDefault()
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => keyHandler.current(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Pointer input (Part 1 §3.8): click advances, right click retreats, a horizontal swipe does either.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)
  const blocked = (target: EventTarget) =>
    overviewOpen ||
    paletteOpen ||
    shortcutsOpen ||
    (target instanceof Element && !!target.closest('button, a, input, textarea, select, [data-no-advance]'))

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      overviewOpen
        ? { id: 'overview-close', name: 'Close Overview', category: 'view', shortcut: ['Esc'], action: () => setOverviewOpen(false) }
        : { id: 'overview-open', name: 'Open Overview', description: 'Grid of every slide', category: 'view', shortcut: ['M'], action: openOverview },
      { id: 'overview-preview', name: 'Toggle Preview', description: 'Large preview in the overview', category: 'view', shortcut: ['Tab'], action: () => {
        setOverviewOpen(true)
        setPreviewMode((p) => !p)
      } },
      { id: 'next', name: stepsOnSlide > nav.step ? 'Next Step' : 'Next Slide', category: 'action', shortcut: ['→'], action: actions.advance },
      { id: 'prev', name: nav.step > 0 ? 'Previous Step' : 'Previous Slide', category: 'action', shortcut: ['←'], action: actions.retreat },
      ...(stepsOnSlide > 0
        ? [{ id: 'skip', name: 'Skip to Next Slide', description: 'Skip the remaining steps', category: 'action' as const, shortcut: ['↓'], action: actions.nextSlide }]
        : []),
      { id: 'dev', name: devMode ? 'Exit Dev Mode' : 'Enter Dev Mode', description: 'Overflow warnings and frame outline', category: 'view', shortcut: ['D'], action: () => setDevMode((d) => !d) },
      ...(devMode
        ? [{ id: 'fit', name: devFitMode ? 'Switch to Actual Size' : 'Switch to Fit', category: 'view' as const, shortcut: ['F'], action: () => setDevFitMode((f) => !f) }]
        : [{ id: 'fullscreen', name: isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen', category: 'view' as const, shortcut: ['F'], action: toggleFullscreen }]),
      ...(canPresent
        ? [{ id: 'presenter', name: 'Open Presenter View', description: 'Open presenter notes and timer in new window', category: 'view' as const, shortcut: ['P'], action: openPresenter }]
        : []),
      { id: 'shortcuts', name: 'Keyboard Shortcuts', category: 'action', shortcut: ['?'], action: () => setShortcutsOpen(true) },
    ]
    if (!exported) {
      list.push({ id: 'home', name: 'Go to Home', category: 'navigation', action: () => navigateTo(homeUrl()) })
      if (deck) {
        list.push({ id: 'edit', name: 'Edit Presentation', description: `Open slide ${nav.current + 1} in the editor`, category: 'navigation', shortcut: ['Esc'], action: editSlide })
        list.push({ id: 'chat', name: 'Chat', description: 'Edit with AI assistant', category: 'navigation', action: () => navigateTo(chatUrl(deck)) })
      }
    }
    slides.forEach((_, i) => list.push({ id: `slide-${i}`, name: `Go to Slide ${i + 1}`, category: 'navigation', action: () => actions.goTo(i) }))
    return list
  }, [overviewOpen, openOverview, stepsOnSlide, nav.step, nav.current, actions, devMode, devFitMode, isFullscreen, toggleFullscreen, canPresent, openPresenter, exported, deck, editSlide, slides])

  const mode: AppMode = overviewOpen ? 'miniature' : devMode ? 'dev' : 'presentation'

  if (total === 0) {
    return (
      <div className="presentation">
        <div className="presentation__empty">No slides yet</div>
      </div>
    )
  }

  const current = Math.min(nav.current, total - 1)
  const slide = slides[current]
  // A canvas run is one stage: moving inside it only moves the camera (Part 1 §9.3).
  const run = analysis.canvasRuns[analysis.runOfSlide[current]]
  const onCanvas = !!run?.canvas
  const runFirst = run?.indices[0] ?? current
  const stageKey = onCanvas ? `canvas-${run.canvas}-${runFirst}` : `slide-${current}`
  const transitionSource = onCanvas ? slides[runFirst] : slide
  const variants = slideVariants[resolveTransition(transitionSource.props.transition, onCanvas ? 'fade' : 'slide')]
  const liveSteps = { step: nav.step, total: stepsOnSlide }
  const light = slide.props.theme === 'light' || (!!slide.props.chrome && slide.props.chrome !== 'none')

  return (
    <MotionConfig reducedMotion="user" transition={springs.smooth}>
      <div
        className="presentation"
        onClick={(event) => {
          if (suppressClick.current || blocked(event.target)) return
          actions.advance()
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          if (!blocked(event.target)) actions.retreat()
        }}
        onPointerDown={(event) => {
          if (event.pointerType === 'touch') touchStart.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={(event) => {
          const start = touchStart.current
          touchStart.current = null
          if (!start || event.pointerType !== 'touch' || blocked(event.target)) return
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          if (Math.abs(dx) < SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
          suppressClick.current = true // the tap that ends a swipe must not also advance
          setTimeout(() => (suppressClick.current = false), 400)
          if (dx < 0) actions.advance()
          else actions.retreat()
        }}
      >
        <LayoutGroup>
          <AnimatePresence mode="sync" custom={nav.direction}>
            <motion.div
              key={stageKey}
              className="presentation__slide"
              custom={nav.direction}
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {onCanvas ? (
                <CanvasStage
                  slides={run.indices.map((i) => slides[i])}
                  activeIndex={current - runFirst}
                  renderSlide={(runSlide, _i, active) => (
                    // The rest of the canvas is the map around the focused slide: always fully built.
                    <StepContext.Provider value={active ? liveSteps : ALL_STEPS_STATE}>
                      {cloneElement(runSlide, { direction: nav.direction, _skipAnimation: true, _fixedScale: 1, _devMode: devMode, _devFitMode: devFitMode })}
                    </StepContext.Provider>
                  )}
                />
              ) : (
                <StepContext.Provider value={liveSteps}>
                  {cloneElement(slide, { direction: nav.direction, _skipAnimation: true, _devMode: devMode, _devFitMode: devFitMode })}
                </StepContext.Provider>
              )}
            </motion.div>
          </AnimatePresence>
        </LayoutGroup>

        <ProgressIndicator total={total} current={nav.current} step={nav.step} stepsOnSlide={stepsOnSlide} light={light} onSelect={(i) => actions.goTo(i)} />

        {devMode ? (
          <DevOverlay fitMode={devFitMode} onToggleFit={() => setDevFitMode((f) => !f)} onExit={() => setDevMode(false)} />
        ) : (
          <div className="presentation__controls" data-no-advance>
            <button type="button" className="presentation-view-button" onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </button>
          </div>
        )}

        <AnimatePresence>
          {overviewOpen && (
            <Overview
              slides={slides}
              current={nav.current}
              focused={focused}
              previewMode={previewMode}
              onFocus={setFocused}
              onSelect={(i) => {
                actions.goTo(i)
                setOverviewOpen(false)
              }}
              onClose={() => setOverviewOpen(false)}
              onColumnsChange={(columns) => (columnsRef.current = columns)}
              onEditSlide={
                exported
                  ? undefined
                  : (i) => {
                      actions.goTo(i)
                      setDevMode(true)
                      setOverviewOpen(false)
                    }
              }
            />
          )}
        </AnimatePresence>

        <GlobalCommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} mode={mode === 'miniature' ? 'Overview' : mode === 'dev' ? 'Dev' : 'Presentation'} commands={commands} />
        <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} mode={mode} />
      </div>
    </MotionConfig>
  )
}

export const Presentation = defineComponent<PresentationProps>({
  Component: PresentationComponent,
  registry: {
    id: 'presentation',
    name: 'Presentation',
    category: 'component',
    description: 'The deck root; every child Slide is one slide.',
    props: [],
    snippet: '<Presentation>\n\n<Slide>\n  <Title>First slide</Title>\n</Slide>\n\n</Presentation>',
    previewCode: '<Slide theme="dark">\n  <Title>Presentation</Title>\n  <Subtitle>Wraps every slide</Subtitle>\n</Slide>',
    keywords: ['deck', 'root', 'presentation'],
    useCases: ['The outermost element of every deck'],
  },
})

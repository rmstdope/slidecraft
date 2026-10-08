import { Children, isValidElement, useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { slideVariants, TRANSITIONS, type SlideTransition } from '../../animations/variants'
import { appPath } from '../../basePath'
import { SLIDE_ACCENTS, type SlideAccent } from './accents'
import { CorporateFrame } from './chrome/CorporateFrame'
import { CHROME_PADDING, SECTION_TEXT_MAX_WIDTH } from './chrome/geometry'
import { defineComponent } from './defineComponent'
import { gradientFor, GRADIENTS, type SlideGradient } from './gradients'
import { SlideLayoutContext, type SlideChrome, type SlideLayout } from './slideLayoutContext'
import { useInThumbnail } from './thumbnailContext'

export const DESIGN_WIDTH = 1920
export const DESIGN_HEIGHT = 1080
export const DOCUMENT_BODY_GAP = 56

const THEMES = ['dark', 'light'] as const
const LAYOUTS = ['centered', 'document'] as const
const CHROMES = ['none', 'title', 'section', 'content'] as const

export type SlideTheme = (typeof THEMES)[number]

export interface SlideCamera {
  x?: number
  y?: number
  scale?: number
  rotate?: number
}

export interface SlideProps {
  children?: ReactNode
  theme?: SlideTheme
  accent?: SlideAccent
  gradient?: SlideGradient
  /** Any CSS background; wins over gradient. */
  background?: string
  layout?: SlideLayout
  chrome?: SlideChrome
  transition?: SlideTransition
  /** Slides sharing a canvas name lie on one plane (Phase 3). */
  canvas?: string
  camera?: SlideCamera
  /** Skipped when presenting; shown dimmed in the editor. */
  hidden?: boolean
  className?: string
  /** Framer `custom` for direction-aware variants. */
  direction?: number
  /** Internal: the presentation's stage wrapper animates, not the slide. */
  _skipAnimation?: boolean
  /** Internal: use this scale instead of fitting the window (canvas, PDF). */
  _fixedScale?: number
  _devMode?: boolean
  _devFitMode?: boolean
}

/** Enum props fall back to their default: a typo while editing must not crash the deck. */
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

const displayNameOf = (node: ReactNode): string | undefined => {
  if (!isValidElement(node) || typeof node.type === 'string') return undefined
  const type = node.type as { displayName?: string; name?: string }
  return type.displayName ?? type.name
}

/** The leading run of Subtitle/Title children is the document header; the rest is the body. */
export function splitHeaderBody(children: ReactNode): { header: ReactNode[]; body: ReactNode[] } {
  const items = Children.toArray(children)
  let end = 0
  while (end < items.length) {
    const item = items[end]
    const name = displayNameOf(item)
    if (name === 'Title' || name === 'Subtitle' || (typeof item === 'string' && item.trim() === '')) end++
    else break
  }
  return { header: items.slice(0, end), body: items.slice(end) }
}

const windowScale = () =>
  typeof window === 'undefined' ? 1 : Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT)

function useStageScale(fixedScale: number | undefined, inThumbnail: boolean): number {
  const [scale, setScale] = useState(windowScale)
  useLayoutEffect(() => {
    if (fixedScale != null || inThumbnail) return
    const onResize = () => setScale(windowScale())
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [fixedScale, inThumbnail])
  if (inThumbnail) return 1 // the thumbnail owns scaling
  return fixedScale ?? scale
}

const px = (value: string) => Number.parseFloat(value) || 0

function SlideComponent({
  children,
  theme: themeProp,
  accent: accentProp,
  gradient: gradientProp,
  background,
  layout: layoutProp,
  chrome: chromeProp,
  transition: transitionProp,
  className = '',
  direction = 1,
  _skipAnimation = false,
  _fixedScale,
  _devMode = false,
  _devFitMode = true,
}: SlideProps) {
  const chrome = pick(chromeProp, CHROMES, 'none')
  const corporate = chrome !== 'none'
  const theme: SlideTheme = corporate ? 'light' : pick(themeProp, THEMES, 'dark')
  const accent = pick(accentProp, SLIDE_ACCENTS, 'yellow')
  const gradient = corporate ? 'none' : pick(gradientProp, GRADIENTS, 'none')
  const layout: SlideLayout = chrome === 'content' ? 'document' : pick(layoutProp, LAYOUTS, 'centered')
  const transition = pick(transitionProp, TRANSITIONS, 'slide')
  const isDocument = layout === 'document'

  const slideRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const inThumbnail = useInThumbnail()
  const scale = useStageScale(_fixedScale, inThumbnail)

  const { header, body } = isDocument ? splitHeaderBody(children) : { header: [], body: [] }
  const hasHeader = header.length > 0

  // Auto-fit on overflow (Part 1 §6.6): measure untransformed, shrink the body to fit.
  const [fit, setFit] = useState({ scale: 1, overflow: false })
  const measure = useCallback(() => {
    const target = isDocument ? bodyRef.current : innerRef.current
    const content = contentRef.current
    if (!target || !content) return
    // Measure the untransformed layout: a hidden build step offset sideways, or an item mid-entry,
    // must not count as overflow. The class turns off every transform in the subtree (see global.css).
    target.classList.add('is-measuring')
    void target.offsetWidth // force reflow
    const cs = getComputedStyle(content)
    const availableWidth = DESIGN_WIDTH - px(cs.paddingLeft) - px(cs.paddingRight)
    let availableHeight = DESIGN_HEIGHT - px(cs.paddingTop) - px(cs.paddingBottom)
    if (isDocument) availableHeight -= (headerRef.current?.offsetHeight ?? 0) + (hasHeader ? DOCUMENT_BODY_GAP : 0)
    const overflowX = target.scrollWidth > availableWidth + 1
    const overflowY = target.scrollHeight > availableHeight + 1
    const overflow = overflowX || overflowY
    const scale = overflow
      ? Math.min(overflowX ? availableWidth / target.scrollWidth : 1, overflowY ? availableHeight / target.scrollHeight : 1)
      : 1
    target.classList.remove('is-measuring')
    setFit((current) => (Math.abs(current.scale - scale) < 0.001 && current.overflow === overflow ? current : { scale, overflow }))
  }, [isDocument, hasHeader])

  useLayoutEffect(() => {
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => measure())
    for (const el of [innerRef.current, headerRef.current, bodyRef.current]) if (el) observer?.observe(el)
    let cancelled = false
    document.fonts?.ready.then(() => !cancelled && measure())
    const timers = [setTimeout(measure, 100), setTimeout(measure, 500)]
    return () => {
      cancelled = true
      observer?.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [measure])

  const actualMode = _devMode && !_devFitMode
  const appliedFit = actualMode ? 1 : fit.scale
  const fitTransform = appliedFit < 1 ? `scale(${appliedFit})` : undefined
  const showBadge = _devMode && fit.scale < 0.99

  const backgroundStyle: CSSProperties = background
    ? { background }
    : { backgroundImage: gradientFor(theme, gradient, accent) }

  const contentPadding = corporate ? CHROME_PADDING[chrome] : isDocument ? '72px 90px 132px' : 80
  const alignStart = isDocument || corporate

  const variantProps = _skipAnimation
    ? {}
    : { variants: slideVariants[transition], initial: 'initial', animate: 'animate', exit: 'exit', custom: direction }

  return (
    <motion.div
      ref={slideRef}
      className={`slide theme-${theme} accent-${accent} ${className}`.trim()}
      data-theme={theme}
      data-chrome={chrome}
      {...variantProps}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...backgroundStyle,
      }}
    >
      <motion.div
        layout
        className="slide__stage"
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          minWidth: DESIGN_WIDTH,
          minHeight: DESIGN_HEIGHT,
          flex: '0 0 auto',
          scale,
          transformOrigin: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {corporate && <CorporateFrame variant={chrome as Exclude<SlideChrome, 'none'>} />}
        {showBadge && (
          <div className="slide__dev-badge" role="status">
            {actualMode ? 'Content overflows slide bounds' : `Content scaled to fit (${Math.round(fit.scale * 100)}%)`}
          </div>
        )}
        <div
          ref={contentRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: alignStart ? 'flex-start' : 'center',
            padding: contentPadding,
            textAlign: corporate ? 'left' : undefined,
          }}
        >
          <div
            ref={innerRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isDocument ? 'stretch' : corporate ? 'flex-start' : 'center',
              justifyContent: isDocument ? 'flex-start' : 'center',
              gap: isDocument ? 0 : chrome === 'title' ? 40 : 48,
              // A definite width so percentage max-widths (Title 90%/94%) resolve against the content area.
              width: '100%',
              height: isDocument ? '100%' : undefined,
              maxWidth: chrome === 'section' ? SECTION_TEXT_MAX_WIDTH : undefined,
              transform: isDocument ? undefined : fitTransform,
              transformOrigin: 'center',
            }}
          >
            <SlideLayoutContext.Provider value={{ layout, devMode: _devMode, chrome, accent }}>
              {isDocument ? (
                <>
                  {hasHeader && (
                    <div
                      ref={headerRef}
                      className="slide__header"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 18,
                        paddingBottom: 24,
                        borderBottom: corporate ? undefined : '4px solid var(--accent)',
                      }}
                    >
                      {header}
                      {corporate && <div className="slide__sheared-rule" aria-hidden />}
                    </div>
                  )}
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      minHeight: 0,
                      paddingTop: hasHeader ? DOCUMENT_BODY_GAP : 0,
                    }}
                  >
                    <div
                      ref={bodyRef}
                      style={{ display: 'flex', flexDirection: 'column', gap: 40, transform: fitTransform, transformOrigin: 'center' }}
                    >
                      {body}
                    </div>
                  </div>
                </>
              ) : (
                children
              )}
            </SlideLayoutContext.Provider>
          </div>
        </div>
        {isDocument && !corporate && <div className="slide__footer-rule" aria-hidden />}
        {!corporate && (
          <img
            className="slide__logo"
            src={theme === 'dark' ? appPath('/logo-on-dark.svg') : appPath('/logo-on-light.svg')}
            alt=""
            aria-hidden
          />
        )}
      </motion.div>
    </motion.div>
  )
}

export const Slide = defineComponent<SlideProps>({
  Component: SlideComponent,
  registry: {
    id: 'slide',
    name: 'Slide',
    category: 'component',
    description: 'One 1920×1080 slide with a theme, an accent, a layout and a transition.',
    props: [
      { name: 'theme', type: '"dark" | "light"', default: '"dark"', description: 'Colour theme; forced to light by chrome' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy"', default: '"yellow"', description: 'The single slide colour; children inherit it' },
      { name: 'gradient', type: '"none" | "radial" | "radial-accent" | "diagonal" | "spotlight"', default: '"none"', description: 'Background gradient' },
      { name: 'background', type: 'string', description: 'Any CSS background; wins over gradient' },
      { name: 'layout', type: '"centered" | "document"', default: '"centered"', description: 'Hero stack, or header band + body + footer' },
      { name: 'chrome', type: '"none" | "title" | "section" | "content"', default: '"none"', description: 'Corporate frame; forces the light theme' },
      { name: 'transition', type: '"slide" | "fade" | "morph" | "slide-up" | "zoom" | "push" | "flip" | "cube"', default: '"slide"', description: 'How this slide enters' },
      { name: 'canvas', type: 'string', description: 'Slides sharing a canvas name lie on one plane' },
      { name: 'camera', type: '{ x?: number; y?: number; scale?: number; rotate?: number }', description: 'Placement on the canvas' },
      { name: 'hidden', type: 'boolean', default: 'false', description: 'Skipped when presenting' },
    ],
    snippet: '<Slide theme="dark" accent="yellow">\n  <Title>Slide title</Title>\n</Slide>',
    previewCode: '<Slide theme="dark" accent="yellow" gradient="radial-accent">\n  <Title>Slide title</Title>\n</Slide>',
    keywords: ['slide', 'page', 'frame', 'theme', 'background'],
    useCases: ['Every slide in a deck', 'Switching theme or accent per slide'],
  },
  toolbar: [
    { prop: 'theme', type: 'select', options: ['dark', 'light'] },
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy'] },
    { prop: 'gradient', type: 'select', options: ['none', 'radial', 'radial-accent', 'diagonal', 'spotlight'] },
    { prop: 'layout', type: 'select', options: ['centered', 'document'] },
  ],
})

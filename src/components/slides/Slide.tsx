import { Children, isValidElement, useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { Placement, Scheme } from '@shared/themes.ts'
import { slideVariants, type SlideTransition } from '../../animations/variants'
import { resolveSlideLook, type SlideLayout } from '../../themes/resolveSlideLook'
import { ThemeContext, useResolvedTheme } from '../../themes/ThemeContext'
import { themeCssVars, useThemeFonts } from '../../themes/themeStyle'
import type { SlideAccent } from './accents'
import { defineComponent } from './defineComponent'
import { gradientFor, type SlideGradient } from './gradients'
import { SlideLayoutContext } from './slideLayoutContext'
import { useInThumbnail } from './thumbnailContext'

export const DESIGN_WIDTH = 1920
export const DESIGN_HEIGHT = 1080
export const DOCUMENT_BODY_GAP = 56

export interface SlideCamera {
  x?: number
  y?: number
  scale?: number
  rotate?: number
}

export interface SlideProps {
  children?: ReactNode
  /** Dark or light colour scheme. Some themes and frames fix it. */
  scheme?: Scheme
  /** Use another theme than the deck's for this slide. */
  theme?: string
  /** A frame (slide master) from the theme, e.g. "title"; "none" for no frame. */
  frame?: string
  accent?: SlideAccent
  gradient?: SlideGradient
  /** Any CSS background; wins over gradient. */
  background?: string
  layout?: SlideLayout
  transition?: SlideTransition
  /** Slides sharing a canvas name lie on one plane. */
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

const placementStyle = (p: Placement): CSSProperties => ({
  position: 'absolute',
  top: p.top,
  right: p.right,
  bottom: p.bottom,
  left: p.left,
  height: p.height,
  opacity: p.opacity,
  pointerEvents: 'none',
})

const DEFAULT_FOOTER_TEXT: Placement = { left: 90, bottom: 44 }

function SlideComponent({
  children,
  scheme: schemeProp,
  theme: themeProp,
  frame: frameProp,
  accent: accentProp,
  gradient: gradientProp,
  background,
  layout: layoutProp,
  transition: transitionProp,
  className = '',
  direction = 1,
  _skipAnimation = false,
  _fixedScale,
  _devMode = false,
  _devFitMode = true,
}: SlideProps) {
  const theme = useResolvedTheme(themeProp)
  useThemeFonts(theme)
  const look = resolveSlideLook(
    { scheme: schemeProp, accent: accentProp, gradient: gradientProp, layout: layoutProp, transition: transitionProp, frame: frameProp },
    theme,
  )
  const { scheme, accent, gradient, layout, transition, frame, frameName } = look
  const isDocument = layout === 'document'
  const alignLeft = frame?.align === 'left'
  const unknownFrame = frameName !== 'none' && !frame

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
    // A hidden build step offset sideways, or an item mid-entry, must not count as overflow.
    target.classList.add('is-measuring')
    void target.offsetWidth // force reflow
    const cs = getComputedStyle(content)
    const availableWidth = DESIGN_WIDTH - px(cs.paddingLeft) - px(cs.paddingRight)
    let availableHeight = DESIGN_HEIGHT - px(cs.paddingTop) - px(cs.paddingBottom)
    if (isDocument) availableHeight -= (headerRef.current?.offsetHeight ?? 0) + (hasHeader ? DOCUMENT_BODY_GAP : 0)
    const overflowX = target.scrollWidth > availableWidth + 1
    const overflowY = target.scrollHeight > availableHeight + 1
    const overflow = overflowX || overflowY
    const next = overflow
      ? Math.min(overflowX ? availableWidth / target.scrollWidth : 1, overflowY ? availableHeight / target.scrollHeight : 1)
      : 1
    target.classList.remove('is-measuring')
    setFit((current) => (Math.abs(current.scale - next) < 0.001 && current.overflow === overflow ? current : { scale: next, overflow }))
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
  const fitBadge = _devMode && fit.scale < 0.99

  const backgroundStyle: CSSProperties = background ? { background } : { backgroundImage: gradientFor(scheme, gradient) }
  const padding = frame?.padding ? frame.padding.map((v) => `${v}px`).join(' ') : isDocument ? '72px 90px 132px' : 80
  const headerRule = isDocument ? (frame?.headerRule ?? 'accent') : 'none'
  const footerRule = isDocument && (frame ? frame.footerRule === true : theme.spec.footer?.rule !== false)
  const footerText = theme.spec.footer?.text
  const footerPlacement = frame ? frame.footerText : isDocument ? DEFAULT_FOOTER_TEXT : null
  const logoPlacement = frame ? frame.logo : theme.spec.logo
  const logoSrc = scheme === 'dark' ? theme.spec.logos?.onDark : theme.spec.logos?.onLight

  const variantProps = _skipAnimation
    ? {}
    : { variants: slideVariants[transition], initial: 'initial', animate: 'animate', exit: 'exit', custom: direction }

  const content = (
    <SlideLayoutContext.Provider value={{ layout, devMode: _devMode, accent, frame, align: alignLeft ? 'left' : 'center' }}>
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
                borderBottom: headerRule === 'accent' ? '4px solid var(--accent)' : undefined,
              }}
            >
              {header}
              {headerRule === 'bar' && <div className="slide__header-bar" aria-hidden />}
            </div>
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0, paddingTop: hasHeader ? DOCUMENT_BODY_GAP : 0 }}>
            <div ref={bodyRef} style={{ display: 'flex', flexDirection: 'column', gap: 40, transform: fitTransform, transformOrigin: 'center' }}>
              {body}
            </div>
          </div>
        </>
      ) : (
        children
      )}
    </SlideLayoutContext.Provider>
  )

  return (
    <motion.div
      className={`slide scheme-${scheme} accent-${accent} ${className}`.trim()}
      data-scheme={scheme}
      data-theme={theme.id}
      data-frame={frame ? frameName : undefined}
      {...variantProps}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...themeCssVars(theme),
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
        {/* Frame art is drawn in design space behind the content and never scales with the body. */}
        {frame?.svg && <img className="slide__frame" src={frame.svg} alt="" aria-hidden />}
        {(fitBadge || (_devMode && unknownFrame)) && (
          <div className="slide__dev-badge" role="status">
            {_devMode && unknownFrame
              ? `Unknown frame "${frameName}" in theme ${theme.spec.name}`
              : actualMode
                ? 'Content overflows slide bounds'
                : `Content scaled to fit (${Math.round(fit.scale * 100)}%)`}
          </div>
        )}
        <div
          ref={contentRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isDocument || alignLeft ? 'flex-start' : 'center',
            padding,
            textAlign: alignLeft ? 'left' : undefined,
          }}
        >
          <div
            ref={innerRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isDocument ? 'stretch' : alignLeft ? 'flex-start' : 'center',
              justifyContent: isDocument ? 'flex-start' : 'center',
              gap: isDocument ? 0 : (frame?.gap ?? 48),
              // A definite width so percentage max-widths (Title 90%/94%) resolve against the content area.
              width: '100%',
              height: isDocument ? '100%' : undefined,
              maxWidth: frame?.maxWidth,
              transform: isDocument ? undefined : fitTransform,
              transformOrigin: 'center',
            }}
          >
            {themeProp ? <ThemeContext.Provider value={theme}>{content}</ThemeContext.Provider> : content}
          </div>
        </div>
        {footerRule && <div className="slide__footer-rule" aria-hidden />}
        {footerText && footerPlacement && (
          <span className="slide__footer-text" style={{ ...placementStyle(footerPlacement), height: undefined, fontSize: frame?.footerText?.size ?? 22, color: frame?.footerText?.color ?? 'var(--muted)' }}>
            {footerText}
          </span>
        )}
        {logoPlacement && logoSrc && <img className="slide__logo" src={logoSrc} alt="" aria-hidden style={placementStyle(logoPlacement)} />}
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
    description: 'One 1920×1080 slide with a colour scheme, an accent, a layout and a transition, styled by the deck theme.',
    props: [
      { name: 'scheme', type: '"dark" | "light"', default: '"dark"', description: 'Colour scheme; some themes and frames fix it' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy"', default: '"yellow"', description: 'The single slide colour; children inherit it' },
      { name: 'gradient', type: '"none" | "radial" | "radial-accent" | "diagonal" | "spotlight"', default: '"none"', description: 'Background gradient' },
      { name: 'background', type: 'string', description: 'Any CSS background; wins over gradient' },
      { name: 'layout', type: '"centered" | "document"', default: '"centered"', description: 'Hero stack, or header band + body + footer' },
      { name: 'frame', type: 'string', description: 'A frame (slide master) from the theme, e.g. "title"; "none" for no frame' },
      { name: 'theme', type: 'string', description: "Use another theme than the deck's for this slide" },
      { name: 'transition', type: '"slide" | "fade" | "morph" | "slide-up" | "zoom" | "push" | "flip" | "cube"', default: '"slide"', description: 'How this slide enters' },
      { name: 'canvas', type: 'string', description: 'Slides sharing a canvas name lie on one plane' },
      { name: 'camera', type: '{ x?: number; y?: number; scale?: number; rotate?: number }', description: 'Placement on the canvas' },
      { name: 'hidden', type: 'boolean', default: 'false', description: 'Skipped when presenting' },
    ],
    snippet: '<Slide scheme="dark" accent="yellow">\n  <Title>Slide title</Title>\n</Slide>',
    previewCode: '<Slide scheme="dark" accent="yellow" gradient="radial-accent">\n  <Title>Slide title</Title>\n</Slide>',
    keywords: ['slide', 'page', 'frame', 'scheme', 'background'],
    useCases: ['Every slide in a deck', 'Switching scheme or accent per slide'],
  },
  toolbar: [
    { prop: 'scheme', type: 'select', options: ['dark', 'light'] },
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy'] },
    { prop: 'gradient', type: 'select', options: ['none', 'radial', 'radial-accent', 'diagonal', 'spotlight'] },
    { prop: 'layout', type: 'select', options: ['centered', 'document'] },
  ],
})

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants } from '../../animations/variants'
import { defineComponent } from './defineComponent'
import { useSlideLayout } from './slideLayoutContext'
import { textSignature } from './textSignature'

export type TitleSize = 'hero' | 'standard' | 'compact' | number

export interface TitleProps {
  children?: ReactNode
  /** Semantic preset, or an exact px size (no fitting). */
  size?: TitleSize
  /** Colour the text with the slide accent. */
  accent?: boolean
  /** white-space: nowrap; disables fitting and max-width. */
  nowrap?: boolean
  className?: string
}

interface SizePreset {
  ceiling: number
  floor: number
  fit: boolean
  maxLines: number
  maxWidth: string
}

const SIZE_PRESETS: Record<'hero' | 'standard' | 'compact', SizePreset> = {
  hero: { ceiling: 120, floor: 120, fit: false, maxLines: Infinity, maxWidth: '90%' },
  standard: { ceiling: 88, floor: 48, fit: true, maxLines: 2, maxWidth: '94%' },
  compact: { ceiling: 64, floor: 40, fit: true, maxLines: 2, maxWidth: '94%' },
}

export const DOCUMENT_TITLE_SIZE = 88
export const LINE_HEIGHT = 1.1

const countLines = (el: HTMLElement, size: number) => Math.round(el.offsetHeight / (size * LINE_HEIGHT))

/** Largest integer size in [floor, ceiling] whose rendered line count fits maxLines. */
export function fitTitleSize(el: HTMLElement, floor: number, ceiling: number, maxLines: number): number {
  let lo = floor
  let hi = ceiling
  let best = floor
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    el.style.fontSize = `${mid}px`
    if (countLines(el, mid) <= maxLines) {
      best = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  el.style.fontSize = `${best}px` // leave the DOM at the winner, not the last probe
  return best
}

const GRADE_TOOLTIP = {
  2: 'Two lines — consider shortening to a single line; let the eyebrow carry the subject',
  3: 'Title is too long (3+ lines) — shorten it to a single line',
} as const

function TitleComponent({ children, size = 'hero', accent = false, nowrap = false, className = '' }: TitleProps) {
  const { layout, devMode, frame, align } = useSlideLayout()
  const isDocument = layout === 'document'
  // A theme frame can fix the title size and colour, like a slide master's title placeholder.
  const frameSize = frame?.title?.size
  const isNumeric = typeof size === 'number'
  const preset: SizePreset = isNumeric
    ? { ceiling: size, floor: size, fit: false, maxLines: Infinity, maxWidth: '90%' }
    : (SIZE_PRESETS[size] ?? SIZE_PRESETS.hero)
  const shouldFit = preset.fit && !nowrap && !isDocument && !frameSize
  const baseSize = frameSize && !isNumeric ? frameSize : isDocument ? (isNumeric ? size : DOCUMENT_TITLE_SIZE) : preset.ceiling

  const ref = useRef<HTMLHeadingElement>(null)
  const [fitted, setFitted] = useState<number | null>(null)
  const [lines, setLines] = useState(1)
  const signature = textSignature(children)
  const grade = devMode && isDocument

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || (!shouldFit && !grade)) {
      setFitted(null)
      return
    }
    const run = () => {
      if (shouldFit) {
        const best = fitTitleSize(el, preset.floor, preset.ceiling, preset.maxLines)
        setFitted(best)
      } else {
        setLines(countLines(el, baseSize))
      }
    }
    run()
    const observer = typeof ResizeObserver === 'undefined' || !el.parentElement ? undefined : new ResizeObserver(run)
    if (el.parentElement) observer?.observe(el.parentElement)
    let cancelled = false
    document.fonts?.ready.then(() => !cancelled && run())
    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [shouldFit, grade, preset.floor, preset.ceiling, preset.maxLines, baseSize, signature])

  const alignLeft = isDocument || align === 'left'
  const color = accent ? 'var(--accent)' : (frame?.title?.color ?? 'var(--text)')
  const maxWidth = nowrap || frame ? undefined : isDocument ? '100%' : preset.maxWidth
  const gradeLevel = grade ? (lines >= 3 ? 3 : lines === 2 ? 2 : 0) : 0

  return (
    <motion.h1
      ref={ref}
      className={className || undefined}
      variants={itemVariants}
      title={gradeLevel ? GRADE_TOOLTIP[gradeLevel] : undefined}
      data-title-lines={grade ? lines : undefined}
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 'normal',
        fontSize: fitted ?? baseSize,
        lineHeight: LINE_HEIGHT,
        color,
        textAlign: alignLeft ? 'left' : 'center',
        maxWidth,
        whiteSpace: nowrap ? 'nowrap' : undefined,
        outline: gradeLevel ? `3px dashed ${gradeLevel === 3 ? 'var(--brand-red)' : 'var(--brand-yellow)'}` : undefined,
        outlineOffset: gradeLevel ? 8 : undefined,
      }}
    >
      {children}
    </motion.h1>
  )
}

export const Title = defineComponent<TitleProps>({
  Component: TitleComponent,
  registry: {
    id: 'title',
    name: 'Title',
    category: 'component',
    description: 'Main heading in the display font.',
    props: [
      { name: 'size', type: '"hero" | "standard" | "compact" | number', default: '"hero"', description: 'Semantic preset, or an exact px size' },
      { name: 'accent', type: 'boolean', default: 'false', description: 'Colour the heading with the slide accent' },
      { name: 'nowrap', type: 'boolean', default: 'false', description: 'Keep on one line; disables fitting' },
    ],
    snippet: '<Title>Your heading here</Title>',
    previewCode: '<Slide scheme="dark">\n  <Title>Your heading here</Title>\n</Slide>',
    keywords: ['heading', 'h1', 'header', 'headline'],
    useCases: ['Main slide heading', 'Section opener', 'Key statement'],
  },
  toolbar: [
    { prop: 'size', type: 'select', options: ['hero', 'standard', 'compact'] },
    { prop: 'accent', type: 'boolean' },
    { prop: 'nowrap', type: 'boolean' },
  ],
})

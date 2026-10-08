import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { countSteps } from '../../animations/steps'
import type { SlideProps } from './Slide'

export interface CanvasRun {
  canvas?: string
  indices: number[]
}

export interface DeckAnalysis {
  /** Visible slides (hidden ones dropped), in order. */
  slides: ReactElement<SlideProps>[]
  /** Highest build step per slide. */
  stepCounts: number[]
  /** Content of each slide's <Notes> child, if any. */
  notes: (ReactNode | undefined)[]
  canvasRuns: CanvasRun[]
  /** Slide index → index into canvasRuns. */
  runOfSlide: number[]
}

const nameOf = (element: ReactElement): string | undefined => {
  const type = element.type as unknown
  if (typeof type === 'string') return type
  if (typeof type === 'function' || (typeof type === 'object' && type !== null)) {
    const t = type as { displayName?: string; name?: string }
    return t.displayName ?? t.name
  }
  return undefined
}

export function extractNotes(slide: ReactElement<SlideProps>): ReactNode | undefined {
  for (const child of Children.toArray(slide.props.children)) {
    if (isValidElement<{ children?: ReactNode }>(child) && nameOf(child) === 'Notes') return child.props.children
  }
  return undefined
}

export function groupCanvasRuns(slides: ReactElement<SlideProps>[]): CanvasRun[] {
  const runs: CanvasRun[] = []
  slides.forEach((slide, index) => {
    const canvas = typeof slide.props.canvas === 'string' && slide.props.canvas.trim() !== '' ? slide.props.canvas : undefined
    const last = runs[runs.length - 1]
    if (canvas && last?.canvas === canvas) last.indices.push(index)
    else runs.push({ canvas, indices: [index] })
  })
  return runs
}

/**
 * Everything the runtime knows about a deck, derived from the element tree before any slide
 * mounts (Part 0 §0.5 item 3). Thumbnails, overview, presenter, reader and PDF all use this.
 */
export function analyzeDeck(children: ReactNode): DeckAnalysis {
  const slides = Children.toArray(children).filter(
    (child): child is ReactElement<SlideProps> => isValidElement<SlideProps>(child) && !child.props.hidden && nameOf(child) !== 'Notes',
  )
  const canvasRuns = groupCanvasRuns(slides)
  const runOfSlide: number[] = []
  canvasRuns.forEach((run, runIndex) => run.indices.forEach((i) => (runOfSlide[i] = runIndex)))
  return {
    slides,
    stepCounts: slides.map((slide) => countSteps(slide)),
    notes: slides.map(extractNotes),
    canvasRuns,
    runOfSlide,
  }
}

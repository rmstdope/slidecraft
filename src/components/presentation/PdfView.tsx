import { cloneElement, type ReactElement } from 'react'
import { MotionConfig } from 'motion/react'
import { ALL_STEPS_STATE, StepContext } from '../../animations/stepContext'
import { DESIGN_HEIGHT, DESIGN_WIDTH, type SlideProps } from '../slides/Slide'

export interface PdfViewProps {
  slides: ReactElement<SlideProps>[]
  /** 1-based slide to render alone; all slides when omitted. */
  only?: number
}

/**
 * Static render for PDF export (Part 1 §3.14): one 1920×1080 section per slide, every step
 * revealed, no motion. A headless browser prints it page by page (Phase 9).
 */
export function PdfView({ slides, only }: PdfViewProps) {
  const selected = only ? slides.slice(only - 1, only) : slides
  return (
    <MotionConfig reducedMotion="never" transition={{ duration: 0 }}>
      <div data-slidecraft-pdf-export="true" data-slide-count={slides.length}>
        {selected.map((slide, i) => (
          <section
            key={i}
            style={{ position: 'relative', width: DESIGN_WIDTH, height: DESIGN_HEIGHT, overflow: 'hidden', breakAfter: 'page' }}
          >
            <StepContext.Provider value={ALL_STEPS_STATE}>
              {cloneElement(slide, { _skipAnimation: true, _fixedScale: 1 })}
            </StepContext.Provider>
          </section>
        ))}
      </div>
    </MotionConfig>
  )
}

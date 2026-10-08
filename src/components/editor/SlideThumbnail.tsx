import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { ALL_STEPS_STATE, StepContext } from '../../animations/stepContext'
import { PreviewErrorBoundary } from '../ErrorBoundary'
import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../slides/Slide'
import { ThumbnailContext } from '../slides/thumbnailContext'

export interface SlideThumbnailProps {
  children?: ReactNode
  /** Fixed scale, or 'fit' to fill the positioned parent (measured). */
  scale?: number | 'fit'
  /** Dashed outline of the 1920×1080 frame. */
  showBorder?: boolean
  className?: string
}

/**
 * A slide rendered as a still (Part 1 §3.15): scaled with the inverse-percentage trick, motion
 * frozen, every build step revealed. Fills its positioned parent.
 */
export function SlideThumbnail({ children, scale = 'fit', showBorder = false, className }: SlideThumbnailProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0)

  useLayoutEffect(() => {
    if (scale !== 'fit') return
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setFitScale(Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT))
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(el)
    return () => observer?.disconnect()
  }, [scale])

  const s = scale === 'fit' ? fitScale : scale
  return (
    <div ref={outerRef} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {s > 0 && (
        <div
          data-slide-thumbnail="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${100 / s}%`,
            height: `${100 / s}%`,
            transform: `scale(${s})`,
            transformOrigin: 'top left',
          }}
        >
          <ThumbnailContext.Provider value>
            <MotionConfig reducedMotion="always">
              <StepContext.Provider value={ALL_STEPS_STATE}>
                <PreviewErrorBoundary>{children}</PreviewErrorBoundary>
              </StepContext.Provider>
            </MotionConfig>
          </ThumbnailContext.Provider>
        </div>
      )}
      {showBorder && s > 0 && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: DESIGN_WIDTH * s,
            height: DESIGN_HEIGHT * s,
            transform: 'translate(-50%, -50%)',
            border: '1px dashed var(--brand-yellow)',
          }}
        />
      )}
    </div>
  )
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { springs } from '../../animations/springs'
import { planeTransform, resolveCamera } from './camera'
import { DESIGN_HEIGHT, DESIGN_WIDTH, type SlideProps } from './Slide'

export interface CanvasStageProps {
  /** The slides of one canvas run, in order. */
  slides: ReactElement<SlideProps>[]
  /** Index into `slides` of the slide the camera focuses on. */
  activeIndex: number
  renderSlide: (slide: ReactElement<SlideProps>, indexInRun: number, active: boolean) => ReactNode
}

const { type: _type, ...cameraSpring } = springs.camera

/**
 * Slides laid out on one plane with a camera that moves between them (Part 1 §9.2). The camera
 * lives in springs, so panning and zooming never re-render React. Inactive slides stay on screen,
 * dimmed: they are the map that makes the move legible.
 */
export function CanvasStage({ slides, activeIndex, renderSlide }: CanvasStageProps) {
  const placements = useMemo(() => slides.map((slide, i) => resolveCamera(slide.props.camera, i)), [slides])
  const target = placements[Math.min(activeIndex, placements.length - 1)]

  const cx = useSpring(target.cx, cameraSpring)
  const cy = useSpring(target.cy, cameraSpring)
  const scale = useSpring(target.scale, cameraSpring)
  const rotate = useSpring(target.rotate, cameraSpring)
  useEffect(() => {
    cx.set(target.cx)
    cy.set(target.cy)
    scale.set(target.scale)
    rotate.set(target.rotate)
  }, [target, cx, cy, scale, rotate])

  const transform = useTransform([cx, cy, scale, rotate], ([x, y, s, r]: number[]) => planeTransform(x, y, s, r))

  // The plane lives in a 1920×1080 box scaled to the host, so canvas and ordinary slides agree on size.
  const hostRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  useLayoutEffect(() => {
    const host = hostRef.current?.parentElement
    if (!host) return
    const measure = () => setFit(Math.min(host.clientWidth / DESIGN_WIDTH, host.clientHeight / DESIGN_HEIGHT) || 1)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <div ref={hostRef} className="canvas-stage" data-active-index={activeIndex} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: DESIGN_WIDTH, height: DESIGN_HEIGHT, flex: '0 0 auto', transform: `scale(${fit})` }}>
        <motion.div style={{ position: 'absolute', top: 0, left: 0, width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transformOrigin: '0 0', transform }}>
          {slides.map((slide, i) => {
            const place = placements[i]
            const active = i === activeIndex
            return (
              <motion.div
                key={i}
                className="canvas-stage__slide"
                data-active={active || undefined}
                animate={{ opacity: active ? 1 : 0.45 }}
                transition={springs.camera}
                style={{
                  position: 'absolute',
                  left: place.x,
                  top: place.y,
                  width: DESIGN_WIDTH,
                  height: DESIGN_HEIGHT,
                  transform: `rotate(${place.rotate}deg) scale(${place.scale})`,
                  transformOrigin: 'center',
                  pointerEvents: active ? undefined : 'none',
                }}
              >
                {renderSlide(slide, i, active)}
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </div>
  )
}

import { DESIGN_HEIGHT, DESIGN_WIDTH } from './Slide'
import type { SlideCamera } from './Slide'

export const DEFAULT_CANVAS_GAP = 320

export interface ResolvedCamera {
  x: number
  y: number
  scale: number
  rotate: number
  /** Centre of the slide on the plane. */
  cx: number
  cy: number
}

/**
 * Where a slide sits on its canvas (Part 1 §9.1). Default: a left-to-right strip. Focusing a
 * slide moves its centre to the middle of the screen and undoes its scale and rotation.
 */
export function resolveCamera(camera: SlideCamera | undefined, indexInRun: number): ResolvedCamera {
  const scale = camera?.scale && camera.scale > 0 ? camera.scale : 1
  const x = camera?.x ?? indexInRun * (DESIGN_WIDTH + DEFAULT_CANVAS_GAP)
  const y = camera?.y ?? 0
  const rotate = camera?.rotate ?? 0
  return { x, y, scale, rotate, cx: x + DESIGN_WIDTH / 2, cy: y + DESIGN_HEIGHT / 2 }
}

/** The plane transform that brings a camera target to the centre of a 1920×1080 frame. */
export const planeTransform = (cx: number, cy: number, scale: number, rotate: number): string =>
  `translate(${DESIGN_WIDTH / 2}px, ${DESIGN_HEIGHT / 2}px) rotate(${-rotate}deg) scale(${1 / scale}) translate(${-cx}px, ${-cy}px)`

import type { MotionProps } from 'motion/react'
import { drawTransition } from '../../animations/springs'

/**
 * Connector drawing (Part 1 §10): spread on motion.path / motion.line so a diagram's connectors
 * draw in source order. pathLength is implemented with stroke-dasharray, so dashed connectors
 * cannot also draw; they fade, and the dashes keep their "weaker link" meaning.
 */
export function drawProps(order = 0, dashed = false): MotionProps {
  const transition = { ...drawTransition, delay: 0.2 + order * 0.12 }
  return dashed
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition }
    : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition }
}

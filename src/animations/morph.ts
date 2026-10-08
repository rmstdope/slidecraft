import type { MotionProps } from 'motion/react'
import { springs } from './springs'

/**
 * Shared-element morph (Part 1 §8): two slides giving a component the same id show one element
 * moving between two places. `layout: 'position'` moves the box without animating its size,
 * which would distort text in flight; the crossfade covers the size change.
 */
export function morphProps(morph?: string): MotionProps {
  return morph ? { layoutId: `morph-${morph}`, layout: 'position', transition: springs.morph } : {}
}

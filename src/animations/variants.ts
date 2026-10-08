import type { Transition, Variants } from 'motion/react'
import { exitSpring, smoothEase, springs } from './springs'

/** Merged into every slide's animate transition so children using itemVariants stagger in. */
export const orchestrate = { staggerChildren: 0.08, delayChildren: 0.12 } as const

const enter = (spring: Transition, extra: Transition = {}): Transition => ({ ...spring, ...orchestrate, ...extra })
const sign = (direction: number) => (direction >= 0 ? 1 : -1)

export const TRANSITIONS = ['slide', 'fade', 'morph', 'slide-up', 'zoom', 'push', 'flip', 'cube'] as const
export type SlideTransition = (typeof TRANSITIONS)[number]

/**
 * Direction-aware slide transitions (Part 1 §2.2). initial and exit are functions of the
 * `custom` direction: >= 0 is forward.
 */
export const slideVariants: Record<SlideTransition, Variants> = {
  slide: {
    initial: (d: number) => ({ opacity: 0, x: 300 * sign(d) }),
    animate: { opacity: 1, x: 0, transition: enter(springs.smooth) },
    exit: (d: number) => ({ opacity: 0, x: -300 * sign(d), transition: exitSpring }),
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: enter(springs.smooth) },
    exit: { opacity: 0, transition: exitSpring },
  },
  morph: {
    // The frame only crossfades; shared morph elements carry the movement.
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: enter(springs.morph) },
    exit: { opacity: 0, transition: { duration: 0.35, ease: smoothEase } },
  },
  'slide-up': {
    initial: (d: number) => ({ opacity: 0, y: 60 * sign(d) }),
    animate: { opacity: 1, y: 0, transition: enter(springs.smooth) },
    exit: (d: number) => ({ opacity: 0, y: -40 * sign(d), transition: exitSpring }),
  },
  zoom: {
    initial: (d: number) => ({ opacity: 0, scale: d >= 0 ? 0.85 : 1.15 }),
    animate: { opacity: 1, scale: 1, transition: enter(springs.gentle) },
    exit: (d: number) => ({ opacity: 0, scale: d >= 0 ? 1.15 : 0.85, transition: exitSpring }),
  },
  push: {
    // No opacity: the new slide pushes the old one out.
    initial: (d: number) => ({ x: d >= 0 ? '100%' : '-100%', zIndex: 1 }),
    animate: { x: 0, zIndex: 1, transition: enter(springs.gentle, { delayChildren: 0.25 }) },
    exit: (d: number) => ({ x: d >= 0 ? '-100%' : '100%', zIndex: 0, transition: springs.gentle }),
  },
  flip: {
    initial: (d: number) => ({ opacity: 0, rotateY: 90 * sign(d), transformPerspective: 1200 }),
    animate: { opacity: 1, rotateY: 0, transformPerspective: 1200, transition: enter(springs.gentle, { delayChildren: 0.25 }) },
    exit: (d: number) => ({ opacity: 0, rotateY: -90 * sign(d), transformPerspective: 1200, transition: exitSpring }),
  },
  cube: {
    initial: (d: number) => ({
      opacity: 0,
      rotateY: 90 * sign(d),
      x: d >= 0 ? '50%' : '-50%',
      transformPerspective: 1200,
      originX: d >= 0 ? 0 : 1,
    }),
    animate: { opacity: 1, rotateY: 0, x: 0, originX: 0.5, transformPerspective: 1200, transition: enter(springs.gentle, { delayChildren: 0.3 }) },
    exit: (d: number) => ({
      opacity: 0,
      rotateY: -90 * sign(d),
      x: d >= 0 ? '-50%' : '50%',
      originX: d >= 0 ? 1 : 0,
      transformPerspective: 1200,
      transition: exitSpring,
    }),
  },
}

/** Content items: animate when the slide's animate fires, staggered by orchestrate. */
export const itemVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: springs.snappy },
}

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: orchestrate },
}

export const scaleInVariants: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: springs.snappy },
}

export const spectrumVariants: Variants = {
  initial: { scaleX: 0 },
  animate: { scaleX: 1, transition: { duration: 0.8, ease: smoothEase } },
}

export const highlightVariants: Variants = {
  initial: { backgroundColor: 'rgba(0, 0, 0, 0)' },
  animate: { backgroundColor: 'var(--accent)', transition: { duration: 0.3 } },
}

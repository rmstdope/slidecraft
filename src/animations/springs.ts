import type { Transition } from 'motion/react'

/**
 * The five named springs (Part 1 §2.1). visualDuration is the time to reach the target, so the
 * values read as timings. Navigation is interruptible, and springs keep their velocity.
 */
export const springs = {
  /** Small UI moves: item reveals, hovers, controls. */
  snappy: { type: 'spring', visualDuration: 0.3, bounce: 0.1 },
  /** Default: slide transitions, step reveals, MotionConfig default. */
  smooth: { type: 'spring', visualDuration: 0.45, bounce: 0.15 },
  /** Larger travel where overshoot reads as weight (zoom, push, flip, cube). */
  gentle: { type: 'spring', visualDuration: 0.7, bounce: 0.22 },
  /** Shared-element morphs. */
  morph: { type: 'spring', visualDuration: 0.55, bounce: 0.16 },
  /** Camera moves over a canvas: long travel, almost no overshoot. */
  camera: { type: 'spring', visualDuration: 0.85, bounce: 0.08 },
} as const satisfies Record<string, Transition>

/** Exits are faster than entrances so the outgoing slide does not hold the stage. */
export const exitSpring = { type: 'spring', visualDuration: 0.28, bounce: 0 } as const satisfies Transition

export const smoothEase = [0.25, 0.1, 0.25, 1] as const

/** pathLength drawing reads better as a tween than as a spring. */
export const drawTransition = { duration: 0.6, ease: smoothEase } as const satisfies Transition

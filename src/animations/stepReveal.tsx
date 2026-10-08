import type { CSSProperties, ReactNode } from 'react'
import { motion, type Variants } from 'motion/react'
import { springs } from './springs'
import { useStepVisible } from './stepContext'
import { readStep } from './steps'

export const STEP_ENTERS = ['fade', 'rise', 'fall', 'scale', 'left', 'right'] as const
export type StepEnter = (typeof STEP_ENTERS)[number]

export const resolveEnter = (value: unknown): StepEnter =>
  typeof value === 'string' && (STEP_ENTERS as readonly string[]).includes(value) ? (value as StepEnter) : 'rise'

/** Offsets without opacity, for animating DOM children directly (Step stagger). */
export const hiddenOffsets: Record<StepEnter, Record<string, number>> = {
  fade: {},
  rise: { y: 28 },
  fall: { y: -28 },
  scale: { scale: 0.92 },
  left: { x: -40 },
  right: { x: 40 },
}

export const shownOffsets: Record<StepEnter, Record<string, number>> = {
  fade: {},
  rise: { y: 0 },
  fall: { y: 0 },
  scale: { scale: 1 },
  left: { x: 0 },
  right: { x: 0 },
}

/** Enter styles for build steps (Part 1 §5.2). */
export const enterVariants: Record<StepEnter, Variants> = Object.fromEntries(
  STEP_ENTERS.map((enter) => [
    enter,
    { hidden: { opacity: 0, ...hiddenOffsets[enter] }, shown: { opacity: 1, ...shownOffsets[enter] } },
  ]),
) as unknown as Record<StepEnter, Variants>

export interface StepRevealProps {
  at?: number
  enter?: StepEnter
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

/**
 * Reveals its children on beat `at`. Hidden content keeps its layout space, so the finished
 * layout exists from the first beat and nothing reflows as the slide builds.
 */
export function StepReveal({ at, enter = 'rise', className, style, children }: StepRevealProps) {
  const beat = readStep(at)
  const visible = useStepVisible(beat)
  if (beat == null) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      className={className}
      variants={enterVariants[resolveEnter(enter)]}
      initial="hidden"
      animate={visible ? 'shown' : 'hidden'}
      transition={springs.smooth}
      data-step-at={beat}
      style={{ ...style, pointerEvents: visible ? undefined : 'none' }}
    >
      {children}
    </motion.div>
  )
}

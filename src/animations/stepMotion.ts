import type { MotionProps } from 'motion/react'
import { morphProps } from './morph'
import { springs } from './springs'
import { useStepVisible } from './stepContext'
import { enterVariants, resolveEnter, type StepEnter } from './stepReveal'
import { readStep } from './steps'

/**
 * Motion props a component spreads on its own root motion element (Part 1 §5.3), so staging a
 * card does not wrap it and change how it sits in a grid. Spread after the component's own
 * orchestration variants: a staged component is driven by the build, not the entry stagger.
 */
export function useStepMotion(step?: number, morph?: string, enter: StepEnter = 'rise'): MotionProps {
  const beat = readStep(step)
  const visible = useStepVisible(beat)
  const staged: MotionProps =
    beat == null
      ? {}
      : {
          variants: enterVariants[resolveEnter(enter)],
          initial: 'hidden',
          animate: visible ? 'shown' : 'hidden',
          transition: springs.smooth,
        }
  return { ...staged, ...morphProps(morph) }
}

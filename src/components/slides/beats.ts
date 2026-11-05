import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { useStepState } from '../../animations/stepContext'
import { ALL_STEPS } from '../../animations/steps'
import { useInThumbnail } from './thumbnailContext'

/**
 * How far a staged component has got. Its first stage plays on entry; `count` later stages follow
 * either on a timer (seconds after entry, `delays`) or, with `steps`, on the presenter's beats 1…count.
 * Thumbnails, handouts and reduced motion show the last stage.
 */
export function useStages(count: number, steps: boolean | undefined, delays: readonly number[]): number {
  const reduced = useReducedMotion()
  const inThumbnail = useInThumbnail()
  const live = !reduced && !inThumbnail
  const { step } = useStepState()
  const [timed, setTimed] = useState(0)
  const timing = delays.slice(0, count).join(',')

  useEffect(() => {
    if (!live || steps) return
    setTimed(0)
    const timers = timing
      .split(',')
      .filter(Boolean)
      .map((d, i) => setTimeout(() => setTimed(i + 1), Number(d) * 1000))
    return () => timers.forEach(clearTimeout)
  }, [live, steps, timing])

  if (!live) return count
  if (steps) return step === ALL_STEPS ? count : Math.max(0, Math.min(count, step))
  return timed
}

/** True when motion should play (not a thumbnail, not reduced motion); else render the end state. */
export function useLive(): boolean {
  const reduced = useReducedMotion()
  return !reduced && !useInThumbnail()
}

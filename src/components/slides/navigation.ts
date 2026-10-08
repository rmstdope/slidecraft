/**
 * The navigation model (Part 1 §3.3) as pure functions, shared by the audience window and,
 * in Phase 8, the presenter window. Forward walks the beats before leaving a slide; backward
 * unwinds them and lands on the previous slide fully built.
 */
export interface NavState {
  current: number
  step: number
  /** +1 forward, -1 backward, 0 initially; passed to motion as `custom`. */
  direction: number
}

export const INITIAL_NAV: NavState = { current: 0, step: 0, direction: 0 }

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

export function goToSlide(state: NavState, index: number, stepCounts: number[], atLastStep = false): NavState {
  const total = stepCounts.length
  if (total === 0) return state
  const current = clamp(index, 0, total - 1)
  const step = atLastStep ? (stepCounts[current] ?? 0) : 0
  if (current === state.current && step === state.step) return state
  return { current, step, direction: current >= state.current ? (current === state.current ? state.direction : 1) : -1 }
}

export function nextSlide(state: NavState, stepCounts: number[]): NavState {
  return state.current < stepCounts.length - 1 ? { current: state.current + 1, step: 0, direction: 1 } : state
}

export function prevSlide(state: NavState): NavState {
  return state.current > 0 ? { current: state.current - 1, step: 0, direction: -1 } : state
}

export function advance(state: NavState, stepCounts: number[]): NavState {
  const steps = stepCounts[state.current] ?? 0
  return state.step < steps ? { ...state, step: state.step + 1, direction: 1 } : nextSlide(state, stepCounts)
}

export function retreat(state: NavState, stepCounts: number[]): NavState {
  if (state.step > 0) return { ...state, step: state.step - 1, direction: -1 }
  if (state.current > 0) return { current: state.current - 1, step: stepCounts[state.current - 1] ?? 0, direction: -1 }
  return state
}

const HASH_RE = /^#slide-(\d+)(?:-step-(\d+))?$/

/** Parse `#slide-N[-step-S]` (1-based slide); clamps into range. Null when the hash is not a slide hash. */
export function parseSlideHash(hash: string, stepCounts: number[]): { current: number; step: number } | null {
  const match = HASH_RE.exec(hash)
  if (!match || stepCounts.length === 0) return null
  const current = clamp(Number(match[1]) - 1, 0, stepCounts.length - 1)
  const step = clamp(Number(match[2] ?? 0), 0, stepCounts[current] ?? 0)
  return { current, step }
}

export const formatSlideHash = (current: number, step: number): string =>
  step > 0 ? `#slide-${current + 1}-step-${step}` : `#slide-${current + 1}`

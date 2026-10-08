import { createContext, useContext } from 'react'
import { ALL_STEPS } from './steps'

export interface StepState {
  step: number
  total: number
}

/** Outside a running deck every step is visible. */
export const ALL_STEPS_STATE: StepState = { step: ALL_STEPS, total: 0 }

export const StepContext = createContext<StepState>(ALL_STEPS_STATE)

export const useStepState = (): StepState => useContext(StepContext)

/** True when `at` is unset/non-positive, or the current step has reached it. */
export function useStepVisible(at?: number): boolean {
  const { step } = useContext(StepContext)
  return at == null || !Number.isFinite(at) || at <= 0 ? true : step >= at
}

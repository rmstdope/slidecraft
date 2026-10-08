import { useEffect, useState, type ComponentType } from 'react'
import { compileSlidePreview } from '../editor/compileSlide'
import { createScheduler } from './scheduler'

/** Gallery previews compile lazily, four at a time, each source once (Part 3 §7). */
const cache = new Map<string, ComponentType>()
const inFlight = new Map<string, Promise<ComponentType>>()
const scheduler = createScheduler(4)

function loadPreview(source: string): Promise<ComponentType> {
  const pending = inFlight.get(source)
  if (pending) return pending
  const job = scheduler
    .run(() => compileSlidePreview(source))
    .then((Component) => {
      cache.set(source, Component)
      return Component
    })
    .finally(() => inFlight.delete(source)) // failures can be retried
  inFlight.set(source, job)
  return job
}

export interface LazyPreview {
  Component: ComponentType | null
  error: string | null
  isCompiling: boolean
}

export function useLazyPreview(source: string, enabled: boolean): LazyPreview {
  const [state, setState] = useState<LazyPreview>(() => ({ Component: cache.get(source) ?? null, error: null, isCompiling: false }))
  useEffect(() => {
    const cached = cache.get(source)
    if (cached) return setState({ Component: cached, error: null, isCompiling: false })
    if (!enabled) return
    let live = true
    setState({ Component: null, error: null, isCompiling: true })
    loadPreview(source).then(
      (Component) => live && setState({ Component, error: null, isCompiling: false }),
      (error: Error) => live && setState({ Component: null, error: error.message, isCompiling: false }),
    )
    return () => {
      live = false
    }
  }, [source, enabled])
  return state
}

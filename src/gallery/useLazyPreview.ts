import { useEffect, useState, type ComponentType } from 'react'
import { compileSlidePreview } from '../editor/compileSlide'
import { createScheduler } from './scheduler'

/** Gallery previews compile lazily, four at a time, each source once (Part 3 §7). */
const cache = new Map<string, ComponentType>()
const inFlight = new Map<string, Promise<ComponentType>>()
const scheduler = createScheduler(4)

/** The built-ins-only preview (comparing a vault copy) is cached apart from the vault's. */
const keyOf = (source: string, builtinOnly: boolean) => (builtinOnly ? `<builtin>\n${source}` : source)

function loadPreview(source: string, builtinOnly: boolean): Promise<ComponentType> {
  const key = keyOf(source, builtinOnly)
  const pending = inFlight.get(key)
  if (pending) return pending
  const job = scheduler
    .run(() => compileSlidePreview(source, builtinOnly ? { vault: null } : {}))
    .then((Component) => {
      cache.set(key, Component)
      return Component
    })
    .finally(() => inFlight.delete(key)) // failures can be retried
  inFlight.set(key, job)
  return job
}

export interface LazyPreview {
  Component: ComponentType | null
  error: string | null
  isCompiling: boolean
}

/** `builtinOnly` renders with the built-in components, even where the vault replaces one. */
export function useLazyPreview(source: string, enabled: boolean, builtinOnly = false): LazyPreview {
  const [state, setState] = useState<LazyPreview>(() => ({ Component: cache.get(keyOf(source, builtinOnly)) ?? null, error: null, isCompiling: false }))
  useEffect(() => {
    const cached = cache.get(keyOf(source, builtinOnly))
    if (cached) return setState({ Component: cached, error: null, isCompiling: false })
    if (!enabled) return
    let live = true
    setState({ Component: null, error: null, isCompiling: true })
    loadPreview(source, builtinOnly).then(
      (Component) => live && setState({ Component, error: null, isCompiling: false }),
      (error: Error) => live && setState({ Component: null, error: error.message, isCompiling: false }),
    )
    return () => {
      live = false
    }
  }, [source, enabled, builtinOnly])
  return state
}

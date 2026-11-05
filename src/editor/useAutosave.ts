/**
 * Autosave for the workspace: save a moment after the last edit, and when the window loses focus.
 * The hook only decides *when*; `save` decides whether it is safe to (it may decline, e.g. while
 * the slide does not compile) and is not called again until the next edit.
 */
import { useEffect, useRef } from 'react'

export const AUTOSAVE_DELAY_MS = 1500

export interface AutosaveOptions {
  enabled: boolean
  dirty: boolean
  /** Changes on every edit (the deck model or raw text); each change restarts the delay. */
  version: unknown
  save: () => void
  delay?: number
}

export function useAutosave({ enabled, dirty, version, save, delay = AUTOSAVE_DELAY_MS }: AutosaveOptions): void {
  const latest = useRef({ enabled, dirty, save })
  latest.current = { enabled, dirty, save }

  useEffect(() => {
    if (!enabled || !dirty) return
    const timer = setTimeout(() => latest.current.save(), delay)
    return () => clearTimeout(timer)
  }, [enabled, dirty, version, delay])

  useEffect(() => {
    const onBlur = () => {
      if (latest.current.enabled && latest.current.dirty) latest.current.save()
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])
}

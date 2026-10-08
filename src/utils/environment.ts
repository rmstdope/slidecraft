import { IS_STATIC } from '../basePath'

/**
 * Exported or static context (Part 1 §3.2): the single-file HTML export, a file opened from
 * disk, or the static docs build. There is no editor and no API there.
 */
export function isExported(): boolean {
  if (IS_STATIC) return true
  if (typeof window === 'undefined') return false
  return window.location.protocol === 'file:' || window.location.pathname.endsWith('.html')
}

export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

/** Client-side navigation: push the URL and let the App router react, without a reload. */
export function navigateTo(url: string): void {
  window.history.pushState(null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** True for key events that come from a text field, where shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

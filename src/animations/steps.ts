import { isValidElement, type ReactNode } from 'react'

/** Sentinel meaning "show every step" (thumbnails, overview, PDF, reader, non-active canvas slides). */
export const ALL_STEPS = Number.POSITIVE_INFINITY
/** Upper bound so a typo like step={9999} cannot strand a presenter. */
export const MAX_STEPS = 40
const MAX_DEPTH = 24

/** floor(value) when it is a finite number > 0, else undefined. */
export function readStep(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !isValidElement(value) && Object.getPrototypeOf(value) === Object.prototype

const displayName = (type: unknown): string | undefined =>
  typeof type === 'function' || (typeof type === 'object' && type !== null)
    ? ((type as { displayName?: string; name?: string }).displayName ?? (type as { name?: string }).name)
    : undefined

/**
 * The highest build step referenced in a slide's element tree (Part 1 §2.3), capped at MAX_STEPS.
 * It is the beat number, not the count of distinct beats: a slide with only step={3} has three beats.
 */
export function countSteps(node: ReactNode, depth = 0): number {
  if (depth > MAX_DEPTH || node == null || typeof node === 'boolean') return 0
  if (Array.isArray(node)) return Math.min(MAX_STEPS, node.reduce<number>((max, child) => Math.max(max, countSteps(child, depth + 1)), 0))
  if (!isValidElement<Record<string, unknown>>(node)) return 0

  const props = node.props
  let max = readStep(props.step) ?? 0
  if (displayName(node.type) === 'Step') max = Math.max(max, readStep(props.at) ?? 0)
  for (const value of Object.values(props)) {
    if (!Array.isArray(value)) continue
    for (const entry of value) if (isPlainObject(entry)) max = Math.max(max, readStep(entry.step) ?? 0)
  }
  max = Math.max(max, countSteps(props.children as ReactNode, depth + 1))
  return Math.min(MAX_STEPS, max)
}

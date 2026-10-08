import { SCHEMES, type FrameSpec, type Scheme } from '@shared/themes.ts'
import { resolveTransition, type SlideTransition } from '../animations/variants'
import { SLIDE_ACCENTS, type SlideAccent } from '../components/slides/accents'
import { GRADIENTS, type SlideGradient } from '../components/slides/gradients'
import type { ResolvedTheme } from './registry'

export const LAYOUTS = ['centered', 'document'] as const
export type SlideLayout = (typeof LAYOUTS)[number]

/** Enum props fall back to their default: a typo while editing must not crash the deck. */
export function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

export interface SlideLookInput {
  scheme?: unknown
  accent?: unknown
  gradient?: unknown
  layout?: unknown
  transition?: unknown
  frame?: unknown
}

export interface SlideLook {
  scheme: Scheme
  accent: SlideAccent
  gradient: SlideGradient
  layout: SlideLayout
  transition: SlideTransition
  /** The frame the slide asked for (or the theme default); "none" for no frame. */
  frameName: string
  /** The frame's spec, when the theme has it. */
  frame?: FrameSpec
}

/**
 * A slide's final look: its own props, then the theme's frame, defaults and constraints.
 * Used by Slide to render and by Presentation for transitions and progress colours.
 */
export function resolveSlideLook(input: SlideLookInput, theme: ResolvedTheme): SlideLook {
  const spec = theme.spec
  const defaults = spec.defaults ?? {}
  const frameName = typeof input.frame === 'string' && input.frame.trim() !== '' ? input.frame : (defaults.frame ?? 'none')
  const frame = frameName === 'none' ? undefined : spec.frames?.[frameName]

  let scheme = frame?.scheme ?? pick(input.scheme, SCHEMES, defaults.scheme ?? 'dark')
  const allowed = spec.constraints?.schemes
  if (allowed?.length && !allowed.includes(scheme)) scheme = allowed[0]

  return {
    scheme,
    accent: pick(input.accent, SLIDE_ACCENTS, defaults.accent ?? 'yellow'),
    gradient: frame || spec.constraints?.gradients === false ? 'none' : pick(input.gradient, GRADIENTS, 'none'),
    layout: frame?.layout ?? pick(input.layout, LAYOUTS, defaults.layout ?? 'centered'),
    transition: resolveTransition(input.transition, resolveTransition(defaults.transition, 'slide')),
    frameName,
    frame,
  }
}

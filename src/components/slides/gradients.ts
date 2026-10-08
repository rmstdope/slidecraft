import { accentRgb, type AccentColor } from './accents'

export const GRADIENTS = ['none', 'radial', 'radial-accent', 'diagonal', 'spotlight'] as const
export type SlideGradient = (typeof GRADIENTS)[number]

const A = 'var(--accent-rgb)'

/**
 * Background images per theme (Part 1 §6.4). `var(--accent-rgb)` is string-replaced with the
 * accent's "r, g, b" at render, because rgba(var(--x)) with a triplet does not resolve in CSS.
 */
const gradientMap: Record<'dark' | 'light', Record<Exclude<SlideGradient, 'none'>, string>> = {
  dark: {
    radial: 'radial-gradient(ellipse at center, rgba(72, 72, 72, 0.4) 0%, transparent 70%)',
    'radial-accent': `radial-gradient(ellipse at 30% 70%, rgba(${A}, 0.15) 0%, transparent 50%)`,
    diagonal: 'linear-gradient(135deg, #222222 0%, #111111 100%)',
    spotlight: 'radial-gradient(ellipse at 50% 0%, rgba(150, 150, 150, 0.3) 0%, transparent 60%)',
  },
  light: {
    radial: `radial-gradient(ellipse 120% 120% at center, transparent 0%, rgba(${A}, 0.15) 40%, rgba(${A}, 0.3) 100%)`,
    'radial-accent': `radial-gradient(ellipse 80% 80% at 85% 15%, rgba(${A}, 0.35) 0%, rgba(${A}, 0.15) 40%, transparent 70%)`,
    diagonal: `linear-gradient(135deg, transparent 0%, rgba(${A}, 0.1) 40%, rgba(${A}, 0.22) 100%)`,
    spotlight: `radial-gradient(ellipse at 50% 0%, rgba(${A}, 0.22) 0%, transparent 70%), radial-gradient(ellipse at 50% 100%, rgba(${A}, 0.1) 0%, transparent 60%)`,
  },
}

export function gradientFor(theme: 'dark' | 'light', gradient: SlideGradient, accent: AccentColor): string | undefined {
  if (gradient === 'none') return undefined
  return gradientMap[theme][gradient].replaceAll(A, accentRgb(accent))
}

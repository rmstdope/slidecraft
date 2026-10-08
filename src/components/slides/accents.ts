/**
 * Accent roles (Part 2 §1.7). Components reference the CSS variables so a re-theme lands
 * everywhere at once; the hex table is only for tinting and blending.
 */
export const ACCENTS = ['yellow', 'red', 'teal', 'navy', 'gray'] as const
export type AccentColor = (typeof ACCENTS)[number]

/** The four slide accents (gray is a component-level neutral, not a slide accent). */
export const SLIDE_ACCENTS = ['yellow', 'red', 'teal', 'navy'] as const
export type SlideAccent = (typeof SLIDE_ACCENTS)[number]

export const GRAY = '#8a8f98'

export const accentColors: Record<AccentColor, string> = {
  yellow: 'var(--brand-yellow)',
  red: 'var(--brand-red)',
  teal: 'var(--accent-teal)',
  navy: 'var(--accent-navy)', // swapped for a lighter blue on dark slides by the theme
  gray: GRAY,
}

/** Literal values, kept in step with global.css. Navy is the light-theme value. */
export const accentHex: Record<AccentColor, string> = {
  yellow: '#f5b400',
  red: '#e0452b',
  teal: '#1f9e89',
  navy: '#1f3a5f',
  gray: GRAY,
}

export const isAccent = (value: unknown): value is AccentColor =>
  typeof value === 'string' && (ACCENTS as readonly string[]).includes(value)

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** "r, g, b" of an accent, for rgba() composition. */
export const accentRgb = (accent: AccentColor): string => hexToRgb(accentHex[accent]).join(', ')

/** rgba() of the accent at the given alpha: panel fills, hairlines, photo rings. */
export const tint = (accent: AccentColor, alpha: number): string => `rgba(${accentRgb(accent)}, ${alpha})`

/** Ink that reads on a solid fill of the accent. */
export function onAccent(accent: AccentColor): string {
  if (accent === 'yellow') return 'var(--ink)'
  if (accent === 'navy') return 'var(--on-navy, #ffffff)'
  return '#ffffff'
}

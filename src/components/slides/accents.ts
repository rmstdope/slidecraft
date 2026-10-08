/**
 * Accent roles (Part 2 §1.7). Components reference only the CSS variables, which the deck's
 * theme sets, so every colour here follows the theme.
 */
export const ACCENTS = ['yellow', 'red', 'teal', 'navy', 'gray'] as const
export type AccentColor = (typeof ACCENTS)[number]

/** The four slide accents (gray is a component-level neutral, not a slide accent). */
export const SLIDE_ACCENTS = ['yellow', 'red', 'teal', 'navy'] as const
export type SlideAccent = (typeof SLIDE_ACCENTS)[number]

export const accentColors: Record<AccentColor, string> = {
  yellow: 'var(--brand-yellow)',
  red: 'var(--brand-red)',
  teal: 'var(--accent-teal)',
  navy: 'var(--accent-navy)', // swapped for a lighter blue on dark slides by the scheme
  gray: 'var(--accent-gray)',
}

export const isAccent = (value: unknown): value is AccentColor =>
  typeof value === 'string' && (ACCENTS as readonly string[]).includes(value)

const percent = (alpha: number) => `${Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 10}%`

/**
 * The accent at the given opacity, for panel fills, hairlines and photo rings. Built with
 * color-mix on the theme variable, so it follows whatever theme the slide uses.
 */
export const tint = (accent: AccentColor, alpha: number): string => `color-mix(in srgb, ${accentColors[accent]} ${percent(alpha)}, transparent)`

/** Ink that reads on a solid fill of the accent. */
export function onAccent(accent: AccentColor): string {
  if (accent === 'yellow') return 'var(--ink)'
  if (accent === 'navy') return 'var(--on-navy, #ffffff)'
  return '#ffffff'
}

/** A valid accent role, or undefined (typos fall back to the caller's default). */
export const resolveAccent = (value: unknown): AccentColor | undefined => (isAccent(value) ? value : undefined)

/** An accent role or any raw CSS colour, as a CSS value. */
export const colorValue = (value: AccentColor | string): string => (isAccent(value) ? accentColors[value] : value)

export interface AccentShades {
  light: string
  base: string
  dark: string
}

/** Lighter tint, base and darker shade of each accent, for gradient-filled bars and nodes. */
export const accentShades: Record<AccentColor, AccentShades> = Object.fromEntries(
  ACCENTS.map((accent) => [
    accent,
    {
      light: `color-mix(in srgb, ${accentColors[accent]} 70%, white)`,
      base: accentColors[accent],
      dark: `color-mix(in srgb, ${accentColors[accent]} 75%, black)`,
    },
  ]),
) as Record<AccentColor, AccentShades>

/** Flat pastel fills for light "diagram" slides, with a saturated line colour each. */
export const PASTELS = {
  green: { bg: '#e3f4ea', line: '#2e9a5e' },
  yellow: { bg: '#fdf3d6', line: '#d99a00' },
  teal: { bg: '#ddf1ee', line: '#1f9e89' },
  red: { bg: '#fbe3e0', line: '#e0452b' },
  navy: { bg: '#e3e8f6', line: '#4c5fd5' },
  white: { bg: '#ffffff', line: '#8a8f98' },
  cream: { bg: '#faf6ee', line: '#b59f7b' },
} as const
export type PastelColor = keyof typeof PASTELS

/** Fixed ink for text on pastel fills, which stay light on either theme. */
export const PASTEL_INK = '#3a3a3a'

import type { ReactNode } from 'react'
import { accentColors } from './accents'
import { defineComponent } from './defineComponent'
import { useSlideLayout } from './slideLayoutContext'

const SOLID = { yellow: 'var(--brand-yellow)', red: 'var(--brand-red)', teal: 'var(--accent-teal)', navy: 'var(--accent-navy)' } as const

/** Decorative two-stop presets with no accent behind them (Part 2 §2.5); fixed in every theme. */
export const ACCENT_GRADIENTS = {
  emerald: ['#10b981', '#84cc16'],
  sunset: ['#f59e0b', '#ef4444'],
  gold: ['#d4a017', '#b8860b'],
} as const

/** Gradients mixed from a theme colour: "accent" is the slide's, the others name an accent. */
const THEMED_GRADIENTS = { accent: 'var(--accent)', teal: accentColors.teal, yellow: accentColors.yellow, red: accentColors.red, navy: accentColors.navy } as const

export type AccentGradient = keyof typeof THEMED_GRADIENTS | keyof typeof ACCENT_GRADIENTS

/** Light into the colour on dark slides, the colour into a deeper shade on light ones. */
export function themedGradientStops(color: string, scheme: 'dark' | 'light'): [string, string] {
  return scheme === 'dark' ? [`color-mix(in srgb, ${color} 55%, #ffffff)`, color] : [color, `color-mix(in srgb, ${color} 70%, #000000)`]
}

export interface AccentProps {
  children?: ReactNode
  /** A solid accent; defaults to the slide accent. */
  color?: keyof typeof SOLID
  gradient?: AccentGradient
  /** Custom gradient stops; both are required. */
  from?: string
  to?: string
  /** Gradient direction in degrees; 90 is left to right. */
  angle?: number
}

function AccentComponent({ children, color, gradient, from, to, angle = 90 }: AccentProps) {
  const { scheme } = useSlideLayout()
  const themed = gradient && gradient in THEMED_GRADIENTS ? THEMED_GRADIENTS[gradient as keyof typeof THEMED_GRADIENTS] : undefined
  const preset = gradient && gradient in ACCENT_GRADIENTS ? ACCENT_GRADIENTS[gradient as keyof typeof ACCENT_GRADIENTS] : undefined
  const stops = from && to ? [from, to] : themed ? themedGradientStops(themed, scheme) : preset
  const style = stops
    ? {
        display: 'inline',
        background: `linear-gradient(${angle}deg, ${stops[0]}, ${stops[1]})`,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
      }
    : { display: 'inline', color: (color && SOLID[color]) || 'var(--accent)' }
  return <span style={style}>{children}</span>
}

export const Accent = defineComponent<AccentProps>({
  Component: AccentComponent,
  registry: {
    id: 'accent',
    name: 'Accent',
    category: 'component',
    description: 'Inline text in the slide accent, another accent, or a gradient.',
    props: [
      { name: 'color', type: '"yellow" | "red" | "teal" | "navy"', description: 'Solid accent colour; defaults to the slide accent' },
      { name: 'gradient', type: '"accent" | "teal" | "yellow" | "red" | "navy" | "emerald" | "sunset" | "gold"', description: '"accent" and the accent names follow the theme; emerald, sunset and gold are fixed' },
      { name: 'from', type: 'string', description: 'Custom gradient start colour' },
      { name: 'to', type: 'string', description: 'Custom gradient end colour' },
      { name: 'angle', type: 'number', default: '90', description: 'Gradient direction in degrees' },
    ],
    snippet: '<Accent>highlighted text</Accent>',
    previewCode: '<Slide scheme="dark">\n  <Title>Make it <Accent>stand out</Accent></Title>\n</Slide>',
    keywords: ['highlight', 'gradient', 'color', 'emphasis', 'inline', 'span'],
    useCases: ['One emphasised word in a title', 'A key phrase in a paragraph'],
  },
  toolbar: [
    { prop: 'color', type: 'select', options: ['yellow', 'red', 'teal', 'navy'] },
    { prop: 'gradient', type: 'select', options: ['accent', 'teal', 'yellow', 'red', 'navy', 'emerald', 'sunset', 'gold'] },
  ],
})

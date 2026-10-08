import type { ReactNode } from 'react'
import { defineComponent } from './defineComponent'

const SOLID = { yellow: 'var(--brand-yellow)', red: 'var(--brand-red)', teal: 'var(--accent-teal)', navy: 'var(--accent-navy)' } as const

/** Two-stop gradient presets (Part 2 §2.5). */
export const ACCENT_GRADIENTS = {
  teal: ['#38bdf8', '#22d3ee'],
  emerald: ['#10b981', '#84cc16'],
  sunset: ['#f59e0b', '#ef4444'],
  yellow: ['#facc15', '#f59e0b'],
  red: ['#ef4444', '#ec4899'],
  gold: ['#d4a017', '#b8860b'],
} as const

export interface AccentProps {
  children?: ReactNode
  color?: keyof typeof SOLID
  gradient?: keyof typeof ACCENT_GRADIENTS
  /** Custom gradient stops; both are required. */
  from?: string
  to?: string
  /** Gradient direction in degrees; 90 is left to right. */
  angle?: number
}

function AccentComponent({ children, color, gradient, from, to, angle = 90 }: AccentProps) {
  const stops = from && to ? [from, to] : gradient ? ACCENT_GRADIENTS[gradient] : undefined
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
    description: 'Inline text highlight with color or gradient.',
    props: [
      { name: 'color', type: '"yellow" | "red" | "teal" | "navy"', description: 'Solid accent colour' },
      { name: 'gradient', type: '"teal" | "emerald" | "sunset" | "yellow" | "red" | "gold"', description: 'Preset gradient fill' },
      { name: 'from', type: 'string', description: 'Custom gradient start colour' },
      { name: 'to', type: 'string', description: 'Custom gradient end colour' },
      { name: 'angle', type: 'number', default: '90', description: 'Gradient direction in degrees' },
    ],
    snippet: '<Accent gradient="teal">highlighted text</Accent>',
    previewCode: '<Slide theme="dark">\n  <Title>Make it <Accent gradient="teal">stand out</Accent></Title>\n</Slide>',
    keywords: ['highlight', 'gradient', 'color', 'emphasis', 'inline', 'span'],
    useCases: ['One emphasised word in a title', 'A key phrase in a paragraph'],
  },
  toolbar: [
    { prop: 'color', type: 'select', options: ['yellow', 'red', 'teal', 'navy'] },
    { prop: 'gradient', type: 'select', options: ['teal', 'emerald', 'sunset', 'yellow', 'red', 'gold'] },
  ],
})

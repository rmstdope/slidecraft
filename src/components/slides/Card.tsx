import type { CSSProperties, ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepMotion } from '../../animations/stepMotion'
import { scaleInVariants } from '../../animations/variants'
import { accentColors, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface CardProps {
  children?: ReactNode
  title?: string
  subtitle?: string
  subtitleVariant?: 'italic' | 'divider' | 'inset'
  /** Defaults to the slide accent; a bare `accent` attribute also means the slide accent. */
  accent?: AccentColor | boolean
  /** Border-only style for grids of peers. */
  compact?: boolean
  step?: number
  morph?: string
  className?: string
}

function subtitleStyle(variant: CardProps['subtitleVariant'], accent: string): CSSProperties {
  const base = { fontFamily: 'var(--font-body)', marginBottom: 20 } satisfies CSSProperties
  if (variant === 'divider') return { ...base, fontSize: 28, fontWeight: 500, color: 'var(--muted)', paddingBottom: 16, borderBottom: `2px solid ${accent}` }
  if (variant === 'inset') return { ...base, fontSize: 28, fontStyle: 'italic', color: 'var(--muted)', padding: '12px 16px', background: 'color-mix(in srgb, var(--text) 5%, transparent)', borderRadius: 8, borderLeft: `3px solid ${accent}` }
  return { ...base, fontSize: 30, fontStyle: 'italic', color: 'var(--muted)', paddingBottom: 16, borderBottom: '1px solid color-mix(in srgb, var(--text) 10%, transparent)' }
}

function CardComponent({ children, title, subtitle, subtitleVariant = 'italic', accent: accentProp, compact = false, step, morph, className }: CardProps) {
  const accent = accentColors[useAccent(accentProp)]
  const stepMotion = useStepMotion(step, morph)

  if (compact) {
    return (
      <motion.div className={className} variants={scaleInVariants} {...stepMotion} style={{ borderLeft: `4px solid ${accent}`, paddingLeft: 24, textAlign: 'left' }}>
        {title && <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 32, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>{title}</h3>}
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 26, color: 'var(--muted)', lineHeight: 1.5 }}>{children}</div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={className}
      variants={scaleInVariants}
      whileHover={{ y: -4, rotateX: 2, boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)', transition: { type: 'spring', stiffness: 300, damping: 20 } }}
      {...stepMotion}
      style={{
        background: 'linear-gradient(145deg, color-mix(in srgb, var(--text) 8%, transparent), color-mix(in srgb, var(--text) 2%, transparent))',
        borderRadius: 16,
        padding: 32,
        borderLeft: `4px solid ${accent}`,
        textAlign: 'left',
        width: 780,
        boxShadow: '0 10px 30px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)',
        transformStyle: 'preserve-3d',
        transformPerspective: 1000,
      }}
    >
      {title && <h3 style={{ fontFamily: 'var(--font-body)', fontSize: 40, fontWeight: 600, color: accent, marginBottom: subtitle ? 12 : 16 }}>{title}</h3>}
      {subtitle && <div style={subtitleStyle(subtitleVariant, accent)}>{subtitle}</div>}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 28, color: 'var(--text)', lineHeight: 1.6 }}>{children}</div>
    </motion.div>
  )
}

export const Card = defineComponent<CardProps>({
  Component: CardComponent,
  registry: {
    id: 'card',
    name: 'Card',
    category: 'component',
    description: 'Info card with 3D hover effect.',
    props: [
      { name: 'title', type: 'string', description: 'Header in the accent colour' },
      { name: 'subtitle', type: 'string', description: 'Secondary line under the title' },
      { name: 'subtitleVariant', type: '"italic" | "divider" | "inset"', default: '"italic"', description: 'Subtitle styling' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'compact', type: 'boolean', default: 'false', description: 'Border-only style for grids' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
      { name: 'morph', type: 'string', description: 'Shared-element id' },
    ],
    snippet: '<Card title="Card Title">\n  Card content\n</Card>',
    previewCode: '<Slide scheme="dark">\n  <Card title="Card Title" subtitle="A secondary line">Card content goes here.</Card>\n</Slide>',
    keywords: ['box', 'container', 'panel', 'info'],
    useCases: ['Feature highlights', 'Team profiles', 'Service descriptions', 'Grouped content'],
  },
  toolbar: [
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'subtitleVariant', type: 'select', options: ['italic', 'divider', 'inset'] },
    { prop: 'compact', type: 'boolean' },
  ],
})

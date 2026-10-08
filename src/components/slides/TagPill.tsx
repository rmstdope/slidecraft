import type { ReactNode } from 'react'
import { tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'

const VARIANTS: Record<'neutral' | 'good' | 'warn' | 'bad', { fg: string; accent: AccentColor }> = {
  neutral: { fg: 'var(--muted)', accent: 'gray' },
  good: { fg: 'var(--accent-teal)', accent: 'teal' },
  warn: { fg: 'var(--brand-yellow)', accent: 'yellow' },
  bad: { fg: 'var(--brand-red)', accent: 'red' },
}

export interface TagPillProps {
  children?: ReactNode
  variant?: keyof typeof VARIANTS
  className?: string
}

export const TagPill = defineComponent<TagPillProps>({
  Component: ({ children, variant = 'neutral', className }) => {
    const v = VARIANTS[variant] ?? VARIANTS.neutral
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          fontFamily: 'var(--font-body)',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          lineHeight: 1,
          padding: '9px 18px',
          borderRadius: 999,
          color: v.fg,
          background: tint(v.accent, 0.16),
          border: `1px solid ${tint(v.accent, variant === 'neutral' ? 0.5 : 0.55)}`,
          whiteSpace: 'nowrap',
          verticalAlign: 'middle',
        }}
      >
        {children}
      </span>
    )
  },
  registry: {
    id: 'tag-pill',
    name: 'TagPill',
    category: 'component',
    description: 'Small inline status badge.',
    props: [{ name: 'variant', type: '"neutral" | "good" | "warn" | "bad"', default: '"neutral"', description: 'Semantic colour: neutral for labels, good/warn/bad for status' }],
    snippet: '<TagPill variant="good">Shipped</TagPill>',
    previewCode: '<Slide theme="dark">\n  <Text>Status: <TagPill variant="good">Shipped</TagPill> <TagPill variant="warn">At risk</TagPill></Text>\n</Slide>',
    keywords: ['pill', 'tag', 'badge', 'label', 'status', 'chip'],
    useCases: ['Status next to an item', 'A small label'],
  },
  toolbar: [{ prop: 'variant', type: 'select', options: ['neutral', 'good', 'warn', 'bad'] }],
})

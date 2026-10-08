import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepMotion } from '../../animations/stepMotion'
import { itemVariants } from '../../animations/variants'
import { accentColors, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface CalloutProps {
  children?: ReactNode
  label?: string
  /** Defaults to the slide accent. */
  accent?: AccentColor
  step?: number
  morph?: string
  className?: string
}

function CalloutComponent({ children, label, accent: accentProp, step, morph, className }: CalloutProps) {
  const accent = useAccent(accentProp)
  const stepMotion = useStepMotion(step, morph)
  const solid = accent === 'navy' // navy reads best as a solid fill
  return (
    <motion.div
      className={className}
      variants={itemVariants}
      {...stepMotion}
      style={{
        width: 1760,
        padding: '32px 48px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        background: solid ? accentColors.navy : tint(accent, 0.15),
        textAlign: 'left',
      }}
    >
      {label && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 32, fontWeight: 700, color: solid ? 'var(--on-navy, #ffffff)' : accentColors[accent], whiteSpace: 'nowrap' }}>{label}</span>
      )}
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 32, lineHeight: 1.4, color: solid ? 'var(--on-navy, #ffffff)' : 'var(--text)', opacity: solid ? 0.9 : 1 }}>{children}</span>
    </motion.div>
  )
}

export const Callout = defineComponent<CalloutProps>({
  Component: CalloutComponent,
  registry: {
    id: 'callout',
    name: 'Callout',
    category: 'component',
    description: 'Full-width callout box with optional label.',
    props: [
      { name: 'label', type: 'string', description: 'Bold label before the text' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
      { name: 'morph', type: 'string', description: 'Shared-element id' },
    ],
    snippet: '<Callout label="Note:">The one thing to remember.</Callout>',
    previewCode: '<Slide scheme="dark">\n  <Callout label="Note:">The one thing to remember.</Callout>\n</Slide>',
    keywords: ['callout', 'note', 'banner', 'alert', 'info'],
    useCases: ['A rule or warning under a slide body', 'The one emphasised element'],
  },
  toolbar: [{ prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] }],
})

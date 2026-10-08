import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepMotion } from '../../animations/stepMotion'
import { itemVariants } from '../../animations/variants'
import { defineComponent } from './defineComponent'
import { useSlideLayout } from './slideLayoutContext'

export interface TextProps {
  children?: ReactNode
  /** Muted colour instead of the text colour. */
  muted?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  align?: 'left' | 'center' | 'right'
  /** Line-height 1.25 instead of 1.6. */
  tight?: boolean
  /** Exact px size; overrides size. */
  fontSize?: number
  /** Reveal on this build step. */
  step?: number
  /** Shared-element id: the same id on two slides is one element moving between them. */
  morph?: string
  className?: string
}

export const TEXT_SIZES = { xs: 18, sm: 32, md: 40, lg: 48 } as const

function TextComponent({ children, muted = false, size = 'md', align, tight = false, fontSize, step, morph, className }: TextProps) {
  const stepMotion = useStepMotion(step, morph)
  // Centred by default; inside a left-aligned frame (e.g. a corporate content master), left.
  const { align: frameAlign } = useSlideLayout()
  return (
    <motion.span
      className={className}
      variants={itemVariants}
      {...stepMotion}
      style={{
        display: 'block',
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize: fontSize ?? TEXT_SIZES[size] ?? TEXT_SIZES.md,
        lineHeight: tight ? 1.25 : 1.6,
        color: muted ? 'var(--muted)' : 'var(--text)',
        textAlign: align ?? frameAlign,
        maxWidth: 1400,
      }}
    >
      {children}
    </motion.span>
  )
}

export const Text = defineComponent<TextProps>({
  Component: TextComponent,
  registry: {
    id: 'text',
    name: 'Text',
    category: 'component',
    description: 'Body text paragraph.',
    props: [
      { name: 'muted', type: 'boolean', default: 'false', description: 'Muted colour' },
      { name: 'size', type: '"xs" | "sm" | "md" | "lg"', default: '"md"', description: '18, 32, 40 or 48 px' },
      { name: 'align', type: '"left" | "center" | "right"', default: '"center"', description: 'Text alignment; left by default inside a left-aligned frame' },
      { name: 'tight', type: 'boolean', default: 'false', description: 'Line-height 1.25 instead of 1.6' },
      { name: 'fontSize', type: 'number', description: 'Exact px size; overrides size' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
      { name: 'morph', type: 'string', description: 'Shared-element id; pair with transition="morph" on the next slide' },
    ],
    snippet: '<Text>Your body text here</Text>',
    previewCode: '<Slide scheme="dark">\n  <Text>Your body text here</Text>\n</Slide>',
    keywords: ['paragraph', 'body', 'content', 'p'],
    useCases: ['Explanatory paragraph', 'Supporting sentence under a title'],
  },
  toolbar: [
    { prop: 'muted', type: 'boolean' },
    { prop: 'size', type: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    { prop: 'align', type: 'select', options: ['left', 'center', 'right'] },
    { prop: 'tight', type: 'boolean' },
  ],
})

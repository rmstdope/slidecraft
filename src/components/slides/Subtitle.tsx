import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants } from '../../animations/variants'
import { defineComponent } from './defineComponent'
import { useSlideLayout } from './slideLayoutContext'

export interface SubtitleProps {
  children?: ReactNode
  /** Use the slide accent instead of the muted colour. */
  accent?: boolean
  className?: string
}

function SubtitleComponent({ children, accent = false, className }: SubtitleProps) {
  const { layout, frame, align } = useSlideLayout()
  const alignLeft = layout === 'document' || align === 'left'
  // A frame can turn the eyebrow into a sentence-case sub-headline (e.g. on a title master).
  const subheadline = frame?.subtitle?.variant === 'subheadline'
  return (
    <motion.h2
      className={className}
      variants={itemVariants}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: subheadline ? 34 : 36,
        fontWeight: subheadline ? 700 : 600,
        letterSpacing: subheadline ? 'normal' : '0.2em',
        textTransform: subheadline ? 'none' : 'uppercase',
        color: accent ? 'var(--accent)' : (frame?.subtitle?.color ?? 'var(--muted)'),
        textAlign: alignLeft ? 'left' : 'center',
        lineHeight: 1.3,
      }}
    >
      {children}
    </motion.h2>
  )
}

export const Subtitle = defineComponent<SubtitleProps>({
  Component: SubtitleComponent,
  registry: {
    id: 'subtitle',
    name: 'Subtitle',
    category: 'component',
    description: 'All-caps secondary heading.',
    props: [{ name: 'accent', type: 'boolean', default: 'false', description: 'Use the slide accent colour' }],
    snippet: '<Subtitle>Section Name</Subtitle>',
    previewCode: '<Slide scheme="dark">\n  <Subtitle>Section Name</Subtitle>\n  <Title>Heading</Title>\n</Slide>',
    keywords: ['heading', 'h2', 'subheading', 'section', 'eyebrow'],
    useCases: ['Section name above a title', 'Supporting context', 'Date, event or category label'],
  },
  toolbar: [{ prop: 'accent', type: 'boolean' }],
})

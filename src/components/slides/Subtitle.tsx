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
  const { layout, chrome } = useSlideLayout()
  const alignLeft = layout === 'document' || chrome !== 'none'
  const corporateTitle = chrome === 'title'
  return (
    <motion.h2
      className={className}
      variants={itemVariants}
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: corporateTitle ? 34 : 36,
        fontWeight: corporateTitle ? 700 : 600,
        letterSpacing: corporateTitle ? 'normal' : '0.2em',
        textTransform: corporateTitle ? 'none' : 'uppercase',
        color: corporateTitle ? 'var(--chrome-taupe, #8c7b6b)' : accent ? 'var(--accent)' : 'var(--muted)',
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
    previewCode: '<Slide theme="dark">\n  <Subtitle>Section Name</Subtitle>\n  <Title>Heading</Title>\n</Slide>',
    keywords: ['heading', 'h2', 'subheading', 'section', 'eyebrow'],
    useCases: ['Section name above a title', 'Supporting context', 'Date, event or category label'],
  },
  toolbar: [{ prop: 'accent', type: 'boolean' }],
})

import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface CaptionProps {
  children?: ReactNode
  className?: string
}

export const Caption = defineComponent<CaptionProps>({
  Component: ({ children, className }) => (
    <motion.div
      className={className}
      variants={itemVariants}
      style={{ fontFamily: 'var(--font-body)', fontSize: 28, fontStyle: 'italic', color: 'var(--muted)', marginBottom: 12 }}
    >
      {children}
    </motion.div>
  ),
  registry: {
    id: 'caption',
    name: 'Caption',
    category: 'component',
    description: 'Italic secondary text for annotations inside Cards.',
    props: [],
    snippet: '<Caption>Secondary text</Caption>',
    previewCode: '<Slide scheme="dark">\n  <Card title="Card">\n    <Caption>An annotation</Caption>\n    <Text>Body text</Text>\n  </Card>\n</Slide>',
    keywords: ['secondary', 'annotation', 'italic', 'muted', 'subtitle'],
    useCases: ['Image or diagram captions', 'Source attribution', 'Footnotes'],
  },
})

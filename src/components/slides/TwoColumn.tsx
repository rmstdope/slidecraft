import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface TwoColumnProps {
  children?: ReactNode
  gap?: string
  className?: string
}

export const TwoColumn = defineComponent<TwoColumnProps>({
  Component: ({ children, gap = '80px', className }) => (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      style={{ display: 'grid', gridTemplateColumns: '840px 840px', gap, width: 1760, alignItems: 'stretch', justifyItems: 'center' }}
    >
      {children}
    </motion.div>
  ),
  registry: {
    id: 'twocolumn',
    name: 'TwoColumn',
    category: 'component',
    description: 'Side-by-side layout container.',
    props: [{ name: 'gap', type: 'string', default: '"80px"', description: 'Gap between the columns' }],
    snippet: '<TwoColumn>\n  <Card title="Left">Left column</Card>\n  <Card title="Right">Right column</Card>\n</TwoColumn>',
    previewCode: '<Slide theme="dark">\n  <TwoColumn>\n    <Card title="Before">How it was</Card>\n    <Card title="After">How it is</Card>\n  </TwoColumn>\n</Slide>',
    keywords: ['layout', 'columns', 'split', 'grid', 'side'],
    useCases: ['Two options side by side', 'Before and after'],
  },
})

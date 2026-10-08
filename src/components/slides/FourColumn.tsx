import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface FourColumnProps {
  children?: ReactNode
  gap?: string
  className?: string
}

export const FourColumn = defineComponent<FourColumnProps>({
  Component: ({ children, gap = '40px', className }) => (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 400px)', gap, width: 1720, flexShrink: 0, alignItems: 'start', justifyItems: 'center' }}
    >
      {children}
    </motion.div>
  ),
  registry: {
    id: 'fourcolumn',
    name: 'FourColumn',
    category: 'component',
    description: 'Four-column grid layout container.',
    props: [{ name: 'gap', type: 'string', default: '"40px"', description: 'Gap between the columns' }],
    snippet: '<FourColumn>\n  <Card compact title="One">First</Card>\n  <Card compact title="Two">Second</Card>\n  <Card compact title="Three">Third</Card>\n  <Card compact title="Four">Fourth</Card>\n</FourColumn>',
    previewCode: '<Slide theme="dark">\n  <FourColumn>\n    <Card compact title="One">First</Card>\n    <Card compact title="Two">Second</Card>\n    <Card compact title="Three">Third</Card>\n    <Card compact title="Four">Fourth</Card>\n  </FourColumn>\n</Slide>',
    keywords: ['layout', 'columns', 'grid', 'four'],
    useCases: ['Four peers', 'A row of stats'],
  },
})

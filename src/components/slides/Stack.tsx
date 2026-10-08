import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface StackProps {
  children?: ReactNode
  gap?: number
  className?: string
}

export const Stack = defineComponent<StackProps>({
  Component: ({ children, gap = 32, className }) => (
    <motion.div className={className} variants={staggerContainer} style={{ display: 'flex', flexDirection: 'column', gap }}>
      {children}
    </motion.div>
  ),
  registry: {
    id: 'stack',
    name: 'Stack',
    category: 'component',
    description: 'Vertical grouping container with configurable gap.',
    props: [{ name: 'gap', type: 'number', default: '32', description: 'Gap between children in px' }],
    snippet: '<Stack gap={32}>\n  <Text>First</Text>\n  <Text>Second</Text>\n</Stack>',
    previewCode: '<Slide scheme="dark">\n  <Stack gap={24}>\n    <Text>First</Text>\n    <Text muted>Second</Text>\n  </Stack>\n</Slide>',
    keywords: ['vertical', 'group', 'spacing', 'gap', 'column'],
    useCases: ['Group blocks with a fixed gap'],
  },
  toolbar: [{ prop: 'gap', type: 'number', min: 0, max: 96, step: 8 }],
})

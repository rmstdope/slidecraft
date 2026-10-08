import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface PersonRowProps {
  children?: ReactNode
  gap?: number
  columnWidth?: number
  className?: string
}

export const PersonRow = defineComponent<PersonRowProps>({
  Component: ({ children, gap = 100, columnWidth = 460, className }) => (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: `${columnWidth}px`, gap, justifyContent: 'center', alignItems: 'start' }}
    >
      {children}
    </motion.div>
  ),
  registry: {
    id: 'person-row',
    name: 'PersonRow',
    category: 'component',
    description: 'A row of PersonCards with fixed column widths.',
    props: [
      { name: 'gap', type: 'number', default: '100', description: 'Gap between people in px' },
      { name: 'columnWidth', type: 'number', default: '460', description: 'Width of each column in px' },
    ],
    snippet:
      '<PersonRow>\n  <PersonCard name="Jane Doe" role="Software Engineer" email="jane.doe@example.com" />\n  <PersonCard name="John Roe" role="Designer" email="john.roe@example.com" />\n  <PersonCard name="Alex Poe" role="Product Lead" email="alex.poe@example.com" />\n</PersonRow>',
    previewCode:
      '<Slide scheme="dark">\n  <PersonRow>\n    <PersonCard name="Jane Doe" role="Engineer" />\n    <PersonCard name="John Roe" role="Designer" />\n  </PersonRow>\n</Slide>',
    keywords: ['people', 'team', 'contacts', 'row', 'layout'],
    useCases: ['A team slide', 'Contacts at the end of a talk'],
  },
  toolbar: [
    { prop: 'gap', type: 'number', min: 0, max: 200, step: 20 },
    { prop: 'columnWidth', type: 'number', min: 300, max: 700, step: 20 },
  ],
})

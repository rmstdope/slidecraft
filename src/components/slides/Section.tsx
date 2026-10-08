import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { itemVariants } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface SectionProps {
  title: string
  children?: ReactNode
  gap?: number
  titleSize?: number
}

export const Section = defineComponent<SectionProps>({
  Component: ({ title, children, gap = 10, titleSize = 32 }) => (
    <motion.div variants={itemVariants}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: titleSize, fontWeight: 700, color: 'var(--text)', marginBottom: gap, lineHeight: 1.15 }}>{title}</div>
      <div>{children}</div>
    </motion.div>
  ),
  registry: {
    id: 'section',
    name: 'Section',
    category: 'component',
    description: 'Labeled section with bold title and content below.',
    props: [
      { name: 'title', type: 'string', description: 'Bold label' },
      { name: 'titleSize', type: 'number', default: '32', description: 'Label size in px' },
      { name: 'gap', type: 'number', default: '10', description: 'Space below the label in px' },
    ],
    snippet: '<Section title="Section Title">\n  <Text align="left">Content</Text>\n</Section>',
    previewCode: '<Slide scheme="light">\n  <Section title="Section Title">\n    <List compact>\n      <ListItem>First point</ListItem>\n      <ListItem>Second point</ListItem>\n    </List>\n  </Section>\n</Slide>',
    keywords: ['section', 'group', 'label', 'heading', 'block'],
    useCases: ['Several labelled blocks on one slide'],
  },
  toolbar: [
    { prop: 'titleSize', type: 'number', min: 16, max: 72, step: 4 },
    { prop: 'gap', type: 'number', min: 0, max: 48, step: 4 },
  ],
})

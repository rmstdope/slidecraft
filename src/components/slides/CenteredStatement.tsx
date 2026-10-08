import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface CenteredStatementProps {
  label: string
  statement: string
  labelColor?: string
  maxWidth?: number
}

export const CenteredStatement = defineComponent<CenteredStatementProps>({
  Component: ({ label, statement, labelColor = 'var(--muted)', maxWidth = 1200 }) => (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}
    >
      <motion.div variants={itemVariants} style={{ fontFamily: 'var(--font-body)', fontSize: 24, fontWeight: 700, color: labelColor, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </motion.div>
      <motion.div variants={itemVariants} style={{ fontFamily: 'var(--font-body)', fontSize: 40, fontWeight: 400, color: 'var(--text)', lineHeight: 1.4, maxWidth }}>
        {statement}
      </motion.div>
    </motion.div>
  ),
  registry: {
    id: 'centered-statement',
    name: 'CenteredStatement',
    category: 'component',
    description: 'A small label over a centred statement, for rules and principles.',
    props: [
      { name: 'label', type: 'string', description: 'Small label above' },
      { name: 'statement', type: 'string', description: 'The statement' },
      { name: 'labelColor', type: 'string', default: '"var(--muted)"', description: 'Any CSS colour' },
      { name: 'maxWidth', type: 'number', default: '1200', description: 'Statement width in px' },
    ],
    snippet: '<CenteredStatement label="Rule" statement="One idea per slide." />',
    previewCode: '<Slide scheme="light">\n  <CenteredStatement label="Rule" statement="One idea per slide, stated as an assertion." />\n</Slide>',
    keywords: ['rule', 'principle', 'statement', 'centered', 'guideline'],
    useCases: ['A rule or principle', 'A single takeaway'],
  },
  toolbar: [{ prop: 'maxWidth', type: 'number', min: 600, max: 1600, step: 100 }],
})

import { motion } from 'motion/react'
import { useCountUp } from '../../animations/countUp'
import { springs } from '../../animations/springs'
import { useStepVisible } from '../../animations/stepContext'
import { useStepMotion } from '../../animations/stepMotion'
import { readStep } from '../../animations/steps'
import { accentColors, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface StatProps {
  /** e.g. "42%", "$1,200.5M", "N/A". Numeric values count up. */
  value: string
  label: string
  accent?: AccentColor
  sub?: string
  /** Count the number up when it appears. Turn off for years and versions, which are labels. */
  countUp?: boolean
  step?: number
  morph?: string
  className?: string
}

function StatComponent({ value, label, accent: accentProp, sub, countUp = true, step, morph, className }: StatProps) {
  const accent = useAccent(accentProp)
  const visible = useStepVisible(readStep(step))
  const display = useCountUp(String(value), countUp, visible)
  const stepMotion = useStepMotion(step, morph)
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.smooth}
      {...stepMotion}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 32, textAlign: 'center' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{ fontFamily: 'var(--font-display)', fontSize: 120, fontWeight: 700, lineHeight: 1, color: accentColors[accent], fontVariantNumeric: 'tabular-nums' }}
      >
        {display}
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ fontFamily: 'var(--font-body)', fontSize: 24, color: 'var(--muted)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </motion.div>
      {sub && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.4 }} style={{ fontFamily: 'var(--font-body)', fontSize: 20, color: 'var(--muted)', marginTop: 4 }}>
          {sub}
        </motion.div>
      )}
    </motion.div>
  )
}

export const Stat = defineComponent<StatProps>({
  Component: StatComponent,
  registry: {
    id: 'stat',
    name: 'Stat',
    category: 'component',
    description: 'Large statistic number with label.',
    props: [
      { name: 'value', type: 'string', description: 'The number as written, e.g. "42%"' },
      { name: 'label', type: 'string', description: 'Uppercase label below' },
      { name: 'accent', type: '"teal" | "yellow" | "red" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'sub', type: 'string', description: 'Small line under the label' },
      { name: 'countUp', type: 'boolean', default: 'true', description: 'Count up on entry; off for years and versions' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
      { name: 'morph', type: 'string', description: 'Shared-element id' },
    ],
    snippet: '<Stat value="42%" label="improvement" />',
    previewCode: '<Slide scheme="dark">\n  <Stat value="42%" label="improvement" />\n</Slide>',
    keywords: ['number', 'metric', 'statistic', 'data', 'value', 'kpi'],
    useCases: ['One number that carries the slide', 'A pair or row of metrics'],
  },
  toolbar: [
    { prop: 'accent', type: 'select', options: ['teal', 'yellow', 'red', 'navy', 'gray'] },
    { prop: 'countUp', type: 'boolean' },
  ],
})

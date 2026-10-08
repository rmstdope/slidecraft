import { motion } from 'motion/react'
import { itemVariants } from '../../animations/variants'
import { colorValue, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'

export interface LegendProps {
  items: { color: AccentColor | string; label: string }[]
  title?: string
  className?: string
}

export const Legend = defineComponent<LegendProps>({
  Component: ({ items, title, className }) => (
    <motion.div className={className} variants={itemVariants} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 32, fontFamily: 'var(--font-body)', fontSize: 24, color: 'var(--muted)' }}>
      {title && <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 20 }}>{title}</span>}
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span aria-hidden style={{ width: 24, height: 24, borderRadius: 6, background: colorValue(item.color) }} />
          {item.label}
        </span>
      ))}
    </motion.div>
  ),
  registry: {
    id: 'legend',
    name: 'Legend',
    category: 'component',
    description: 'Row of colour swatches with labels, to explain a diagram.',
    props: [
      { name: 'items', type: 'Array<{ color: string; label: string }>', description: 'Accent names or CSS colours with labels' },
      { name: 'title', type: 'string', description: 'Small heading before the swatches' },
    ],
    snippet: '<Legend title="Key" items={[{ color: "teal", label: "Fine" }, { color: "red", label: "Risk" }]} />',
    previewCode: '<Slide scheme="dark">\n  <Legend title="Key" items={[{ color: "teal", label: "Fine" }, { color: "yellow", label: "Caution" }, { color: "red", label: "Risk" }]} />\n</Slide>',
    keywords: ['legend', 'key', 'swatch', 'colours', 'diagram'],
    useCases: ['Explaining the colours of a diagram'],
  },
})

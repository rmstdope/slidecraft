import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface IconRowProps {
  items: { icon: string; highlight?: boolean }[]
  label?: string
  /** Colour of the highlighted icons; defaults to the slide accent. */
  accent?: AccentColor
  className?: string
}

export const IconRow = defineComponent<IconRowProps>({
  Component: function IconRowComponent({ items, label, accent: accentProp, className }) {
    const accent = useAccent(accentProp)
    return (
    <motion.div className={className} variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {label && <motion.span variants={itemVariants} style={{ fontFamily: 'var(--font-body)', fontSize: 24, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</motion.span>}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        {items.map((item, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            whileHover={{ scale: 1.1 }}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              ...(item.highlight
                ? { background: `linear-gradient(135deg, ${tint(accent, 0.2)}, ${tint(accent, 0.1)})`, border: `2px solid ${accentColors[accent]}`, boxShadow: `0 0 20px ${tint(accent, 0.3)}` }
                : { background: 'color-mix(in srgb, var(--text) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--text) 10%, transparent)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }),
            }}
          >
            {item.icon}
          </motion.div>
        ))}
      </div>
    </motion.div>
    )
  },
  registry: {
    id: 'iconrow',
    name: 'IconRow',
    category: 'component',
    description: 'Row of emoji/icon circles for visualizations.',
    props: [
      { name: 'items', type: 'Array<{ icon: string; highlight?: boolean }>', description: 'Emoji, optionally highlighted' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Colour of highlighted icons; defaults to the slide accent' },
      { name: 'label', type: 'string', description: 'Label above the row' },
    ],
    snippet: '<IconRow label="The team" items={[{ icon: "🧑‍💻" }, { icon: "🧑‍🎨", highlight: true }, { icon: "🧑‍🔬" }]} />',
    previewCode: '<Slide scheme="dark">\n  <IconRow label="The team" items={[{ icon: "🧑‍💻" }, { icon: "🧑‍🎨", highlight: true }, { icon: "🧑‍🔬" }]} />\n</Slide>',
    keywords: ['icons', 'emoji', 'visual', 'team', 'mob'],
    useCases: ['A visual headcount', 'Who is involved'],
  },
  toolbar: [{ prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] }],
})

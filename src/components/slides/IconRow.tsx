import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { defineComponent } from './defineComponent'

export interface IconRowProps {
  items: { icon: string; highlight?: boolean }[]
  label?: string
  className?: string
}

export const IconRow = defineComponent<IconRowProps>({
  Component: ({ items, label, className }) => (
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
                ? { background: 'linear-gradient(135deg, rgba(245,180,0,0.2), rgba(245,180,0,0.1))', border: '2px solid var(--brand-yellow)', boxShadow: '0 0 20px rgba(245,180,0,0.3)' }
                : { background: 'color-mix(in srgb, var(--text) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--text) 10%, transparent)', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }),
            }}
          >
            {item.icon}
          </motion.div>
        ))}
      </div>
    </motion.div>
  ),
  registry: {
    id: 'iconrow',
    name: 'IconRow',
    category: 'component',
    description: 'Row of emoji/icon circles for visualizations.',
    props: [
      { name: 'items', type: 'Array<{ icon: string; highlight?: boolean }>', description: 'Emoji, optionally highlighted' },
      { name: 'label', type: 'string', description: 'Label above the row' },
    ],
    snippet: '<IconRow label="The team" items={[{ icon: "🧑‍💻" }, { icon: "🧑‍🎨", highlight: true }, { icon: "🧑‍🔬" }]} />',
    previewCode: '<Slide scheme="dark">\n  <IconRow label="The team" items={[{ icon: "🧑‍💻" }, { icon: "🧑‍🎨", highlight: true }, { icon: "🧑‍🔬" }]} />\n</Slide>',
    keywords: ['icons', 'emoji', 'visual', 'team', 'mob'],
    useCases: ['A visual headcount', 'Who is involved'],
  },
})

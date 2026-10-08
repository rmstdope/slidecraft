import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, tint } from './accents'
import { defineComponent } from './defineComponent'

const KINDS = {
  pro: { label: 'PRO', color: accentColors.teal, mark: '+' },
  con: { label: 'CON', color: accentColors.red, mark: '−' },
  nuance: { label: 'NUANCE', color: accentColors.yellow, mark: '~' },
} as const

export interface ProConListProps {
  items: { kind: keyof typeof KINDS; text: string }[]
  className?: string
}

export const ProConList = defineComponent<ProConListProps>({
  Component: ({ items, className }) => (
    <motion.div className={className} variants={staggerContainer} style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 1600 }}>
      {items.map((item, i) => {
        const kind = KINDS[item.kind] ?? KINDS.nuance
        return (
          <motion.div
            key={i}
            variants={itemVariants}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 24, padding: '20px 28px', borderRadius: 12, background: tint('gray', 0.08), borderLeft: `5px solid ${kind.color}`, textAlign: 'left' }}
          >
            <div style={{ width: 150, flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 12, color: kind.color }}>
              <span aria-hidden style={{ fontSize: 28, fontWeight: 700 }}>{kind.mark}</span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 700, letterSpacing: 1.5 }}>{kind.label}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 28, color: 'var(--text)', lineHeight: 1.5 }}>{item.text}</div>
          </motion.div>
        )
      })}
    </motion.div>
  ),
  registry: {
    id: 'pro-con-list',
    name: 'ProConList',
    category: 'component',
    description: 'Tagged argument rows: pro, con, and nuance.',
    props: [{ name: 'items', type: 'Array<{ kind: "pro" | "con" | "nuance"; text: string }>', description: 'Rows in order' }],
    snippet: '<ProConList\n  items={[\n    { kind: "pro", text: "Faster to start" },\n    { kind: "con", text: "Harder to change later" },\n    { kind: "nuance", text: "Depends on team size" },\n  ]}\n/>',
    previewCode: '<Slide scheme="dark">\n  <ProConList items={[{ kind: "pro", text: "Faster to start" }, { kind: "con", text: "Harder to change later" }, { kind: "nuance", text: "Depends on team size" }]} />\n</Slide>',
    keywords: ['pros', 'cons', 'tradeoffs', 'decision', 'nuance', 'arguments'],
    useCases: ['Weighing a decision'],
  },
})

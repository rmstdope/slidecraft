import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, isAccent, onAccent, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface PhaseRowProps {
  phases: { title: string; items: string[]; color?: AccentColor }[]
  className?: string
}

const GAP = 32
const WIDTH = 1760

export const phaseWidth = (count: number): number => Math.floor((WIDTH - GAP * (count - 1)) / Math.max(1, count))

function PhaseRowComponent({ phases, className }: PhaseRowProps) {
  const slideAccent = useAccent()
  const width = phaseWidth(phases.length)
  return (
    <motion.div className={className} variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', gap: GAP, width: WIDTH }}>
      {phases.map((phase, i) => {
        const accent = isAccent(phase.color) ? phase.color : slideAccent
        const color = accentColors[accent]
        const yellow = accent === 'yellow'
        const ink = yellow ? 'var(--dark-bg)' : onAccent(accent)
        return (
          <motion.div
            key={i}
            variants={itemVariants}
            style={{
              position: 'relative',
              width,
              background: `linear-gradient(135deg, color-mix(in srgb, ${color} 90%, transparent), ${color})`,
              borderRadius: 12,
              padding: 32,
              textAlign: 'left',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              overflow: 'hidden',
            }}
          >
            <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(rgba(255,255,255,0.15), transparent)' }} />
            <h4 style={{ position: 'relative', fontFamily: 'var(--font-body)', fontSize: 32, fontWeight: 700, color: ink, marginBottom: 16 }}>{phase.title}</h4>
            <ul style={{ position: 'relative', listStyle: 'disc', paddingLeft: 24 }}>
              {phase.items.map((item, j) => (
                <li key={j} style={{ fontFamily: 'var(--font-body)', fontSize: 26, lineHeight: 1.5, marginBottom: 6, color: yellow ? 'rgba(0,0,0,0.85)' : ink, opacity: yellow ? 1 : 0.95 }}>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

export const PhaseRow = defineComponent<PhaseRowProps>({
  Component: PhaseRowComponent,
  registry: {
    id: 'phaserow',
    name: 'PhaseRow',
    category: 'component',
    description: 'Horizontal row of phase cards, e.g. a framework or a process.',
    props: [{ name: 'phases', type: 'Array<{ title: string; items: string[]; color?: "teal" | "yellow" | "red" | "navy" | "gray" }>', description: 'Phases in order; colour defaults to the slide accent' }],
    snippet: '<PhaseRow\n  phases={[\n    { title: "Research", items: ["Read the code", "Map the flow"] },\n    { title: "Plan", items: ["Write the steps"] },\n    { title: "Implement", items: ["Small commits"] },\n  ]}\n/>',
    previewCode: '<Slide scheme="dark">\n  <PhaseRow phases={[{ title: "Research", items: ["Read the code"] }, { title: "Plan", items: ["Write the steps"] }, { title: "Implement", items: ["Small commits"] }]} />\n</Slide>',
    keywords: ['phases', 'steps', 'framework', 'process', 'rpi'],
    useCases: ['Phases of a process'],
  },
})

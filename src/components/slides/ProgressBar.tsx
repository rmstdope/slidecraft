import { motion } from 'motion/react'
import { accentShades, isAccent, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'

export interface ProgressBarProps {
  segments: { label: string; flex: number; color: AccentColor }[]
  className?: string
}

export const ProgressBar = defineComponent<ProgressBarProps>({
  Component: ({ segments, className }) => (
    <motion.div className={className} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: 1400 }}>
      <div style={{ display: 'flex', height: 64, borderRadius: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
        {segments.map((segment, i) => {
          const color = isAccent(segment.color) ? segment.color : 'teal'
          const shade = accentShades[color]
          const yellow = color === 'yellow'
          return (
            <motion.div
              key={i}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              style={{
                position: 'relative',
                flex: segment.flex,
                transformOrigin: 'left',
                display: 'flex',
                alignItems: 'center',
                background: `linear-gradient(${shade.light}, ${shade.base} 50%, ${shade.dark})`,
                borderLeft: i > 0 ? '2px solid rgba(0,0,0,0.35)' : undefined,
              }}
            >
              <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(rgba(255,255,255,0.25), transparent)' }} />
              <span
                style={{
                  position: 'relative',
                  padding: '0 16px',
                  fontFamily: 'var(--font-body)',
                  fontSize: 24,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  color: yellow ? 'var(--dark-bg)' : '#ffffff',
                  textShadow: yellow ? '0 1px 0 rgba(255,255,255,0.4)' : '0 1px 2px rgba(0,0,0,0.4)',
                }}
              >
                {segment.label}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  ),
  registry: {
    id: 'progressbar',
    name: 'ProgressBar',
    category: 'component',
    description: 'Segmented progress/percentage bar visualization.',
    props: [{ name: 'segments', type: 'Array<{ label: string; flex: number; color: "teal" | "yellow" | "red" | "navy" }>', description: 'Segments with relative widths' }],
    snippet: '<ProgressBar segments={[{ label: "Done 70%", flex: 7, color: "teal" }, { label: "Left 30%", flex: 3, color: "red" }]} />',
    previewCode: '<Slide theme="dark">\n  <ProgressBar segments={[{ label: "Done 70%", flex: 7, color: "teal" }, { label: "Left 30%", flex: 3, color: "red" }]} />\n</Slide>',
    keywords: ['progress', 'bar', 'percentage', 'visualization', 'segment'],
    useCases: ['A split of a whole', 'Progress towards a goal'],
  },
})

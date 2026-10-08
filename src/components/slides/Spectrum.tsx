import { motion } from 'motion/react'
import { accentShades } from './accents'
import { defineComponent } from './defineComponent'

export interface SpectrumProps {
  segments: { label: string; sub?: string; flex?: number }[]
  className?: string
}

const COLOURS = ['teal', 'yellow', 'red'] as const

/** Teal → yellow → red across the segments by position (guarded for a single segment). */
export function spectrumColorIndex(index: number, count: number): number {
  if (count <= 1) return 0
  return Math.min(2, Math.floor((index / (count - 1)) * 2))
}

export const Spectrum = defineComponent<SpectrumProps>({
  Component: ({ segments, className }) => (
    <motion.div className={className} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ width: 1760, perspective: 1000 }}>
      <motion.div
        initial={{ rotateX: 15 }}
        animate={{ rotateX: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ display: 'flex', height: 140, borderRadius: 12, overflow: 'hidden', transformStyle: 'preserve-3d', boxShadow: '0 20px 40px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)' }}
      >
        {segments.map((segment, i) => {
          const colorIndex = spectrumColorIndex(i, segments.length)
          const shade = accentShades[COLOURS[colorIndex]]
          const first = colorIndex === 0
          return (
            <motion.div
              key={i}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              style={{
                position: 'relative',
                flex: segment.flex || 1,
                transformOrigin: 'left',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                padding: '0 16px',
                background: `linear-gradient(${shade.light}, ${shade.base} 50%, ${shade.dark})`,
                borderLeft: i > 0 ? '2px solid rgba(0,0,0,0.35)' : undefined,
              }}
            >
              <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(rgba(255,255,255,0.25), transparent)' }} />
              <span style={{ position: 'relative', fontFamily: 'var(--font-body)', fontSize: 36, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: first ? '#ffffff' : 'var(--dark-bg)' }}>{segment.label}</span>
              {segment.sub && <span style={{ position: 'relative', fontFamily: 'var(--font-body)', fontSize: 28, color: first ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)' }}>{segment.sub}</span>}
            </motion.div>
          )
        })}
      </motion.div>
    </motion.div>
  ),
  registry: {
    id: 'spectrum',
    name: 'Spectrum',
    category: 'component',
    description: 'Range bar that runs teal to yellow to red across its segments.',
    props: [{ name: 'segments', type: 'Array<{ label: string; sub?: string; flex?: number }>', description: 'Segments from the safe end to the risky end' }],
    snippet: '<Spectrum segments={[{ label: "Low", sub: "Safe" }, { label: "Medium" }, { label: "High", sub: "Risky" }]} />',
    previewCode: '<Slide scheme="dark">\n  <Spectrum segments={[{ label: "Low", sub: "Safe" }, { label: "Medium" }, { label: "High", sub: "Risky" }]} />\n</Slide>',
    keywords: ['range', 'gradient', 'bar', 'scale', 'visualization', 'risk'],
    useCases: ['A scale from fine to risky'],
  },
})

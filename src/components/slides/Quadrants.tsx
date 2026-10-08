import { motion } from 'motion/react'
import { accentColors, isAccent, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { fadeRise, OVERSHOOT } from './styles'

interface Axis {
  label: string
  low?: string
  high?: string
}

type QuadrantKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

export interface QuadrantsProps {
  xAxis: Axis
  yAxis: Axis
  /** x and y in 0..1. */
  items?: { label: string; x: number; y: number; color?: AccentColor }[]
  quadrants?: Partial<Record<QuadrantKey, { label?: string; color?: AccentColor }>>
  size?: number
  className?: string
}

const PADDING = 120
const CELLS: QuadrantKey[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
const axisLabel = { fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text)' } as const
const endLabel = { fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' } as const

export const plotPosition = (x: number, y: number, size: number) => ({ left: Math.min(1, Math.max(0, x)) * size, top: (1 - Math.min(1, Math.max(0, y))) * size })

function QuadrantsComponent({ xAxis, yAxis, items = [], quadrants = {}, size = 820, className }: QuadrantsProps) {
  return (
    <motion.div className={className} {...fadeRise} style={{ display: 'grid', gridTemplateColumns: `${PADDING}px ${size}px`, gridTemplateRows: `${size}px ${PADDING}px` }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...axisLabel, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>{yAxis.label}</div>
        {yAxis.high && <div style={{ ...endLabel, position: 'absolute', top: 0, right: 12 }}>{yAxis.high}</div>}
        {yAxis.low && <div style={{ ...endLabel, position: 'absolute', bottom: 0, right: 12 }}>{yAxis.low}</div>}
      </div>
      <div style={{ position: 'relative', width: size, height: size }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
          {CELLS.map((key, i) => {
            const cell = quadrants[key] ?? {}
            const color = isAccent(cell.color) ? cell.color : undefined
            const right = i % 2 === 1
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.08 }}
                style={{
                  padding: 24,
                  textAlign: right ? 'right' : 'left',
                  borderRight: right ? undefined : '2px dashed rgba(255,255,255,0.25)',
                  borderBottom: i < 2 ? '2px dashed rgba(255,255,255,0.25)' : undefined,
                  background: color ? `linear-gradient(135deg, ${tint(color, 0.33)}, ${tint(color, 0.13)})` : 'color-mix(in srgb, var(--text) 3%, transparent)',
                }}
              >
                {cell.label && <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, textTransform: 'uppercase', color: color ? accentColors[color] : 'var(--muted)', opacity: 0.85 }}>{cell.label}</span>}
              </motion.div>
            )
          })}
        </div>
        <div aria-hidden style={{ position: 'absolute', inset: 0, border: '2px solid var(--accent)', borderRadius: 16, pointerEvents: 'none' }} />
        {items.map((item, i) => {
          const color: AccentColor = isAccent(item.color) ? item.color : 'yellow'
          return (
            <motion.div
              key={i}
              initial={{ scale: 0, x: '-50%', y: '-50%' }}
              animate={{ scale: 1, x: '-50%', y: '-50%' }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.07, ease: OVERSHOOT }}
              style={{ position: 'absolute', ...plotPosition(item.x, item.y, size), display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: accentColors[color], boxShadow: `0 0 0 4px ${tint(color, 0.2)}, 0 2px 6px rgba(0,0,0,0.4)`, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 24, fontWeight: 600, color: 'var(--text)', background: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>{item.label}</span>
            </motion.div>
          )
        })}
      </div>
      <div />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8 }}>
        {xAxis.low && <div style={{ ...endLabel, position: 'absolute', top: 12, left: 0 }}>{xAxis.low}</div>}
        {xAxis.high && <div style={{ ...endLabel, position: 'absolute', top: 12, right: 0 }}>{xAxis.high}</div>}
        <div style={axisLabel}>{xAxis.label}</div>
      </div>
    </motion.div>
  )
}

export const Quadrants = defineComponent<QuadrantsProps>({
  Component: QuadrantsComponent,
  registry: {
    id: 'quadrants',
    name: 'Quadrants',
    category: 'component',
    description: '2x2 matrix (four-quadrant chart) with two axes and items plotted by score.',
    props: [
      { name: 'xAxis', type: '{ label: string; low?: string; high?: string }', description: 'Horizontal axis' },
      { name: 'yAxis', type: '{ label: string; low?: string; high?: string }', description: 'Vertical axis' },
      { name: 'items', type: 'Array<{ label: string; x: number; y: number; color?: string }>', default: '[]', description: 'Items with x and y from 0 to 1' },
      { name: 'quadrants', type: '{ topLeft?, topRight?, bottomLeft?, bottomRight?: { label?: string; color?: string } }', default: '{}', description: 'Quadrant labels and tints' },
      { name: 'size', type: 'number', default: '820', description: 'Plot size in px' },
    ],
    snippet:
      '<Quadrants\n  xAxis={{ label: "Effort", low: "Low", high: "High" }}\n  yAxis={{ label: "Impact", low: "Low", high: "High" }}\n  quadrants={{ topLeft: { label: "Quick wins", color: "teal" } }}\n  items={[{ label: "Cache", x: 0.2, y: 0.8 }]}\n/>',
    previewCode:
      '<Slide scheme="dark">\n  <Quadrants size={640} xAxis={{ label: "Effort", low: "Low", high: "High" }} yAxis={{ label: "Impact", low: "Low", high: "High" }} quadrants={{ topLeft: { label: "Quick wins", color: "teal" } }} items={[{ label: "Cache", x: 0.2, y: 0.8 }]} />\n</Slide>',
    keywords: ['matrix', 'quadrant', 'four', 'axis', 'eisenhower', 'priority', '2x2', 'fyrfältare'],
    useCases: ['Prioritising by two criteria'],
  },
})

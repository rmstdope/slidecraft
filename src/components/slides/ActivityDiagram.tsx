import { motion } from 'motion/react'
import { staggerContainer } from '../../animations/variants'
import { accentColors, isAccent, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'

export interface ActivityNode {
  id: string
  type: 'start' | 'end' | 'action' | 'decision' | 'fork' | 'join'
  label?: string
  color?: AccentColor
  /** 0 is the centre column, -1 left, 1 right. */
  column?: number
  /** Defaults to the index in the array. */
  row?: number
}

export interface ActivityDiagramProps {
  nodes: ActivityNode[]
  edges: { from: string; to: string; label?: string }[]
  rowSpacing?: number
  columnSpacing?: number
  /** Render width in px; the drawing scales to it. Defaults to its natural size. */
  width?: number
}

const SIZE = { action: { w: 160, h: 50 }, decision: { w: 60, h: 60 }, start: { w: 24, h: 24 }, end: { w: 24, h: 24 }, fork: { w: 120, h: 6 }, join: { w: 120, h: 6 } } as const
const ARROW = 8
const nodeVariants = { initial: { opacity: 0, scale: 0.8 }, animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } } }

interface Placed {
  node: ActivityNode
  x: number
  y: number
}

export function layoutActivity(nodes: ActivityNode[], rowSpacing: number, columnSpacing: number) {
  const raw = nodes.map((node, i) => ({ node, x: (node.column ?? 0) * columnSpacing, y: (node.row ?? i) * rowSpacing }))
  const minX = Math.min(...raw.map((p) => p.x)) - columnSpacing
  const maxX = Math.max(...raw.map((p) => p.x)) + columnSpacing
  const height = Math.max(...raw.map((p) => p.y)) + rowSpacing
  const offsetX = -minX
  return { placed: raw.map((p) => ({ ...p, x: p.x + offsetX, y: p.y + rowSpacing / 2 })), width: maxX - minX, height }
}

const bounds = (p: Placed) => {
  const s = SIZE[p.node.type]
  return { top: { x: p.x, y: p.y - s.h / 2 }, bottom: { x: p.x, y: p.y + s.h / 2 }, left: { x: p.x - s.w / 2, y: p.y }, right: { x: p.x + s.w / 2, y: p.y } }
}

function ActivityDiagramComponent({ nodes, edges, rowSpacing = 100, columnSpacing = 200, width: renderWidth }: ActivityDiagramProps) {
  const { placed, width, height } = layoutActivity(nodes, rowSpacing, columnSpacing)
  const byId = new Map(placed.map((p) => [p.node.id, p]))
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={renderWidth ?? width} height={renderWidth ? (height * renderWidth) / width : height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', fontFamily: 'var(--font-body)' }} role="img" aria-label="Activity diagram">
        {edges.map((edge, k) => {
          const a = byId.get(edge.from)
          const b = byId.get(edge.to)
          if (!a || !b) return null
          const dx = b.x - a.x
          const dy = b.y - a.y
          const vertical = Math.abs(dy) > Math.abs(dx) || dy > 0
          const ab = bounds(a)
          const bb = bounds(b)
          let d: string
          let head: string
          let label: { x: number; y: number; anchor: 'start' | 'end' | 'middle' }
          if (vertical) {
            const start = dy >= 0 ? ab.bottom : ab.top
            const end = dy >= 0 ? bb.top : bb.bottom
            const sign = dy >= 0 ? 1 : -1
            if (Math.abs(end.x - start.x) < 5) {
              d = `M${start.x},${start.y} L${end.x},${end.y - sign * ARROW}`
              label = { x: start.x + 12, y: start.y + 15 * sign, anchor: 'start' }
            } else {
              const midY = (start.y + end.y) / 2
              d = `M${start.x},${start.y} L${start.x},${midY} L${end.x},${midY} L${end.x},${end.y - sign * ARROW}`
              label = { x: (start.x + end.x) / 2, y: midY - 8, anchor: 'middle' }
            }
            head = sign > 0 ? `${end.x},${end.y} ${end.x - ARROW / 2},${end.y - ARROW} ${end.x + ARROW / 2},${end.y - ARROW}` : `${end.x},${end.y} ${end.x - ARROW / 2},${end.y + ARROW} ${end.x + ARROW / 2},${end.y + ARROW}`
          } else {
            const right = dx >= 0
            const start = right ? ab.right : ab.left
            const end = right ? bb.left : bb.right
            const sign = right ? 1 : -1
            d = `M${start.x},${start.y} L${end.x - sign * ARROW},${end.y}`
            head = `${end.x},${end.y} ${end.x - sign * ARROW},${end.y - ARROW / 2} ${end.x - sign * ARROW},${end.y + ARROW / 2}`
            label = { x: start.x + sign * 12, y: start.y - 10, anchor: right ? 'start' : 'end' }
          }
          return (
            <g key={k}>
              <motion.path d={d} fill="none" stroke="var(--text)" strokeWidth={2} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.2 + k * 0.05 }} />
              <motion.polygon points={head} fill="var(--text)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + k * 0.05 }} />
              {edge.label && <text x={label.x} y={label.y} textAnchor={label.anchor} fontSize={13} fontStyle="italic" fill="var(--muted)">{edge.label}</text>}
            </g>
          )
        })}
        {placed.map(({ node, x, y }) => {
          const accent: AccentColor = isAccent(node.color) ? node.color : 'gray'
          const s = SIZE[node.type]
          return (
            <motion.g key={node.id} variants={nodeVariants} style={{ transformOrigin: `${x}px ${y}px` }}>
              {node.type === 'start' && <circle cx={x} cy={y} r={12} fill="var(--text)" />}
              {node.type === 'end' && (
                <>
                  <circle cx={x} cy={y} r={12} fill="none" stroke="var(--text)" strokeWidth={3} />
                  <circle cx={x} cy={y} r={6} fill="var(--text)" />
                </>
              )}
              {(node.type === 'fork' || node.type === 'join') && <rect x={x - s.w / 2} y={y - s.h / 2} width={s.w} height={s.h} rx={2} fill="var(--text)" />}
              {node.type === 'action' && (
                <>
                  <rect x={x - s.w / 2} y={y - s.h / 2} width={s.w} height={s.h} rx={10} fill={tint(accent, 0.18)} stroke={accentColors[accent]} strokeWidth={2} />
                  <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={14} fill="var(--text)">{node.label}</text>
                </>
              )}
              {node.type === 'decision' && (
                <>
                  <polygon points={`${x},${y - 30} ${x + 30},${y} ${x},${y + 30} ${x - 30},${y}`} fill={tint(accent, 0.18)} stroke={accentColors[accent]} strokeWidth={2} />
                  <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={12} fill="var(--text)">{node.label}</text>
                </>
              )}
            </motion.g>
          )
        })}
      </svg>
    </motion.div>
  )
}

export const ActivityDiagram = defineComponent<ActivityDiagramProps>({
  Component: ActivityDiagramComponent,
  registry: {
    id: 'activity-diagram',
    name: 'ActivityDiagram',
    category: 'component',
    description: 'UML-style activity diagram with actions, decisions, and flows.',
    props: [
      { name: 'nodes', type: 'Array<{ id: string; type: "start" | "end" | "action" | "decision" | "fork" | "join"; label?: string; color?: string; column?: number; row?: number }>', description: 'Nodes; column 0 is the centre' },
      { name: 'edges', type: 'Array<{ from: string; to: string; label?: string }>', description: 'Flows between nodes' },
      { name: 'rowSpacing', type: 'number', default: '100', description: 'Vertical spacing in px' },
      { name: 'columnSpacing', type: 'number', default: '200', description: 'Horizontal spacing in px' },
      { name: 'width', type: 'number', description: 'Render width in px; the drawing scales to fit' },
    ],
    snippet:
      '<ActivityDiagram\n  nodes={[\n    { id: "s", type: "start" },\n    { id: "a", type: "action", label: "Write deck", color: "teal" },\n    { id: "d", type: "decision", label: "OK?" },\n    { id: "e", type: "end" },\n  ]}\n  edges={[{ from: "s", to: "a" }, { from: "a", to: "d" }, { from: "d", to: "e", label: "yes" }]}\n/>',
    previewCode: '<Slide scheme="dark">\n  <ActivityDiagram nodes={[{ id: "s", type: "start" }, { id: "a", type: "action", label: "Write deck", color: "teal" }, { id: "e", type: "end" }]} edges={[{ from: "s", to: "a" }, { from: "a", to: "e" }]} />\n</Slide>',
    keywords: ['activity', 'diagram', 'uml', 'flow', 'flowchart', 'decision', 'process'],
    useCases: ['A process with decisions'],
  },
  toolbar: [
    { prop: 'rowSpacing', type: 'number', min: 80, max: 140, step: 10 },
    { prop: 'columnSpacing', type: 'number', min: 150, max: 300, step: 25 },
  ],
})

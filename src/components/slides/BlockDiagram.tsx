import { motion } from 'motion/react'
import { accentColors, isAccent, onAccent, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { drawProps } from './draw'
import { captionStyle, fadeRise } from './styles'

export type Side = 'top' | 'bottom' | 'left' | 'right'
export interface Pt {
  x: number
  y: number
}
export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface BlockNodeItem {
  label: string
  sub?: string
  accent?: AccentColor
}

export interface BlockNode {
  id: string
  row: number
  column: number
  rowSpan?: number
  colSpan?: number
  kicker?: string
  title: string
  sub?: string
  items?: (string | BlockNodeItem)[]
  accent?: AccentColor
  dashed?: boolean
  emphasis?: boolean
}

export interface BlockEdge {
  from: string
  to: string
  label?: string
  dashed?: boolean
  accent?: AccentColor
  fromSide?: Side
  toSide?: Side
  fromAt?: number
  toAt?: number
}

export interface BlockDiagramProps {
  nodes: BlockNode[]
  edges?: BlockEdge[]
  caption?: string
  width?: number
  rowHeight?: number
  gap?: number
}

const CORNER = 14
const HEAD_LEN = 16
const HEAD_HALF = 9

export function gridBoxes(nodes: BlockNode[], width: number, rowHeight: number, gap: number) {
  const columns = Math.max(1, ...nodes.map((n) => n.column + (n.colSpan ?? 1)))
  const rows = Math.max(1, ...nodes.map((n) => n.row + (n.rowSpan ?? 1)))
  const colW = (width - gap * (columns - 1)) / columns
  const totalH = rows * rowHeight + (rows - 1) * gap
  const boxes = new Map<string, Box>()
  for (const n of nodes) {
    const cs = n.colSpan ?? 1
    const rs = n.rowSpan ?? 1
    boxes.set(n.id, { x: n.column * (colW + gap), y: n.row * (rowHeight + gap), w: cs * colW + (cs - 1) * gap, h: rs * rowHeight + (rs - 1) * gap })
  }
  return { boxes, totalH }
}

const centre = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

/** Leave horizontally when the boxes are further apart across than down, else vertically. */
export function inferSides(from: Box, to: Box): [Side, Side] {
  const a = centre(from)
  const b = centre(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right', 'left'] : ['left', 'right']
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom']
}

export function anchor(b: Box, side: Side, at = 0.5): Pt {
  switch (side) {
    case 'top':
      return { x: b.x + b.w * at, y: b.y }
    case 'bottom':
      return { x: b.x + b.w * at, y: b.y + b.h }
    case 'left':
      return { x: b.x, y: b.y + b.h * at }
    case 'right':
      return { x: b.x + b.w, y: b.y + b.h * at }
  }
}

/** Pull the path end back along the entry direction so it stops where the arrowhead begins. */
export function backOff(end: Pt, toSide: Side, len = HEAD_LEN): Pt {
  switch (toSide) {
    case 'left':
      return { x: end.x - len, y: end.y }
    case 'right':
      return { x: end.x + len, y: end.y }
    case 'top':
      return { x: end.x, y: end.y - len }
    case 'bottom':
      return { x: end.x, y: end.y + len }
  }
}

const horizontal = (s: Side) => s === 'left' || s === 'right'

/** Orthogonal waypoints between two faces. */
export function route(start: Pt, end: Pt, fromSide: Side, toSide: Side): Pt[] {
  if (horizontal(fromSide) && horizontal(toSide)) {
    if (Math.abs(start.y - end.y) < 0.5) return [start, end]
    const midX = (start.x + end.x) / 2
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
  }
  if (!horizontal(fromSide) && !horizontal(toSide)) {
    if (Math.abs(start.x - end.x) < 0.5) return [start, end]
    const midY = (start.y + end.y) / 2
    return [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
  }
  return horizontal(fromSide) ? [start, { x: end.x, y: start.y }, end] : [start, { x: start.x, y: end.y }, end]
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

/** Path through the waypoints with rounded corners of radius min(CORNER, half of each leg). */
export function roundedPath(input: Pt[]): string {
  const points = input.filter((p, i) => i === 0 || dist(p, input[i - 1]) >= 0.5)
  if (points.length < 2) return ''
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const corner = points[i]
    const next = points[i + 1]
    const inLen = dist(prev, corner)
    const outLen = dist(corner, next)
    const r = Math.min(CORNER, inLen / 2, outLen / 2)
    const before = { x: corner.x + ((prev.x - corner.x) / inLen) * r, y: corner.y + ((prev.y - corner.y) / inLen) * r }
    const after = { x: corner.x + ((next.x - corner.x) / outLen) * r, y: corner.y + ((next.y - corner.y) / outLen) * r }
    d += ` L${before.x},${before.y} Q${corner.x},${corner.y} ${after.x},${after.y}`
  }
  const last = points[points.length - 1]
  return `${d} L${last.x},${last.y}`
}

const ENTRY_ANGLE: Record<Side, number> = { left: 0, right: 180, top: 90, bottom: 270 }

/** Midpoint of the longest leg, where an edge label is placed. */
export function labelPoint(points: Pt[]): Pt {
  let best = { len: -1, mid: points[0] }
  for (let i = 1; i < points.length; i++) {
    const len = dist(points[i - 1], points[i])
    if (len > best.len) best = { len, mid: { x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2 } }
  }
  return best.mid
}

function BlockDiagramComponent({ nodes, edges = [], caption, width = 1700, rowHeight = 190, gap = 28 }: BlockDiagramProps) {
  const { boxes, totalH } = gridBoxes(nodes, width, rowHeight, gap)
  return (
    <motion.div {...fadeRise} style={{ width }}>
      <div style={{ position: 'relative', width, height: totalH }}>
        {nodes.map((n) => {
          const b = boxes.get(n.id)!
          const accent: AccentColor = isAccent(n.accent) ? n.accent : 'gray'
          const color = accentColors[accent]
          const ink = n.emphasis ? onAccent(accent) : 'var(--text)'
          return (
            <div
              key={n.id}
              style={{
                position: 'absolute',
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h,
                padding: '18px 24px',
                borderRadius: 14,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 8,
                border: `2px ${n.dashed ? 'dashed' : 'solid'} ${color}`,
                background: n.emphasis ? color : tint(accent, 0.14),
                color: ink,
                textAlign: 'left',
                fontFamily: 'var(--font-body)',
              }}
            >
              {n.kicker && <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: n.emphasis ? ink : color, opacity: n.emphasis ? 0.85 : 1 }}>{n.kicker}</div>}
              <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2 }}>{n.title}</div>
              {n.sub && <div style={{ fontSize: 22, color: n.emphasis ? ink : 'var(--muted)', opacity: n.emphasis ? 0.8 : 1 }}>{n.sub}</div>}
              {n.items && n.items.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {n.items.map((item, i) => {
                    const it = typeof item === 'string' ? { label: item } : item
                    return (
                      <span key={i} style={{ fontSize: 20, padding: '6px 12px', borderRadius: 7, background: tint('gray', 0.18), border: `1px solid ${accentColors[isAccent(it.accent) ? it.accent : accent]}` }}>
                        {it.label}
                        {it.sub && <span style={{ opacity: 0.7 }}> · {it.sub}</span>}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {/* Connectors in an overlay, so arrowheads stay visible at block borders. */}
        <svg width={width} height={totalH} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden>
          {edges.map((edge, index) => {
            const from = boxes.get(edge.from)
            const to = boxes.get(edge.to)
            if (!from || !to) return null
            const [inferredFrom, inferredTo] = inferSides(from, to)
            const fromSide = edge.fromSide ?? inferredFrom
            const toSide = edge.toSide ?? inferredTo
            const start = anchor(from, fromSide, edge.fromAt)
            const tip = anchor(to, toSide, edge.toAt)
            const points = route(start, backOff(tip, toSide), fromSide, toSide)
            const color = accentColors[isAccent(edge.accent) ? edge.accent : 'gray']
            const label = edge.label ? labelPoint(points) : undefined
            return (
              <g key={index}>
                <motion.path d={roundedPath(points)} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeDasharray={edge.dashed ? '9 8' : undefined} {...drawProps(index, edge.dashed)} />
                <motion.polygon
                  points={`${tip.x},${tip.y} ${tip.x - HEAD_LEN},${tip.y - HEAD_HALF} ${tip.x - HEAD_LEN},${tip.y + HEAD_HALF}`}
                  transform={`rotate(${ENTRY_ANGLE[toSide]} ${tip.x} ${tip.y})`}
                  fill={color}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + index * 0.12 }}
                />
                {label && (
                  <g>
                    <rect x={label.x - (11.2 * edge.label!.length + 16) / 2} y={label.y - 15} width={11.2 * edge.label!.length + 16} height={30} rx={6} fill="var(--bg)" />
                    <text x={label.x} y={label.y} dy="0.35em" textAnchor="middle" fontSize={20} fill="var(--muted)" fontFamily="var(--font-body)">
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {caption && <div style={captionStyle}>{caption}</div>}
    </motion.div>
  )
}

export const BlockDiagram = defineComponent<BlockDiagramProps>({
  Component: BlockDiagramComponent,
  registry: {
    id: 'block-diagram',
    name: 'BlockDiagram',
    category: 'component',
    description: 'General-purpose boxes-and-arrows diagram on a row/column grid.',
    props: [
      { name: 'nodes', type: 'Array<{ id: string; row: number; column: number; title: string; kicker?: string; sub?: string; items?: string[]; accent?: string; dashed?: boolean; emphasis?: boolean; rowSpan?: number; colSpan?: number }>', description: 'Boxes on the grid' },
      { name: 'edges', type: 'Array<{ from: string; to: string; label?: string; dashed?: boolean; accent?: string; fromSide?: string; toSide?: string }>', default: '[]', description: 'Arrows between boxes, drawn in source order' },
      { name: 'caption', type: 'string', description: 'Italic caption below' },
      { name: 'width', type: 'number', default: '1700', description: 'Width in px' },
      { name: 'rowHeight', type: 'number', default: '190', description: 'Row height in px' },
      { name: 'gap', type: 'number', default: '28', description: 'Gap between cells in px' },
    ],
    snippet:
      '<BlockDiagram\n  nodes={[\n    { id: "client", row: 0, column: 0, title: "Client" },\n    { id: "api", row: 0, column: 1, title: "API", emphasis: true, accent: "teal" },\n    { id: "db", row: 0, column: 2, title: "Database" },\n  ]}\n  edges={[\n    { from: "client", to: "api", label: "HTTPS" },\n    { from: "api", to: "db" },\n  ]}\n/>',
    previewCode:
      '<Slide theme="dark">\n  <BlockDiagram nodes={[{ id: "client", row: 0, column: 0, title: "Client" }, { id: "api", row: 0, column: 1, title: "API", emphasis: true, accent: "teal" }, { id: "db", row: 0, column: 2, title: "Database" }]} edges={[{ from: "client", to: "api", label: "HTTPS" }, { from: "api", to: "db" }]} />\n</Slide>',
    keywords: ['block', 'architecture', 'boxes', 'arrows', 'dataflow', 'pipeline', 'topology', 'c4', 'system'],
    useCases: ['System architecture', 'Data flow between parts'],
  },
})

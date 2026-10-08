import { motion } from 'motion/react'
import { accentColors } from './accents'
import { defineComponent } from './defineComponent'

export type Tone = 'pale-yellow' | 'yellow' | 'gray' | 'slate' | 'dark' | 'teal' | 'red' | 'navy'

export const TONES: Record<Tone, string> = {
  'pale-yellow': '#f8e3a0',
  yellow: accentColors.yellow,
  gray: '#c9c9c9',
  slate: '#7d8794',
  dark: '#3a3a3a',
  teal: accentColors.teal,
  red: accentColors.red,
  navy: accentColors.navy,
}

export interface Stage {
  id: string
  title: string
  lines?: string[]
  color: Tone
}
export interface Target {
  id: string
  /** "\n" splits lines. */
  label: string
  color?: Tone
  x?: number
  y?: number
  w?: number
  h?: number
}
export interface LoopArrow {
  from: string
  to: string
  label?: string
  color?: Tone
}

export interface FeedbackLoopsProps {
  stages: Stage[]
  arrows?: LoopArrow[]
  targets?: Target[]
  feedbacks?: LoopArrow[]
  width?: number
  height?: number
}

const R = 115
const RING_STROKE = 24
const R_OUT = 127
const STAGE_Y = 220
const ARROW_THICK = 22
const HEAD_LEN = 32
const HEAD_HALF = 23
const LABEL_Y = STAGE_Y + R_OUT + 52
export const LANE_TOP = LABEL_Y + 34
export const LANE_GAP = 38
const CORNER = 16

type Node = { kind: 'ring'; cx: number; cy: number; color: string } | { kind: 'box'; x: number; y: number; w: number; h: number; color: string }

export function stageCentres(count: number, width: number): number[] {
  const padX = 160
  const span = width - 2 * padX
  return Array.from({ length: count }, (_, i) => (count > 1 ? padX + (span * i) / (count - 1) : width / 2))
}

export function defaultTargetBox(index: number): { x: number; y: number; w: number; h: number } {
  if (index === 0) return { x: 60, y: 620, w: 300, h: 150 }
  if (index === 1) return { x: 410, y: 620, w: 250, h: 96 }
  return { x: 60 + index * 380, y: 620, w: 280, h: 120 }
}

/** Shrink a ring label to the chord available at vertical offset dy inside the ring. */
export function ringFont(text: string, base: number, dy: number): number {
  const inner = R - 12 - 4
  const chord = 2 * Math.sqrt(Math.max(0, inner * inner - dy * dy)) * 0.94
  const estimate = 0.54 * base * text.length
  return estimate <= chord ? base : Math.max(13, chord / (0.54 * text.length))
}

interface Endpoint {
  x: number
  y: number
}

export interface RoutedFeedback {
  index: number
  start: Endpoint
  end: Endpoint
  laneY: number
  down: boolean
}

/**
 * Route feedback arrows (Part 2 §6.8): slots so arrows into or out of one node never cross,
 * then one horizontal lane per downward return, narrowest span on the shallowest lane, so
 * returns nest instead of crossing. Upward returns share the lane above.
 */
export function routeFeedbacks(feedbacks: LoopArrow[], nodes: Map<string, Node>): RoutedFeedback[] {
  const centreX = (n: Node) => (n.kind === 'ring' ? n.cx : n.x + n.w / 2)
  const centreY = (n: Node) => (n.kind === 'ring' ? n.cy : n.y + n.h / 2)
  const valid = feedbacks.map((f, index) => ({ f, index, from: nodes.get(f.from), to: nodes.get(f.to) })).filter((e): e is typeof e & { from: Node; to: Node } => !!e.from && !!e.to)

  const outSlots = new Map<number, [number, number]>()
  const inSlots = new Map<number, [number, number]>()
  for (const key of new Set(valid.map((e) => e.f.from))) {
    const group = valid.filter((e) => e.f.from === key).sort((a, b) => centreX(a.to) - centreX(b.to))
    group.forEach((e, slot) => outSlots.set(e.index, [slot, group.length]))
  }
  for (const key of new Set(valid.map((e) => e.f.to))) {
    const group = valid.filter((e) => e.f.to === key).sort((a, b) => centreX(a.from) - centreX(b.from))
    group.forEach((e, slot) => inSlots.set(e.index, [slot, group.length]))
  }

  const routed = valid.map(({ index, from, to }) => {
    const down = centreY(to) > centreY(from)
    const [os, on] = outSlots.get(index)!
    const [is, inCount] = inSlots.get(index)!
    const start: Endpoint =
      from.kind === 'ring'
        ? { x: from.cx + (os - (on - 1) / 2) * 22, y: from.cy + (down ? R_OUT : -R_OUT) }
        : { x: from.x + 0.28 * from.w + (os - (on - 1) / 2) * 40, y: down ? from.y + from.h : from.y }
    let end: Endpoint
    if (to.kind === 'ring') {
      end = { x: to.cx + (is - (inCount - 1) / 2) * 22, y: to.cy + (down ? -(R_OUT + 4) : R_OUT + 4) }
    } else {
      const step = inCount > 1 ? Math.min(to.w - 60, (inCount - 1) * 46) / (inCount - 1) : 0
      end = { x: to.x + to.w / 2 + (is - (inCount - 1) / 2) * step, y: down ? to.y : to.y + to.h }
    }
    return { index, start, end, down, laneY: 0 }
  })

  const downward = routed.filter((r) => r.down).sort((a, b) => Math.abs(a.end.x - a.start.x) - Math.abs(b.end.x - b.start.x))
  downward.forEach((r, i) => (r.laneY = LANE_TOP + i * LANE_GAP))
  for (const r of routed) if (!r.down) r.laneY = LANE_TOP - LANE_GAP
  return routed
}

export function feedbackPath({ start, end, laneY }: RoutedFeedback): string {
  if (Math.abs(end.x - start.x) < 1) return `M${start.x},${start.y} L${end.x},${end.y}`
  const r = Math.min(CORNER, Math.abs(end.x - start.x) / 2)
  const dirX = end.x > start.x ? 1 : -1
  const v1 = laneY > start.y ? 1 : -1
  const v2 = end.y > laneY ? 1 : -1
  return [
    `M${start.x},${start.y}`,
    `L${start.x},${laneY - v1 * r}`,
    `Q${start.x},${laneY} ${start.x + dirX * r},${laneY}`,
    `L${end.x - dirX * r},${laneY}`,
    `Q${end.x},${laneY} ${end.x},${laneY + v2 * r}`,
    `L${end.x},${end.y}`,
  ].join(' ')
}

function FeedbackLoopsComponent({ stages, arrows = [], targets = [], feedbacks = [], width = 1760, height = 820 }: FeedbackLoopsProps) {
  const xs = stageCentres(stages.length, width)
  const nodes = new Map<string, Node>()
  stages.forEach((s, i) => nodes.set(s.id, { kind: 'ring', cx: xs[i], cy: STAGE_Y, color: TONES[s.color] ?? TONES.gray }))
  targets.forEach((t, i) => {
    const d = defaultTargetBox(i)
    nodes.set(t.id, { kind: 'box', x: t.x ?? d.x, y: t.y ?? d.y, w: t.w ?? d.w, h: t.h ?? d.h, color: TONES[t.color ?? 'slate'] })
  })
  const routed = routeFeedbacks(feedbacks, nodes)
  const font = 'var(--font-body)'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Feedback loops" style={{ overflow: 'visible' }}>
        {arrows.map((arrow, i) => {
          const src = nodes.get(arrow.from)
          const dst = nodes.get(arrow.to)
          if (src?.kind !== 'ring' || dst?.kind !== 'ring') return null
          const color = arrow.color ? TONES[arrow.color] : src.color
          const x1 = src.cx + R_OUT - 4
          const tipX = dst.cx - R_OUT - 2
          const x2 = tipX - HEAD_LEN + 1
          return (
            <g key={`push-${i}`}>
              <motion.line x1={x1} y1={STAGE_Y} x2={x2} y2={STAGE_Y} stroke={color} strokeWidth={ARROW_THICK} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 0.2 + i * 0.15 }} />
              <motion.polygon points={`${tipX},${STAGE_Y} ${tipX - HEAD_LEN},${STAGE_Y - HEAD_HALF} ${tipX - HEAD_LEN},${STAGE_Y + HEAD_HALF}`} fill={color} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.15 }} />
              {arrow.label && (
                <motion.text x={(x1 + tipX) / 2} y={LABEL_Y} textAnchor="middle" fontSize={22} fontStyle="italic" fill="var(--muted)" fontFamily={font} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.15 }}>
                  {arrow.label}
                </motion.text>
              )}
            </g>
          )
        })}
        {stages.map((stage, i) => {
          const node = nodes.get(stage.id) as Extract<Node, { kind: 'ring' }>
          const lines = [stage.title, ...(stage.lines ?? [])]
          return (
            <g key={stage.id}>
              <motion.circle cx={node.cx} cy={node.cy} r={R} fill="none" stroke={node.color} strokeWidth={RING_STROKE} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: i * 0.1 }} />
              {lines.map((line, j) => {
                const dy = (j - (lines.length - 1) / 2) * 32
                return (
                  <motion.text key={j} x={node.cx} y={node.cy + dy} dy="0.35em" textAnchor="middle" fontSize={ringFont(line, j === 0 ? 30 : 24, dy)} fontWeight={j === 0 ? 700 : 400} fill="var(--text)" fontFamily={font} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.1 + j * 0.04 }}>
                    {line}
                  </motion.text>
                )
              })}
            </g>
          )
        })}
        {targets.map((target) => {
          const node = nodes.get(target.id) as Extract<Node, { kind: 'box' }>
          const lines = target.label.split('\n')
          return (
            <motion.g key={target.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} style={{ transformOrigin: `${node.x + node.w / 2}px ${node.y + node.h / 2}px` }}>
              <rect x={node.x} y={node.y} width={node.w} height={node.h} rx={4} fill="none" stroke={node.color} strokeWidth={3} />
              {lines.map((line, j) => (
                <text key={j} x={node.x + node.w / 2} y={node.y + node.h / 2 + (j - (lines.length - 1) / 2) * 36} dy="0.35em" textAnchor="middle" fontSize={28} fill="var(--text)" fontFamily={font}>
                  {line}
                </text>
              ))}
            </motion.g>
          )
        })}
        {routed.map((r, i) => {
          const f = feedbacks[r.index]
          const color = f.color ? TONES[f.color] : nodes.get(f.from)!.color
          return (
            <g key={`fb-${r.index}`}>
              <motion.path d={feedbackPath(r)} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, delay: 1 + i * 0.12 }} />
              <motion.polygon
                points={`${r.end.x},${r.end.y} ${r.end.x - 9},${r.end.y - (r.down ? 14 : -14)} ${r.end.x + 9},${r.end.y - (r.down ? 14 : -14)}`}
                fill={color}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 + i * 0.12 }}
              />
            </g>
          )
        })}
      </svg>
    </motion.div>
  )
}

export const FeedbackLoops = defineComponent<FeedbackLoopsProps>({
  Component: FeedbackLoopsComponent,
  registry: {
    id: 'feedback-loops',
    name: 'FeedbackLoops',
    category: 'component',
    description: 'CI/CD pipeline with stage rings, push arrows, and feedback loops back to roles.',
    props: [
      { name: 'stages', type: 'Array<{ id: string; title: string; lines?: string[]; color: Tone }>', description: 'Rings from left to right' },
      { name: 'arrows', type: 'Array<{ from: string; to: string; label?: string; color?: Tone }>', default: '[]', description: 'Push arrows between stages' },
      { name: 'targets', type: 'Array<{ id: string; label: string; color?: Tone; x?: number; y?: number; w?: number; h?: number }>', default: '[]', description: 'Role boxes below' },
      { name: 'feedbacks', type: 'Array<{ from: string; to: string; color?: Tone }>', default: '[]', description: 'Return arrows on stacked lanes' },
      { name: 'width', type: 'number', default: '1760', description: 'Width in px' },
      { name: 'height', type: 'number', default: '820', description: 'Height in px' },
    ],
    snippet:
      '<FeedbackLoops\n  stages={[\n    { id: "plan", title: "Planning", color: "pale-yellow" },\n    { id: "push", title: "Pre-push", color: "yellow" },\n    { id: "ci", title: "CI", color: "teal" },\n    { id: "manual", title: "Manual", lines: ["testing"], color: "slate" },\n    { id: "mon", title: "Monitoring", color: "navy" },\n  ]}\n  arrows={[\n    { from: "plan", to: "push", label: "code" },\n    { from: "push", to: "ci", label: "push" },\n    { from: "ci", to: "manual", label: "deploy" },\n    { from: "manual", to: "mon", label: "release" },\n  ]}\n  targets={[\n    { id: "stake", label: "Stakeholders" },\n    { id: "dev", label: "Developer" },\n  ]}\n  feedbacks={[\n    { from: "push", to: "dev" },\n    { from: "ci", to: "dev" },\n    { from: "manual", to: "dev" },\n    { from: "manual", to: "stake" },\n    { from: "mon", to: "stake" },\n    { from: "mon", to: "dev" },\n  ]}\n/>',
    previewCode:
      '<Slide theme="dark">\n  <FeedbackLoops stages={[{ id: "push", title: "Pre-push", color: "yellow" }, { id: "ci", title: "CI", color: "teal" }, { id: "mon", title: "Monitoring", color: "navy" }]} arrows={[{ from: "push", to: "ci" }, { from: "ci", to: "mon" }]} targets={[{ id: "dev", label: "Developer" }]} feedbacks={[{ from: "ci", to: "dev" }, { from: "mon", to: "dev" }]} />\n</Slide>',
    keywords: ['cicd', 'pipeline', 'feedback', 'loops', 'devops', 'flow'],
    useCases: ['How fast each stage reports back'],
  },
})

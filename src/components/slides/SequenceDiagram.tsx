import { motion } from 'motion/react'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, isAccent, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'

export interface SequenceDiagramProps {
  actors: { id: string; label: string; color?: AccentColor }[]
  messages: { from: string; to: string; label: string; type?: 'solid' | 'dashed' }[]
  showLifelines?: boolean
  messageSpacing?: number
  /** Render width in px; the drawing scales to it. Defaults to its natural size. */
  width?: number
}

const ACTOR_W = 140
const ACTOR_H = 50
const ACTOR_SPACING = 200
const TOP = 20
const MESSAGE_START = TOP + ACTOR_H + 40
const ARROW = 8

export const actorX = (index: number): number => (index < 0 ? 0 : (index + 0.5) * ACTOR_SPACING)

function SequenceDiagramComponent({ actors, messages, showLifelines = true, messageSpacing = 60, width: renderWidth }: SequenceDiagramProps) {
  const width = actors.length * ACTOR_SPACING
  const height = MESSAGE_START + messages.length * messageSpacing + 60
  const xOf = (id: string) => actorX(actors.findIndex((a) => a.id === id))
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={renderWidth ?? width} height={renderWidth ? (height * renderWidth) / width : height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', fontFamily: 'var(--font-body)' }} role="img" aria-label="Sequence diagram">
        {showLifelines &&
          actors.map((actor, i) => (
            <motion.line key={`life-${actor.id}`} x1={actorX(i)} x2={actorX(i)} y1={TOP + ACTOR_H} y2={height} stroke="#a0a4ab" strokeWidth={2} strokeDasharray="8,4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
          ))}
        {actors.map((actor, i) => {
          const accent: AccentColor = isAccent(actor.color) ? actor.color : 'gray'
          return (
            <motion.g key={actor.id} variants={itemVariants}>
              <rect x={actorX(i) - ACTOR_W / 2} y={TOP} width={ACTOR_W} height={ACTOR_H} rx={6} fill={tint(accent, 0.18)} stroke={accentColors[accent]} strokeWidth={2} />
              <text x={actorX(i)} y={TOP + ACTOR_H / 2} dy="0.35em" textAnchor="middle" fontSize={16} fontWeight={600} fill="var(--text)">{actor.label}</text>
            </motion.g>
          )
        })}
        {messages.map((m, k) => {
          const y = MESSAGE_START + k * messageSpacing
          const fromX = xOf(m.from)
          const toX = xOf(m.to)
          const dash = m.type === 'dashed' ? '6,4' : undefined
          if (m.from === m.to) {
            const d = `M${fromX},${y} L${fromX + 40},${y} L${fromX + 40},${y + 30} L${fromX + ARROW},${y + 30}`
            return (
              <motion.g key={k} variants={itemVariants}>
                <motion.path d={d} fill="none" stroke="var(--text)" strokeWidth={2} strokeDasharray={dash} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
                <polygon points={`${fromX},${y + 30} ${fromX + ARROW},${y + 30 - ARROW / 2} ${fromX + ARROW},${y + 30 + ARROW / 2}`} fill="var(--text)" />
                <text x={fromX + 50} y={y + 15} dy="0.35em" fontSize={14} fill="var(--text)">{m.label}</text>
              </motion.g>
            )
          }
          const dir = toX > fromX ? 1 : -1
          const end = toX - dir * ARROW
          return (
            <motion.g key={k} variants={itemVariants}>
              <motion.line x1={fromX} y1={y} x2={end} y2={y} stroke="var(--text)" strokeWidth={2} strokeDasharray={dash} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
              <motion.polygon points={`${toX},${y} ${end},${y - ARROW / 2} ${end},${y + ARROW / 2}`} fill="var(--text)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.2, delay: 0.4 }} style={{ transformOrigin: `${toX}px ${y}px` }} />
              <text x={(fromX + toX) / 2} y={y - 8} textAnchor="middle" fontSize={14} fill="var(--text)">{m.label}</text>
            </motion.g>
          )
        })}
      </svg>
    </motion.div>
  )
}

export const SequenceDiagram = defineComponent<SequenceDiagramProps>({
  Component: SequenceDiagramComponent,
  registry: {
    id: 'sequence-diagram',
    name: 'SequenceDiagram',
    category: 'component',
    description: 'UML-style sequence diagram with actors and messages.',
    props: [
      { name: 'actors', type: 'Array<{ id: string; label: string; color?: "yellow" | "teal" | "red" | "navy" | "gray" }>', description: 'Lanes from left to right' },
      { name: 'messages', type: 'Array<{ from: string; to: string; label: string; type?: "solid" | "dashed" }>', description: 'Messages from top to bottom' },
      { name: 'showLifelines', type: 'boolean', default: 'true', description: 'Dashed lines under the actors' },
      { name: 'messageSpacing', type: 'number', default: '60', description: 'Vertical gap between messages in px' },
      { name: 'width', type: 'number', description: 'Render width in px; the drawing scales to fit' },
    ],
    snippet: '<SequenceDiagram\n  actors={[{ id: "client", label: "Client", color: "teal" }, { id: "server", label: "Server", color: "navy" }]}\n  messages={[\n    { from: "client", to: "server", label: "GET /deck" },\n    { from: "server", to: "client", label: "200 OK", type: "dashed" },\n  ]}\n/>',
    previewCode: '<Slide scheme="dark">\n  <SequenceDiagram actors={[{ id: "client", label: "Client", color: "teal" }, { id: "server", label: "Server", color: "navy" }]} messages={[{ from: "client", to: "server", label: "GET /deck" }, { from: "server", to: "client", label: "200 OK", type: "dashed" }]} />\n</Slide>',
    keywords: ['sequence', 'diagram', 'uml', 'message', 'actor', 'flow', 'api'],
    useCases: ['A request and its response', 'A protocol between services'],
  },
  toolbar: [
    { prop: 'showLifelines', type: 'boolean' },
    { prop: 'messageSpacing', type: 'number', min: 40, max: 120, step: 10 },
  ],
})

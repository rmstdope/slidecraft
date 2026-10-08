import { motion } from 'motion/react'
import { staggerContainer } from '../../animations/variants'
import { accentColors, isAccent, tint, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'

export interface Field {
  name: string
  type: string
  primary?: boolean
  required?: boolean
}

export interface Entity {
  id: string
  name: string
  kind?: 'entity' | 'interface' | 'type' | 'enum'
  color?: AccentColor
  fields?: Field[]
  values?: string[]
  column?: number
  row?: number
}

export interface Relation {
  from: string
  to: string
  type?: 'one-to-one' | 'one-to-many' | 'many-to-many' | 'extends' | 'implements'
  label?: string
}

export interface DataModelProps {
  entities: Entity[]
  relations?: Relation[]
  columnSpacing?: number
  rowSpacing?: number
  /** Render width in px; the drawing scales to it. Defaults to its natural size. */
  width?: number
}

const ENTITY_WIDTH = 200
const HEADER_HEIGHT = 36
const FIELD_HEIGHT = 28
const ENTITY_PADDING = 12
const nodeVariants = { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } } }

export function entityHeight(entity: Entity): number {
  const rows = entity.kind === 'enum' ? (entity.values?.length ?? 0) : (entity.fields?.length ?? 0)
  return HEADER_HEIGHT + rows * FIELD_HEIGHT + 2 * ENTITY_PADDING
}

export function layoutEntities(entities: Entity[], columnSpacing: number, rowSpacing: number) {
  const raw = entities.map((e, i) => ({ entity: e, x: (e.column ?? i) * columnSpacing, y: (e.row ?? 0) * rowSpacing, h: entityHeight(e) }))
  const minX = Math.min(...raw.map((b) => b.x)) - 50
  const minY = Math.min(...raw.map((b) => b.y)) - 30
  const maxX = Math.max(...raw.map((b) => b.x + ENTITY_WIDTH)) + 50
  const maxY = Math.max(...raw.map((b) => b.y + b.h)) + 30
  return { boxes: raw.map((b) => ({ ...b, x: b.x - minX, y: b.y - minY })), width: maxX - minX, height: maxY - minY }
}

function DataModelComponent({ entities, relations = [], columnSpacing = 280, rowSpacing = 200, width: renderWidth }: DataModelProps) {
  const { boxes, width, height } = layoutEntities(entities, columnSpacing, rowSpacing)
  const byId = new Map(boxes.map((b) => [b.entity.id, b]))
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={renderWidth ?? width} height={renderWidth ? (height * renderWidth) / width : height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', fontFamily: 'var(--font-body)' }} role="img" aria-label="Data model">
        {relations.map((rel, k) => {
          const a = byId.get(rel.from)
          const b = byId.get(rel.to)
          if (!a || !b) return null
          const inherit = rel.type === 'extends' || rel.type === 'implements'
          const ac = { x: a.x + ENTITY_WIDTH / 2, y: a.y + a.h / 2 }
          const bc = { x: b.x + ENTITY_WIDTH / 2, y: b.y + b.h / 2 }
          let points: { x: number; y: number }[]
          if (Math.abs(a.y - b.y) < 10) {
            const right = bc.x > ac.x
            points = [{ x: right ? a.x + ENTITY_WIDTH : a.x, y: ac.y }, { x: right ? b.x : b.x + ENTITY_WIDTH, y: bc.y }]
          } else if (Math.abs(a.x - b.x) < 10) {
            const down = bc.y > ac.y
            points = [{ x: ac.x, y: down ? a.y + a.h : a.y }, { x: bc.x, y: down ? b.y : b.y + b.h }]
          } else if (inherit) {
            const start = { x: ac.x, y: a.y }
            const end = { x: bc.x, y: b.y + b.h }
            const midY = (start.y + end.y) / 2
            points = [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end]
          } else {
            const right = bc.x > ac.x
            const start = { x: right ? a.x + ENTITY_WIDTH : a.x, y: ac.y }
            const end = { x: right ? b.x : b.x + ENTITY_WIDTH, y: bc.y }
            const midX = (start.x + end.x) / 2
            points = [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end]
          }
          const end = points[points.length - 1]
          const prev = points[points.length - 2]
          const angle = (Math.atan2(end.y - prev.y, end.x - prev.x) * 180) / Math.PI
          const size = inherit ? 10 : 8
          const start = points[0]
          const next = points[1]
          const startAngle = (Math.atan2(start.y - next.y, start.x - next.x) * 180) / Math.PI
          const unit = (p: { x: number; y: number }, q: { x: number; y: number }) => {
            const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
            return { x: (q.x - p.x) / len, y: (q.y - p.y) / len }
          }
          const u1 = unit(start, next)
          const u2 = unit(end, prev)
          const showCardinality = !inherit && rel.type
          return (
            <g key={k}>
              <motion.path d={`M${points.map((p) => `${p.x},${p.y}`).join(' L')}`} fill="none" stroke="var(--text)" strokeWidth={2} strokeDasharray={inherit ? '6,4' : undefined} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
              <polygon points={`${end.x},${end.y} ${end.x - size * 1.4},${end.y - size / 1.4} ${end.x - size * 1.4},${end.y + size / 1.4}`} transform={`rotate(${angle} ${end.x} ${end.y})`} fill={inherit ? 'var(--bg)' : 'var(--text)'} stroke="var(--text)" strokeWidth={inherit ? 2 : 0} />
              {rel.type === 'many-to-many' && <polygon points={`${start.x},${start.y} ${start.x - 11},${start.y - 6} ${start.x - 11},${start.y + 6}`} transform={`rotate(${startAngle} ${start.x} ${start.y})`} fill="var(--text)" />}
              {showCardinality && (
                <>
                  <text x={start.x + u1.x * 16 - u1.y * 12} y={start.y + u1.y * 16 + u1.x * 12} dy="0.35em" textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--muted)">{rel.type === 'many-to-many' ? '*' : '1'}</text>
                  <text x={end.x + u2.x * 16 - u2.y * 12} y={end.y + u2.y * 16 + u2.x * 12} dy="0.35em" textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--muted)">{rel.type === 'one-to-many' || rel.type === 'many-to-many' ? '*' : '1'}</text>
                </>
              )}
              {rel.label && <text x={(start.x + end.x) / 2} y={Math.min(start.y, end.y) - 10} textAnchor="middle" fontSize={12} fontStyle="italic" fill="var(--muted)">{rel.label}</text>}
            </g>
          )
        })}
        {boxes.map(({ entity, x, y, h }) => {
          const accent: AccentColor = isAccent(entity.color) ? entity.color : 'teal'
          const header = accentColors[accent]
          const ink = accent === 'yellow' ? '#1a1a1a' : '#ffffff'
          const rows = entity.kind === 'enum' ? (entity.values ?? []).map((v) => ({ name: v, type: '' }) as Field) : (entity.fields ?? [])
          return (
            <motion.g key={entity.id} variants={nodeVariants} style={{ transformOrigin: `${x + ENTITY_WIDTH / 2}px ${y + h / 2}px` }}>
              <rect x={x + 3} y={y + 3} width={ENTITY_WIDTH} height={h} rx={6} fill="rgba(0,0,0,0.1)" />
              <rect x={x} y={y} width={ENTITY_WIDTH} height={h} rx={6} fill={tint(accent, 0.12)} stroke={header} strokeWidth={2} />
              <rect x={x} y={y} width={ENTITY_WIDTH} height={HEADER_HEIGHT} rx={6} fill={header} />
              <rect x={x} y={y + HEADER_HEIGHT - 6} width={ENTITY_WIDTH} height={6} fill={header} />
              {entity.kind && entity.kind !== 'entity' && <text x={x + ENTITY_WIDTH / 2} y={y + 12} textAnchor="middle" fontSize={10} fill={ink} opacity={0.8}>«{entity.kind}»</text>}
              <text x={x + ENTITY_WIDTH / 2} y={y + (entity.kind && entity.kind !== 'entity' ? 28 : 23)} textAnchor="middle" fontSize={16} fontWeight={600} fill={ink} fontFamily="var(--font-display)">{entity.name}</text>
              <line x1={x} x2={x + ENTITY_WIDTH} y1={y + HEADER_HEIGHT} y2={y + HEADER_HEIGHT} stroke={header} />
              {rows.map((field, i) => (
                <text key={i} x={x + ENTITY_PADDING} y={y + HEADER_HEIGHT + ENTITY_PADDING + i * FIELD_HEIGHT + 18} fontSize={13} fill="var(--text)">
                  {field.primary && <tspan fill={header}>⚷ </tspan>}
                  <tspan fontWeight={field.required ? 600 : 400}>{field.name}</tspan>
                  {field.type && <tspan fill="var(--muted)">: {field.type}</tspan>}
                  {entity.kind !== 'enum' && !field.required && !field.primary && <tspan fill="var(--muted)" fontSize={11}> ?</tspan>}
                </text>
              ))}
            </motion.g>
          )
        })}
      </svg>
    </motion.div>
  )
}

export const DataModel = defineComponent<DataModelProps>({
  Component: DataModelComponent,
  registry: {
    id: 'data-model',
    name: 'DataModel',
    category: 'component',
    description: 'Entity relationship diagram for data models.',
    props: [
      { name: 'entities', type: 'Array<{ id: string; name: string; kind?: "entity" | "interface" | "type" | "enum"; color?: string; fields?: Array<{ name: string; type: string; primary?: boolean; required?: boolean }>; values?: string[]; column?: number; row?: number }>', description: 'Boxes; column defaults to the index' },
      { name: 'relations', type: 'Array<{ from: string; to: string; type?: "one-to-one" | "one-to-many" | "many-to-many" | "extends" | "implements"; label?: string }>', default: '[]', description: 'Lines between entities' },
      { name: 'columnSpacing', type: 'number', default: '280', description: 'Horizontal spacing in px' },
      { name: 'rowSpacing', type: 'number', default: '200', description: 'Vertical spacing in px' },
      { name: 'width', type: 'number', description: 'Render width in px; the drawing scales to fit' },
    ],
    snippet:
      '<DataModel\n  entities={[\n    { id: "deck", name: "Deck", fields: [{ name: "id", type: "string", primary: true }, { name: "title", type: "string", required: true }] },\n    { id: "slide", name: "Slide", color: "navy", fields: [{ name: "id", type: "string", primary: true }, { name: "deckId", type: "string", required: true }] },\n  ]}\n  relations={[{ from: "deck", to: "slide", type: "one-to-many", label: "has" }]}\n/>',
    previewCode: '<Slide theme="dark">\n  <DataModel entities={[{ id: "deck", name: "Deck", fields: [{ name: "id", type: "string", primary: true }] }, { id: "slide", name: "Slide", color: "navy", fields: [{ name: "deckId", type: "string", required: true }] }]} relations={[{ from: "deck", to: "slide", type: "one-to-many" }]} />\n</Slide>',
    keywords: ['data', 'model', 'entity', 'relationship', 'erd', 'diagram', 'schema', 'database'],
    useCases: ['A data model', 'Types and how they relate'],
  },
  toolbar: [
    { prop: 'columnSpacing', type: 'number', min: 220, max: 400, step: 20 },
    { prop: 'rowSpacing', type: 'number', min: 150, max: 300, step: 25 },
  ],
})

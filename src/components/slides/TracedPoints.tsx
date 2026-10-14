import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepState } from '../../animations/stepContext'
import { readStep } from '../../animations/steps'
import { itemVariants } from '../../animations/variants'
import { accentColors, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { connector, GlowFilter, LINE_SHAPES, metalTextStyle, polyline, Spark, type LineShape, useWireKit } from './glow'
import { useAccent } from './slideLayoutContext'

export interface TracedPointProps {
  label: string
  /** A short line under the label. */
  detail?: string
  /** Reveal this point, and its line, on this build step. */
  step?: number
}

export interface TracedPointsProps {
  /** The statement every point follows from; drawn large on the left. */
  title: string
  children?: ReactNode
  /** Smooth S-curves or circuit traces with 45° corners. */
  lines?: LineShape
  accent?: AccentColor
  /** Title size in px. */
  titleSize?: number
  /** Total width in px. */
  width?: number
}

const TITLE_WIDTH = 600
const HUB_X = 720
const HUB_RING = 26
const END_X = 1010
const TEXT_X = 1050

export interface TracedPointsLayout {
  height: number
  hubY: number
  /** y of each point. */
  ys: number[]
}

/** Points spread evenly around the hub's height, closer together when there are many. */
export function tracedPointsLayout(count: number): TracedPointsLayout {
  const n = Math.max(1, count)
  const spacing = n > 1 ? Math.min(230, 700 / (n - 1)) : 0
  const height = Math.max(420, (n - 1) * spacing + 200)
  const hubY = height / 2
  return { height, hubY, ys: Array.from({ length: n }, (_, i) => hubY + (i - (n - 1) / 2) * spacing) }
}

function points(children: ReactNode): TracedPointProps[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<TracedPointProps> => isValidElement(child) && (child.type as { displayName?: string }).displayName === 'TracedPoint')
    .map((child) => child.props)
}

function TracedPointsComponent({ title, children, lines = 'curved', accent: accentProp, titleSize = 96, width = 1760 }: TracedPointsProps) {
  const accent = useAccent(accentProp)
  const kit = useWireKit(accentColors[accent])
  const { colors: c, filter, effects, live } = kit
  const { step: current } = useStepState()
  const items = points(children)
  const { height, hubY, ys } = tracedPointsLayout(items.length)
  const entry = live ? undefined : false

  const stepped = items.some((p) => readStep(p.step) != null)
  const visible = items.map((p) => {
    const beat = readStep(p.step)
    return beat == null || current >= beat
  })
  const delayOf = (i: number) => (stepped ? 0.1 : 0.9 + i * 0.9)
  const lead = polyline([[TITLE_WIDTH + 30, hubY], [HUB_X - HUB_RING, hubY]])
  const wires = ys.map((y) => connector([HUB_X + HUB_RING, hubY], [END_X, y], lines))

  return (
    <motion.div variants={itemVariants} style={{ position: 'relative', width, height, flexShrink: 0 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
        <defs>
          <GlowFilter kit={kit} width={width} height={height} />
        </defs>
        <motion.path d={lead.d} fill="none" stroke={c.wire} strokeWidth={3} strokeLinecap="round" filter={filter} initial={entry ?? { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.3 }} />
        <motion.g initial={entry ?? { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.6 }}>
          <circle cx={HUB_X} cy={hubY} r={HUB_RING} fill="none" stroke={c.accent} strokeWidth={2} />
          <circle cx={HUB_X} cy={hubY} r={11} fill={c.core} filter={filter} />
        </motion.g>
        {wires.map((wire, i) => (
          <g key={i}>
            <motion.path
              d={wire.d}
              fill="none"
              stroke={c.wire}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={filter}
              initial={entry ?? { pathLength: 0, opacity: 0 }}
              animate={visible[i] ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.7, delay: delayOf(i) }}
            />
            {live && visible[i] && <Spark wire={wire} color={c.pulse} filter={filter} delay={delayOf(i)} />}
            {live && visible[i] && (
              <motion.circle
                cx={END_X}
                cy={ys[i]}
                r={20}
                fill="none"
                stroke={c.accent}
                strokeWidth={2}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: [1, 0], scale: [0.4, 2.6] }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: delayOf(i) + 0.65 }}
              />
            )}
            <motion.circle
              cx={END_X}
              cy={ys[i]}
              r={10}
              fill={c.core}
              filter={filter}
              initial={entry ?? { opacity: 0 }}
              animate={{ opacity: visible[i] ? 1 : 0 }}
              transition={{ duration: 0.3, delay: delayOf(i) + 0.6 }}
            />
          </g>
        ))}
      </svg>
      <motion.div
        initial={entry ?? { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05 }}
        style={{ position: 'absolute', left: 0, top: 0, width: TITLE_WIDTH, height, display: 'flex', alignItems: 'center' }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: titleSize, lineHeight: 1.05, color: 'var(--text)', ...(effects.titleFinish === 'metal' ? metalTextStyle(kit.scheme) : {}) }}>{title}</span>
      </motion.div>
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={entry ?? { opacity: 0, y: 12 }}
          animate={visible[i] ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, delay: delayOf(i) + 0.65 }}
          style={{ position: 'absolute', left: TEXT_X, top: ys[i] - 32, width: width - TEXT_X, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 46, lineHeight: 1.1, color: 'var(--text)' }}>{item.label}</span>
          {item.detail && <span style={{ fontFamily: 'var(--font-body)', fontSize: 28, color: 'var(--muted)' }}>{item.detail}</span>}
        </motion.div>
      ))}
    </motion.div>
  )
}

/** Read by TracedPoints; renders nothing on its own. */
function TracedPointComponent(_props: TracedPointProps) {
  return null
}

const PREVIEW = `<TracedPoints title="Three things changed">
  <TracedPoint label="Build time down 41%" detail="Remote cache on every branch" />
  <TracedPoint label="Flaky tests quarantined" detail="212 moved, 9 fixed so far" />
  <TracedPoint label="Two regions, one pipeline" detail="eu-north joins in November" />
</TracedPoints>`

export const TracedPoints = defineComponent<TracedPointsProps>({
  Component: TracedPointsComponent,
  registry: {
    id: 'traced-points',
    name: 'TracedPoints',
    category: 'component',
    description: 'A statement on the left wired to the points that follow from it, each line drawing out with a spark as its point arrives.',
    props: [
      { name: 'title', type: 'string', description: 'The statement the points follow from' },
      { name: 'lines', type: '"curved" | "angled"', default: '"curved"', description: 'Smooth curves or circuit traces' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'titleSize', type: 'number', default: '96', description: 'Title size in px' },
      { name: 'width', type: 'number', default: '1760', description: 'Total width in px' },
    ],
    snippet: '<TracedPoints title="Three things changed">\n  <TracedPoint step={1} label="First point" detail="Why it matters" />\n  <TracedPoint step={2} label="Second point" />\n</TracedPoints>',
    previewCode: `<Slide scheme="dark">\n${PREVIEW}\n</Slide>`,
    keywords: ['points', 'reasons', 'consequences', 'mind map', 'branches', 'wires', 'glow', 'animated', 'futuristic'],
    useCases: ['Three or four points that all follow from one headline', 'A review slide: what changed and why'],
  },
  toolbar: [
    { prop: 'lines', type: 'select', options: [...LINE_SHAPES] },
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'titleSize', type: 'number', min: 48, max: 140, step: 4 },
  ],
})

export const TracedPoint = defineComponent<TracedPointProps>({
  Component: TracedPointComponent,
  registry: {
    id: 'traced-point',
    name: 'TracedPoint',
    category: 'component',
    description: 'One point of a TracedPoints, with a label and an optional detail line.',
    props: [
      { name: 'label', type: 'string', description: 'The point' },
      { name: 'detail', type: 'string', description: 'A short line under it' },
      { name: 'step', type: 'number', description: 'Reveal the point and its line on this build step' },
    ],
    snippet: '<TracedPoint step={1} label="Build time down 41%" detail="Remote cache on every branch" />',
    previewCode: `<Slide scheme="dark">\n${PREVIEW}\n</Slide>`,
    keywords: ['point', 'branch'],
  },
})

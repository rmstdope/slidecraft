import { Children, createContext, isValidElement, useContext, useEffect, useState, type ReactNode } from 'react'
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react'
import { useStepVisible } from '../../animations/stepContext'
import { useStepMotion } from '../../animations/stepMotion'
import { readStep } from '../../animations/steps'
import { itemVariants, staggerContainer } from '../../animations/variants'
import { accentColors, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { GlowFilter, metalTextStyle, useWireKit, type Point } from './glow'
import { useAccent } from './slideLayoutContext'

export interface GaugeProps {
  value: number
  /** The value of a full ring. */
  max?: number
  /** A tick on the ring that lights up when the value passes it. */
  target?: number
  /** Written after the number, e.g. "%" or " ms". */
  unit?: string
  /** Below the ring. */
  label?: string
  /** Small text inside the ring, under the number. */
  caption?: string
  accent?: AccentColor
  /** Fill the ring and count the number up on entry. */
  countUp?: boolean
  /** Width in px; the gauge scales as a whole. Inside a GaugeRow the row sizes it unless set. */
  size?: number
  step?: number
  morph?: string
}

/** The gauge is drawn at 640 × 620 and scaled to its size. */
const WIDTH = 640
const MIN_SIZE = 200
const CONTENT_WIDTH = 1760
const HEIGHT = 620
const CX = 320
const CY = 300
const R = 200
const START = 135
const SWEEP = 270

/** A point on a circle; angles in degrees, clockwise from three o'clock (SVG coordinates). */
export const polar = (cx: number, cy: number, r: number, degrees: number): Point => [cx + r * Math.cos((degrees * Math.PI) / 180), cy + r * Math.sin((degrees * Math.PI) / 180)]

/** The angle on the 270° gauge for a fraction of the ring, clamped to the ring. */
export const gaugeAngle = (fraction: number): number => START + SWEEP * Math.min(1, Math.max(0, fraction))

/** Width of each gauge in a row of `count`, so the row fits the content width: 640 at most. */
export function gaugeSize(count: number, gap: number, width = CONTENT_WIDTH): number {
  const n = Math.max(1, count)
  return Math.max(MIN_SIZE, Math.min(WIDTH, Math.floor((width - (n - 1) * gap) / n)))
}

/** The size a GaugeRow gives its gauges. */
const GaugeRowContext = createContext<number | undefined>(undefined)

const decimalsOf = (n: number) => (Number.isInteger(n) ? 0 : Math.min(3, (String(n).split('.')[1] ?? '').length))

function GaugeComponent({ value, max = 100, target, unit = '%', label, caption, accent: accentProp, countUp = true, size: sizeProp, step, morph }: GaugeProps) {
  const rowSize = useContext(GaugeRowContext)
  const size = Math.max(MIN_SIZE, sizeProp ?? rowSize ?? WIDTH)
  const scale = size / WIDTH
  const accent = useAccent(accentProp)
  const kit = useWireKit(accentColors[accent])
  const { colors: c, filter, effects, live } = kit
  const visible = useStepVisible(readStep(step))
  const stepMotion = useStepMotion(step, morph)

  const safeMax = max > 0 ? max : 100
  const fraction = Math.min(1, Math.max(0, value / safeMax))
  const decimals = decimalsOf(value)
  const animated = live && countUp
  // progress runs 0 → 1; the arc, the head, the number and the target all follow it.
  const progress = useMotionValue(animated ? 0 : 1)
  const [met, setMet] = useState(!animated && target != null && value >= target)

  useEffect(() => {
    if (!animated) {
      progress.set(1)
      return
    }
    if (!visible) {
      progress.set(0)
      return
    }
    const controls = animate(progress, 1, { duration: 1.9, delay: 0.5, ease: [0.2, 0.7, 0.2, 1] })
    return () => controls.stop()
  }, [animated, visible, progress])

  useMotionValueEvent(progress, 'change', (p) => {
    const next = target != null && value * p >= target
    if (next !== met) setMet(next)
  })

  const arcLength = useTransform(progress, (p) => p * fraction)
  const headX = useTransform(progress, (p) => polar(CX, CY, R, gaugeAngle(p * fraction))[0])
  const headY = useTransform(progress, (p) => polar(CX, CY, R, gaugeAngle(p * fraction))[1])
  const number = useTransform(progress, (p) => (value * p).toFixed(decimals))

  const [sx, sy] = polar(CX, CY, R, START)
  const [ex, ey] = polar(CX, CY, R, START + SWEEP)
  const ring = `M${sx},${sy} A${R},${R} 0 1 1 ${ex},${ey}`
  const ticks = Array.from({ length: 51 }, (_, k) => {
    const angle = START + (SWEEP * k) / 50
    const major = k % 5 === 0
    const [x1, y1] = polar(CX, CY, R + 30, angle)
    const [x2, y2] = polar(CX, CY, R + (major ? 52 : 42), angle)
    return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? c.steel : c.dim} strokeWidth={3} />
  })
  const targetAngle = target != null ? gaugeAngle(target / safeMax) : 0
  const [t1x, t1y] = polar(CX, CY, R - 24, targetAngle)
  const [t2x, t2y] = polar(CX, CY, R + 62, targetAngle)
  const [lx, ly] = polar(CX, CY, R + 92, targetAngle)
  const metal = effects.titleFinish === 'metal' ? metalTextStyle(kit.scheme) : {}

  return (
    <motion.div variants={itemVariants} {...stepMotion} style={{ position: 'relative', width: size, height: Math.round(HEIGHT * scale), flexShrink: 0 }}>
      {/* Drawn at 640 × 620 and scaled as a whole, so the ring, number and labels keep their proportions. */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: WIDTH, height: HEIGHT, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: 'top left' }}>
        <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
          <defs>
            <GlowFilter kit={kit} width={WIDTH} height={HEIGHT} />
          </defs>
          {ticks}
          <path d={ring} fill="none" stroke={c.dim} strokeWidth={14} strokeLinecap="round" />
          <motion.path d={ring} fill="none" stroke={c.accent} strokeWidth={14} strokeLinecap="round" filter={filter} style={{ pathLength: arcLength, opacity: fraction > 0 ? 1 : 0 }} />
          {target != null && (
            <>
              <line x1={t1x} y1={t1y} x2={t2x} y2={t2y} stroke={met ? c.core : 'var(--muted)'} strokeWidth={5} filter={met ? filter : undefined} style={{ transition: 'stroke 0.3s' }} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, letterSpacing: '0.12em', fill: met ? c.accent : 'var(--muted)', transition: 'fill 0.3s' }}
              >
                TARGET {target}
              </text>
            </>
          )}
          {fraction > 0 && <motion.circle r={13} cx={headX} cy={headY} fill={c.core} filter={filter} />}
        </svg>
        <div style={{ position: 'absolute', left: 0, top: CY - 100, width: WIDTH, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 132, lineHeight: 1, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', ...metal }}>
            <motion.span>{number}</motion.span>
            {unit}
          </span>
          {caption && <span style={{ fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)' }}>{caption}</span>}
        </div>
        {label && (
          <div style={{ position: 'absolute', left: 0, top: HEIGHT - 70, width: WIDTH, textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 40, lineHeight: 1.15, color: 'var(--text)' }}>{label}</div>
        )}
      </div>
    </motion.div>
  )
}

export interface GaugeRowProps {
  children?: ReactNode
  /** Space between gauges in px. */
  gap?: number
}

function GaugeRowComponent({ children, gap = 80 }: GaugeRowProps) {
  const count = Children.toArray(children).filter((child) => isValidElement(child) && (child.type as { displayName?: string }).displayName === 'Gauge').length
  return (
    <GaugeRowContext.Provider value={gaugeSize(count, gap)}>
      <motion.div variants={staggerContainer} style={{ display: 'flex', gap, justifyContent: 'center', alignItems: 'flex-start' }}>
        {children}
      </motion.div>
    </GaugeRowContext.Provider>
  )
}

export const Gauge = defineComponent<GaugeProps>({
  Component: GaugeComponent,
  registry: {
    id: 'gauge',
    name: 'Gauge',
    category: 'component',
    description: 'A ring gauge whose arc fills while the number counts up, with an optional target tick that lights when it is passed.',
    props: [
      { name: 'value', type: 'number', description: 'The measured value' },
      { name: 'max', type: 'number', default: '100', description: 'The value of a full ring' },
      { name: 'target', type: 'number', description: 'A tick that lights up when the value passes it' },
      { name: 'unit', type: 'string', default: '"%"', description: 'Written after the number' },
      { name: 'label', type: 'string', description: 'Below the ring' },
      { name: 'caption', type: 'string', description: 'Small text inside the ring' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'countUp', type: 'boolean', default: 'true', description: 'Fill and count up on entry' },
      { name: 'size', type: 'number', default: '640', description: 'Width in px; in a GaugeRow the row sizes it to fit' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
      { name: 'morph', type: 'string', description: 'Shared-element id' },
    ],
    snippet: '<Gauge value={87} target={80} label="Remote cache hits" />',
    previewCode: '<Slide scheme="dark">\n  <Gauge value={87} target={80} label="Remote cache hits" caption="of all builds" />\n</Slide>',
    keywords: ['gauge', 'dial', 'meter', 'percentage', 'target', 'kpi', 'metric', 'ring', 'glow', 'animated', 'futuristic'],
    useCases: ['A measurement against a target', 'Two or three KPIs side by side in a GaugeRow'],
  },
  toolbar: [
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'countUp', type: 'boolean' },
    { prop: 'size', type: 'number', min: 200, max: 640, step: 20 },
  ],
})

export const GaugeRow = defineComponent<GaugeRowProps>({
  Component: GaugeRowComponent,
  registry: {
    id: 'gauge-row',
    name: 'GaugeRow',
    category: 'component',
    description: 'Two to four gauges side by side, sized to fit the slide and entering one after another.',
    props: [{ name: 'gap', type: 'number', default: '80', description: 'Space between gauges in px' }],
    snippet: '<GaugeRow>\n  <Gauge value={87} target={80} label="Remote cache hits" />\n  <Gauge value={94} target={90} label="Builds under 10 min" />\n</GaugeRow>',
    previewCode:
      '<Slide scheme="dark">\n  <GaugeRow>\n    <Gauge value={87} target={80} label="Cache hits" />\n    <Gauge value={94} target={90} label="Under 10 min" />\n    <Gauge value={71} target={75} label="Tests parallel" />\n  </GaugeRow>\n</Slide>',
    keywords: ['gauges', 'row', 'kpis', 'metrics'],
  },
  toolbar: [{ prop: 'gap', type: 'number', min: 0, max: 240, step: 20 }],
})

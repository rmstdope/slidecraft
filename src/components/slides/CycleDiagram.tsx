import { motion } from 'motion/react'
import { accentColors, isAccent, onAccent, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { drawProps } from './draw'
import { useAccent } from './slideLayoutContext'
import { captionStyle } from './styles'

export interface CycleStep {
  title: string
  meta?: string
  accent?: AccentColor
  /** Hub mode only. */
  satellite?: { label: string; accent?: AccentColor }
}

export interface CycleDiagramProps {
  /** Clockwise from the top. */
  steps: CycleStep[]
  mode?: 'cycle' | 'hub'
  centerTitle?: string
  centerSubtitle?: string
  centerAccent?: AccentColor
  arrowAccent?: AccentColor
  caption?: string
  size?: number
}

const NODE_R = 104
const HUB_R = 132
const SAT_RX = 96
const SAT_RY = 34
const ARROW_LEN = 20
const ARROW_HALF = 11
const DEG = Math.PI / 180

/** Ring geometry driven by what must fit (Part 2 §6.3); the drawing is then scaled through viewBox. */
export function cycleGeometry(count: number, mode: 'cycle' | 'hub', hasCenterTitle: boolean, hasSatellites: boolean) {
  const spacingR = count > 1 ? (NODE_R * 1.18) / Math.sin(Math.PI / count) : 0
  const centreR = mode === 'hub' ? HUB_R + NODE_R + 130 : NODE_R + (hasCenterTitle ? 140 : 0)
  const ringR = Math.max(spacingR, centreR, NODE_R)
  const outerR = ringR + NODE_R + (hasSatellites ? 2 * SAT_RY + 52 : 12)
  const gapDeg = Math.min(38, Math.asin(Math.min(NODE_R * 1.18, ringR) / ringR) / DEG)
  return { ringR, outerR, natural: 2 * outerR, centre: outerR, gapDeg }
}

export const angleOf = (i: number, count: number): number => -90 + (360 * i) / count

/** Greedy word wrap by character count, at most three lines. */
export function wrap(text: string, max = 13): string[] {
  const lines: string[] = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1]
    if (last !== undefined && (last + ' ' + word).length <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines.length > 3 ? [...lines.slice(0, 2), lines.slice(2).join(' ')] : lines
}

function CycleDiagramComponent({ steps, mode = 'cycle', centerTitle, centerSubtitle, centerAccent = 'navy', arrowAccent = 'gray', caption, size = 860 }: CycleDiagramProps) {
  const slideAccent = useAccent()
  const count = steps.length
  const hub = mode === 'hub'
  const hasSatellites = hub && steps.some((s) => s.satellite)
  const { ringR, natural, centre, gapDeg } = cycleGeometry(count, mode, !!centerTitle, hasSatellites)
  const at = (angle: number, r: number) => ({ x: centre + r * Math.cos(angle * DEG), y: centre + r * Math.sin(angle * DEG) })
  const arrowColor = accentColors[isAccent(arrowAccent) ? arrowAccent : 'gray']
  const hubAccent: AccentColor = isAccent(centerAccent) ? centerAccent : 'navy'
  const head = (tip: { x: number; y: number }, rotation: number, key: string) => (
    <polygon key={key} points={`${tip.x},${tip.y} ${tip.x - ARROW_LEN},${tip.y - ARROW_HALF} ${tip.x - ARROW_LEN},${tip.y + ARROW_HALF}`} transform={`rotate(${rotation} ${tip.x} ${tip.y})`} fill={arrowColor} />
  )

  return (
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${natural} ${natural}`} role="img" aria-label={steps.map((s) => s.title).join(', ')}>
        {!hub &&
          count > 1 &&
          steps.map((_, i) => {
            const from = angleOf(i, count) + gapDeg
            const to = angleOf(i + 1, count) - gapDeg
            const headBack = ARROW_LEN / ringR / DEG
            const a = at(from, ringR)
            const b = at(to - headBack, ringR)
            const tip = at(to, ringR)
            return (
              <g key={`arc-${i}`}>
                <motion.path d={`M${a.x},${a.y} A${ringR},${ringR} 0 0 1 ${b.x},${b.y}`} fill="none" stroke={arrowColor} strokeWidth={5} strokeLinecap="round" {...drawProps(i)} />
                {head(tip, to + 90, `head-${i}`)}
              </g>
            )
          })}
        {hub &&
          steps.map((step, i) => {
            const angle = angleOf(i, count)
            const a = at(angle, ringR - NODE_R)
            const b = at(angle, HUB_R + ARROW_LEN)
            const satellite = step.satellite
            const satAccent = accentColors[isAccent(satellite?.accent) ? satellite!.accent! : 'gray']
            const sc = at(angle, ringR + NODE_R + 52)
            const n1 = at(angle, ringR + NODE_R)
            const n2 = at(angle, ringR + NODE_R + 52 - SAT_RY)
            return (
              <g key={`spoke-${i}`}>
                <motion.line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={arrowColor} strokeWidth={5} strokeLinecap="round" {...drawProps(i)} />
                {head(at(angle, HUB_R), angle + 180, `hub-head-${i}`)}
                {satellite && (
                  <>
                    <motion.line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={satAccent} strokeWidth={3} strokeDasharray="6 6" {...drawProps(i, true)} />
                    <ellipse cx={sc.x} cy={sc.y} rx={SAT_RX} ry={SAT_RY} fill="none" stroke={satAccent} strokeWidth={3} />
                    <text x={sc.x} y={sc.y} dy="0.35em" textAnchor="middle" fontSize={22} fill="var(--muted)" fontFamily="var(--font-body)">{satellite.label}</text>
                  </>
                )}
              </g>
            )
          })}
        {hub && (
          <g>
            <circle cx={centre} cy={centre} r={HUB_R} fill={accentColors[hubAccent]} />
            {centerTitle && <text x={centre} y={centre + (centerSubtitle ? -6 : 10)} textAnchor="middle" fontSize={30} fontWeight={700} fill={onAccent(hubAccent)} fontFamily="var(--font-body)">{centerTitle}</text>}
            {centerSubtitle && <text x={centre} y={centre + 28} textAnchor="middle" fontSize={23} fill={onAccent(hubAccent)} opacity={0.8} fontFamily="var(--font-body)">{centerSubtitle}</text>}
          </g>
        )}
        {!hub && centerTitle && (
          <g>
            <text x={centre} y={centre + (centerSubtitle ? -4 : 12)} textAnchor="middle" fontSize={38} fill="var(--text)" fontFamily="var(--font-display)">{centerTitle}</text>
            {centerSubtitle && <text x={centre} y={centre + 30} textAnchor="middle" fontSize={24} fill="var(--muted)" fontFamily="var(--font-body)">{centerSubtitle}</text>}
          </g>
        )}
        {steps.map((step, i) => {
          const accent = isAccent(step.accent) ? step.accent : slideAccent
          const ink = onAccent(accent)
          const c = at(angleOf(i, count), count === 1 && !hub ? 0 : ringR)
          const lines = wrap(step.title)
          const blockH = lines.length * 30 + (step.meta ? 26 : 0)
          const top = c.y - blockH / 2 + 22
          return (
            <g key={`node-${i}`}>
              <circle cx={c.x} cy={c.y} r={NODE_R} fill={accentColors[accent]} />
              {lines.map((line, j) => (
                <text key={j} x={c.x} y={top + j * 30} textAnchor="middle" fontSize={26} fontWeight={700} fill={ink} fontFamily="var(--font-body)">{line}</text>
              ))}
              {step.meta && <text x={c.x} y={top + lines.length * 30 + 2} textAnchor="middle" fontSize={21} fill={ink} opacity={0.8} fontFamily="var(--font-body)">{step.meta}</text>}
            </g>
          )
        })}
      </svg>
      {caption && <div style={{ ...captionStyle, marginTop: 12 }}>{caption}</div>}
    </motion.div>
  )
}

export const CycleDiagram = defineComponent<CycleDiagramProps>({
  Component: CycleDiagramComponent,
  registry: {
    id: 'cycle-diagram',
    name: 'CycleDiagram',
    category: 'component',
    description: 'Steps arranged in a loop, or spokes pointing at a hub.',
    props: [
      { name: 'steps', type: 'Array<{ title: string; meta?: string; accent?: string; satellite?: { label: string; accent?: string } }>', description: 'Clockwise from the top' },
      { name: 'mode', type: '"cycle" | "hub"', default: '"cycle"', description: 'A loop, or spokes into a hub' },
      { name: 'centerTitle', type: 'string', description: 'Text in the middle' },
      { name: 'centerSubtitle', type: 'string', description: 'Smaller line under the centre title' },
      { name: 'centerAccent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', default: '"navy"', description: 'Hub fill' },
      { name: 'arrowAccent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', default: '"gray"', description: 'Connector colour' },
      { name: 'caption', type: 'string', description: 'Italic caption below' },
      { name: 'size', type: 'number', default: '860', description: 'Rendered width and height in px' },
    ],
    snippet: '<CycleDiagram\n  centerTitle="Loop"\n  steps={[\n    { title: "Build", meta: "Day 1" },\n    { title: "Measure" },\n    { title: "Learn" },\n  ]}\n/>',
    previewCode: '<Slide theme="dark">\n  <CycleDiagram size={760} centerTitle="Loop" steps={[{ title: "Build" }, { title: "Measure" }, { title: "Learn" }]} />\n</Slide>',
    keywords: ['cycle', 'loop', 'circular', 'hub', 'spoke', 'iteration', 'process', 'diagram'],
    useCases: ['A feedback loop', 'Parts feeding one centre'],
  },
  toolbar: [
    { prop: 'mode', type: 'select', options: ['cycle', 'hub'] },
    { prop: 'centerAccent', type: 'select', options: ['navy', 'yellow', 'red', 'teal', 'gray'] },
    { prop: 'arrowAccent', type: 'select', options: ['gray', 'yellow', 'red', 'teal', 'navy'] },
  ],
})

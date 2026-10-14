import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useStepState } from '../../animations/stepContext'
import { readStep } from '../../animations/steps'
import { itemVariants } from '../../animations/variants'
import { accentColors, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { cubic, GlowFilter, LINE_SHAPES, nodePath, polyline, Pulse, type LineShape, type Wire, useWireKit } from './glow'
import { useAccent } from './slideLayoutContext'

export interface SignalNodeProps {
  label: string
  /** A short figure under the label, e.g. "12 ms p50". */
  metric?: string
  /** Reveal this node, and the wire into it, on this build step. */
  step?: number
}

export interface SignalBypassProps {
  /** 1-based index of the node the bypass leaves. */
  from: number
  /** 1-based index of the node it rejoins. */
  to: number
  label?: string
  step?: number
}

export interface SignalFlowProps {
  children?: ReactNode
  /** Shape of the bypass arcs. */
  lines?: LineShape
  /** Lights travel along the wires once the chain is built. */
  pulse?: boolean
  accent?: AccentColor
  /** Total width in px. */
  width?: number
}

const NODE_HEIGHT = 200
const NODE_MAX_WIDTH = 340
const MIN_GAP = 110
const BYPASS_ROOM = 190
const BYPASS_PEAK = 64

export interface SignalFlowLayout {
  nodeWidth: number
  gap: number
  /** y of the node tops. */
  top: number
  height: number
  /** x of each node's left edge. */
  xs: number[]
}

/** Nodes share the width evenly; room above them is kept only when a bypass needs it. */
export function signalFlowLayout(count: number, width: number, hasBypass: boolean): SignalFlowLayout {
  const n = Math.max(1, count)
  const nodeWidth = Math.min(NODE_MAX_WIDTH, n > 1 ? (width - (n - 1) * MIN_GAP) / n : width)
  const gap = n > 1 ? (width - n * nodeWidth) / (n - 1) : 0
  const top = hasBypass ? BYPASS_ROOM : 16
  return { nodeWidth, gap, top, height: top + NODE_HEIGHT + 16, xs: Array.from({ length: n }, (_, i) => i * (nodeWidth + gap)) }
}

/** An arc over the nodes from one node's top centre to another's. */
export function bypassWire(x0: number, x1: number, top: number, shape: LineShape): Wire {
  if (shape === 'curved') {
    const control = top + (BYPASS_PEAK - top) / 0.75 // a cubic with both controls at this height peaks at BYPASS_PEAK
    return cubic([x0, top], [x0, control], [x1, control], [x1, top])
  }
  const k = 40
  return polyline([[x0, top], [x0, BYPASS_PEAK + k], [x0 + k, BYPASS_PEAK], [x1 - k, BYPASS_PEAK], [x1, BYPASS_PEAK + k], [x1, top]])
}

const nameOf = (el: ReactElement) => (el.type as { displayName?: string }).displayName

function childrenOf<P>(children: ReactNode, name: string): P[] {
  return Children.toArray(children)
    .filter((child): child is ReactElement<P> => isValidElement(child) && nameOf(child) === name)
    .map((child) => child.props)
}

function SignalFlowComponent({ children, lines = 'curved', pulse = true, accent: accentProp, width = 1760 }: SignalFlowProps) {
  const accent = useAccent(accentProp)
  const kit = useWireKit(accentColors[accent])
  const { colors: c, filter, effects, uid, live } = kit
  const { step: current } = useStepState()

  const nodes = childrenOf<SignalNodeProps>(children, 'SignalNode')
  const bypasses = childrenOf<SignalBypassProps>(children, 'SignalBypass').filter((b) => b.from >= 1 && b.to >= 1 && b.from <= nodes.length && b.to <= nodes.length && b.from !== b.to)
  const layout = signalFlowLayout(nodes.length, width, bypasses.length > 0)
  const { nodeWidth, top, height, xs } = layout
  const midY = top + NODE_HEIGHT / 2

  const stepped = nodes.some((n) => readStep(n.step) != null)
  const shown = (step?: number) => {
    const beat = readStep(step)
    return beat == null || current >= beat
  }
  const visible = nodes.map((n) => shown(n.step))
  // Without steps the chain builds left to right; with steps each node arrives on its beat.
  const nodeDelay = (i: number) => (stepped ? 0 : 0.2 + i * 0.45)
  const built = stepped ? 0.9 : nodeDelay(nodes.length - 1) + 1.1
  const entry = live ? undefined : false

  const wires = nodes.slice(1).map((_, i) => polyline([[xs[i] + nodeWidth, midY], [xs[i + 1], midY]]))
  const arcs = bypasses.map((b) => {
    const a = Math.min(b.from, b.to) - 1
    const z = Math.max(b.from, b.to) - 1
    return { ...b, wire: bypassWire(xs[a] + nodeWidth / 2, xs[z] + nodeWidth / 2, top, lines), mid: (xs[a] + xs[z] + nodeWidth) / 2, visible: visible[a] && visible[z] && shown(b.step) }
  })

  return (
    <motion.div variants={itemVariants} style={{ position: 'relative', width, height, flexShrink: 0 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
        <defs>
          <GlowFilter kit={kit} width={width} height={height} />
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: c.panelTop }} />
            <stop offset="1" style={{ stopColor: c.panelBottom }} />
          </linearGradient>
          <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: c.steel }} />
            <stop offset="0.5" style={{ stopColor: c.accent }} />
            <stop offset="1" style={{ stopColor: c.dim }} />
          </linearGradient>
        </defs>
        {nodes.map((_, i) => {
          const d = nodePath(effects.corners, xs[i], top, nodeWidth, NODE_HEIGHT)
          return (
            <g key={`node-${i}`}>
              <motion.path d={d} fill={`url(#${uid}-fill)`} initial={entry ?? { opacity: 0 }} animate={{ opacity: visible[i] ? 1 : 0 }} transition={{ duration: 0.5, delay: nodeDelay(i) }} />
              <motion.path
                d={d}
                fill="none"
                stroke={`url(#${uid}-edge)`}
                strokeWidth={2.5}
                initial={entry ?? { pathLength: 0, opacity: 0 }}
                animate={visible[i] ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.8, delay: nodeDelay(i), ease: [0.5, 0, 0.2, 1] }}
              />
            </g>
          )
        })}
        {wires.map((wire, i) => {
          const on = visible[i] && visible[i + 1]
          const delay = stepped ? 0.2 : nodeDelay(i + 1) - 0.1
          return (
            <g key={`wire-${i}`}>
              <motion.path
                d={wire.d}
                fill="none"
                stroke={c.wire}
                strokeWidth={3}
                strokeLinecap="round"
                filter={filter}
                initial={entry ?? { pathLength: 0, opacity: 0 }}
                animate={on ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.4, delay }}
              />
              {[0, 1].map((end) => (
                <motion.circle
                  key={end}
                  cx={end ? xs[i + 1] : xs[i] + nodeWidth}
                  cy={midY}
                  r={8}
                  fill="var(--bg)"
                  stroke={c.accent}
                  strokeWidth={3}
                  initial={entry ?? { opacity: 0 }}
                  animate={{ opacity: on ? 1 : 0 }}
                  transition={{ duration: 0.3, delay: delay + end * 0.3 }}
                />
              ))}
              {pulse && live && on && <Pulse wire={wire} color={c.pulse} filter={filter} delay={built + i * 0.3} />}
            </g>
          )
        })}
        {arcs.map((arc, i) => (
          <g key={`bypass-${i}`}>
            <motion.path
              d={arc.wire.d}
              fill="none"
              stroke={c.steel}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={filter}
              initial={entry ?? { pathLength: 0, opacity: 0 }}
              animate={arc.visible ? { pathLength: 1, opacity: 0.85 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 1, delay: stepped ? 0.2 : built - 0.4 }}
            />
            {pulse && live && arc.visible && <Pulse wire={arc.wire} color={c.pulse} filter={filter} delay={built + 0.8 + i * 0.4} />}
          </g>
        ))}
      </svg>
      {nodes.map((node, i) => (
        <motion.div
          key={`text-${i}`}
          initial={entry ?? { opacity: 0, y: 12 }}
          animate={visible[i] ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, delay: nodeDelay(i) + 0.25 }}
          style={{ position: 'absolute', left: xs[i], top, width: nodeWidth, height: NODE_HEIGHT, padding: '30px 36px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}
        >
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 600, letterSpacing: '0.16em', color: c.steel }}>{String(i + 1).padStart(2, '0')}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 46, lineHeight: 1.1, color: 'var(--text)', whiteSpace: 'nowrap' }}>{node.label}</span>
          {node.metric && <span style={{ fontFamily: 'var(--font-body)', fontSize: 26, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{node.metric}</span>}
        </motion.div>
      ))}
      {arcs.map((arc, i) =>
        arc.label ? (
          <motion.div
            key={`label-${i}`}
            initial={entry ?? { opacity: 0 }}
            animate={{ opacity: arc.visible ? 1 : 0 }}
            transition={{ duration: 0.5, delay: stepped ? 0.5 : built }}
            style={{ position: 'absolute', left: arc.mid - 300, width: 600, top: 8, textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: 22, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: c.steel }}
          >
            {arc.label}
          </motion.div>
        ) : null,
      )}
    </motion.div>
  )
}

/** Read by SignalFlow; renders nothing on its own. */
function SignalNodeComponent(_props: SignalNodeProps) {
  return null
}

/** Read by SignalFlow; renders nothing on its own. */
function SignalBypassComponent(_props: SignalBypassProps) {
  return null
}

const PREVIEW = `<SignalFlow>
  <SignalNode label="Ingest" metric="2.1k docs/s" />
  <SignalNode label="Embed" metric="12 ms p50" />
  <SignalNode label="Index" metric="40M vectors" />
  <SignalNode label="Answer" metric="380 ms p95" />
  <SignalBypass from={1} to={3} label="cache hit · 62%" />
</SignalFlow>`

export const SignalFlow = defineComponent<SignalFlowProps>({
  Component: SignalFlowComponent,
  registry: {
    id: 'signal-flow',
    name: 'SignalFlow',
    category: 'component',
    description: 'A pipeline of nodes joined by wires that draw themselves, with lights travelling along them once the chain is built.',
    props: [
      { name: 'lines', type: '"curved" | "angled"', default: '"curved"', description: 'Shape of bypass arcs: smooth or a circuit trace' },
      { name: 'pulse', type: 'boolean', default: 'true', description: 'Lights travel along the wires, looping' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Defaults to the slide accent' },
      { name: 'width', type: 'number', default: '1760', description: 'Total width in px' },
    ],
    snippet: '<SignalFlow>\n  <SignalNode label="Ingest" metric="2.1k docs/s" />\n  <SignalNode label="Index" metric="40M vectors" />\n  <SignalNode label="Answer" metric="380 ms" />\n</SignalFlow>',
    previewCode: `<Slide scheme="dark">\n${PREVIEW}\n</Slide>`,
    keywords: ['pipeline', 'flow', 'process', 'wires', 'data flow', 'stages', 'glow', 'animated', 'futuristic'],
    useCases: ['How a request or data moves through a system', 'A short process where work flows left to right'],
  },
  toolbar: [
    { prop: 'lines', type: 'select', options: [...LINE_SHAPES] },
    { prop: 'pulse', type: 'boolean' },
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
  ],
})

export const SignalNode = defineComponent<SignalNodeProps>({
  Component: SignalNodeComponent,
  registry: {
    id: 'signal-node',
    name: 'SignalNode',
    category: 'component',
    parent: 'SignalFlow',
    description: 'One node of a SignalFlow, with a label and an optional figure.',
    props: [
      { name: 'label', type: 'string', description: 'Node name' },
      { name: 'metric', type: 'string', description: 'A short figure under the label' },
      { name: 'step', type: 'number', description: 'Reveal the node and the wire into it on this build step' },
    ],
    snippet: '<SignalNode label="Index" metric="40M vectors" />',
    previewCode: `<Slide scheme="dark">\n${PREVIEW}\n</Slide>`,
    keywords: ['node', 'stage', 'pipeline'],
  },
})

export const SignalBypass = defineComponent<SignalBypassProps>({
  Component: SignalBypassComponent,
  registry: {
    id: 'signal-bypass',
    name: 'SignalBypass',
    category: 'component',
    parent: 'SignalFlow',
    description: 'A second path over a SignalFlow that skips nodes, such as a cache hit.',
    props: [
      { name: 'from', type: 'number', description: '1-based index of the node it leaves' },
      { name: 'to', type: 'number', description: '1-based index of the node it rejoins' },
      { name: 'label', type: 'string', description: 'Shown above the arc' },
      { name: 'step', type: 'number', description: 'Reveal on this build step' },
    ],
    snippet: '<SignalBypass from={1} to={3} label="cache hit" />',
    previewCode: `<Slide scheme="dark">\n${PREVIEW}\n</Slide>`,
    keywords: ['bypass', 'shortcut', 'skip', 'cache'],
  },
})

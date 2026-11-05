import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { springs } from '../../animations/springs'
import { itemVariants } from '../../animations/variants'
import { accentColors, type AccentColor } from './accents'
import { useLive, useStages } from './beats'
import { useAsset } from './deckContext'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'

export interface AnnotateZoom {
  /** The point to push in on, in px of the image box. */
  x: number
  y: number
  /** 1 is no zoom. */
  scale: number
}

export interface AnnotateProps {
  /** Imported image, or a path relative to the deck folder. */
  src: string
  alt?: string
  /** Size of the image box in px; marks are placed in this box. */
  width?: number
  height?: number
  /** A camera push in on one point, before the marks. */
  zoom?: AnnotateZoom
  children?: ReactNode
  accent?: AccentColor
  /** The zoom and each mark wait for a build step. */
  steps?: boolean
}

export interface RingProps {
  /** Centre, in px of the image box. */
  x: number
  y: number
  /** Radius; `rx` and `ry` make an ellipse. */
  r?: number
  rx?: number
  ry?: number
}

export interface ScribbleProps {
  /** Where the note starts (its left edge, text middle), in px of the image box. */
  x: number
  y: number
  /** The point an arrow from the note points at. */
  arrowTo?: [number, number]
  /** Tilt in degrees. */
  rotate?: number
  /** Text size in px. */
  size?: number
  children?: ReactNode
}

type Pt = [number, number]

/**
 * A hand-drawn ring: an ellipse of four loose curves that runs past its start, like a marker
 * stroke. Unit shape, scaled to the radii.
 */
export function ringPath(cx: number, cy: number, rx: number, ry: number): string {
  const unit: Pt[] = [
    [-0.85, -0.9],
    [-0.05, -1.3], [1.1, -0.85], [1.08, 0.02],
    [1.06, 0.95], [0.1, 1.18], [-0.5, 0.92],
    [-1.12, 0.62], [-1.15, -0.62], [-0.35, -1.0],
    [-0.1, -1.1], [0.2, -1.12], [0.42, -1.02],
  ]
  const p = unit.map(([u, v]) => `${Math.round(cx + u * rx)},${Math.round(cy + v * ry)}`)
  return `M${p[0]} C${p[1]} ${p[2]} ${p[3]} C${p[4]} ${p[5]} ${p[6]} C${p[7]} ${p[8]} ${p[9]} C${p[10]} ${p[11]} ${p[12]}`
}

/** A slightly curved arrow from `a` to `b` with a two-stroke head. */
export function arrowPath([ax, ay]: Pt, [bx, by]: Pt): string {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const dx = bx - ax
  const dy = by - ay
  const cx = mx - dy * 0.18
  const cy = my + dx * 0.18
  const angle = Math.atan2(by - cy, bx - cx)
  const head = (turn: number): string => `${Math.round(bx - 34 * Math.cos(angle + turn))},${Math.round(by - 34 * Math.sin(angle + turn))}`
  return `M${ax},${ay} Q${Math.round(cx)},${Math.round(cy)} ${bx},${by} M${bx},${by} L${head(0.5)} M${bx},${by} L${head(-0.5)}`
}

type Mark = { kind: 'ring'; props: RingProps } | { kind: 'scribble'; props: ScribbleProps }

function marksOf(children: ReactNode): Mark[] {
  return Children.toArray(children)
    .filter((c): c is ReactElement => isValidElement(c))
    .flatMap((c): Mark[] => {
      const name = (c.type as { displayName?: string }).displayName
      if (name === 'Ring') return [{ kind: 'ring', props: c.props as RingProps }]
      if (name === 'Scribble') return [{ kind: 'scribble', props: c.props as ScribbleProps }]
      return []
    })
}

const textOf = (children: ReactNode) =>
  Children.toArray(children)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('')

function stageCount(props: Pick<AnnotateProps, 'zoom' | 'children'>): number {
  return (props.zoom ? 1 : 0) + marksOf(props.children).length
}

/** A screenshot with a camera push and marker annotations: rings, arrows and scribbled notes. */
function AnnotateComponent({ src, alt = '', width = 1400, height = 788, zoom, children, accent: accentProp, steps }: AnnotateProps) {
  const accent = useAccent(accentProp)
  const color = accentColors[accent]
  const url = useAsset(src)
  const live = useLive()
  const marks = marksOf(children)
  const total = stageCount({ zoom, children })
  const stage = useStages(total, steps, Array.from({ length: total }, (_, i) => 0.6 + i * 0.9))
  const zoomed = zoom ? stage >= 1 : false
  const markShown = (i: number) => stage >= (zoom ? 2 : 1) + i
  // Hidden until drawn: a zero-length path still paints its round end caps as dots.
  const draw = (on: boolean, duration: number) =>
    live
      ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }, transition: { duration, ease: [0.5, 0, 0.3, 1] as const, opacity: { duration: 0.05 } } }
      : { initial: false as const, animate: { pathLength: on ? 1 : 0, opacity: on ? 1 : 0 } }

  return (
    <motion.div variants={itemVariants} style={{ position: 'relative', width, height, flexShrink: 0, overflow: 'hidden', borderRadius: 18, boxShadow: '0 40px 120px rgba(0, 0, 0, 0.45)' }}>
      <motion.div
        initial={false}
        animate={{ scale: zoomed && zoom ? zoom.scale : 1 }}
        transition={live ? { duration: 1.1, ease: [0.2, 0.8, 0.2, 1] } : { duration: 0 }}
        style={{ position: 'absolute', inset: 0, transformOrigin: zoom ? `${zoom.x}px ${zoom.y}px` : 'center' }}
      >
        <img src={url} alt={alt} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
          {marks.map((mark, i) => {
            if (mark.kind === 'ring') {
              const { x, y, r = 100, rx = r, ry = r } = mark.props
              return <motion.path key={i} d={ringPath(x, y, rx, ry)} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" {...draw(markShown(i), 0.7)} />
            }
            const { x, y, arrowTo, size = 44 } = mark.props
            if (!arrowTo) return null
            // The arrow leaves from the end of the note that faces its target.
            const textWidth = textOf(mark.props.children).length * size * 0.56
            const start: Pt = arrowTo[0] < x + textWidth / 2 ? [Math.round(x - 16), Math.round(y)] : [Math.round(x + textWidth + 16), Math.round(y)]
            return <motion.path key={i} d={arrowPath(start, arrowTo)} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" {...draw(markShown(i), 0.5)} />
          })}
        </svg>
        {marks.map((mark, i) =>
          mark.kind === 'scribble' ? (
            <motion.div
              key={`note-${i}`}
              initial={live ? { opacity: 0, scale: 0.6, rotate: mark.props.rotate ?? -5 } : false}
              animate={{ opacity: markShown(i) ? 1 : 0, scale: markShown(i) ? 1 : 0.6, rotate: mark.props.rotate ?? -5 }}
              transition={{ ...springs.punch, delay: live && markShown(i) ? 0.35 : 0 }}
              style={{ position: 'absolute', left: mark.props.x, top: mark.props.y, translateY: '-50%', transformOrigin: 'left center', fontFamily: "'Permanent Marker', var(--font-display)", fontSize: mark.props.size ?? 44, lineHeight: 1, color, whiteSpace: 'nowrap' }}
            >
              {mark.props.children}
            </motion.div>
          ) : null,
        )}
      </motion.div>
    </motion.div>
  )
}

/** With `steps`, the zoom and every mark are build steps of the slide. */
AnnotateComponent.countSteps = (props: AnnotateProps): number => (props.steps ? stageCount(props) : 0)

/** Read by Annotate; renders nothing on its own. */
function RingComponent(_props: RingProps) {
  return null
}

/** Read by Annotate; renders nothing on its own. */
function ScribbleComponent(_props: ScribbleProps) {
  return null
}

const PREVIEW = `<Slide scheme="dark">
  <Annotate src="/hero.svg" width={1400} height={788} zoom={{ x: 700, y: 394, scale: 1.4 }}>
    <Ring x={700} y={394} r={160} />
    <Scribble x={180} y={600} arrowTo={[560, 470]}>look here</Scribble>
  </Annotate>
</Slide>`

export const Annotate = defineComponent<AnnotateProps>({
  Component: AnnotateComponent,
  registry: {
    id: 'annotate',
    name: 'Annotate',
    category: 'component',
    description: 'A screenshot with a camera push in on one point, then hand-drawn rings, arrows and scribbled notes, mark by mark.',
    props: [
      { name: 'src', type: 'string', description: 'Imported image or a path relative to the deck folder' },
      { name: 'alt', type: 'string', description: 'What the image shows' },
      { name: 'width', type: 'number', default: '1400', description: 'Width of the image box in px' },
      { name: 'height', type: 'number', default: '788', description: 'Height of the image box in px' },
      { name: 'zoom', type: '{ x: number; y: number; scale: number }', description: 'Push in on this point, before the marks' },
      { name: 'accent', type: '"yellow" | "red" | "teal" | "navy" | "gray"', description: 'Marker colour; defaults to the slide accent' },
      { name: 'steps', type: 'boolean', default: 'false', description: 'The zoom and each mark wait for a build step' },
    ],
    snippet: '<Annotate src="images/dashboard.png" zoom={{ x: 1015, y: 540, scale: 1.6 }}>\n  <Ring x={1015} y={525} r={110} />\n  <Scribble x={600} y={640} arrowTo={[924, 607]}>the cache miss</Scribble>\n</Annotate>',
    previewCode: PREVIEW,
    keywords: ['annotate', 'screenshot', 'circle', 'arrow', 'marker', 'zoom', 'callout', 'highlight', 'video', 'youtube'],
    useCases: ['Pointing at one detail in a screenshot or chart', 'Walking through a UI, mark by mark'],
  },
  toolbar: [
    { prop: 'src', type: 'image' },
    { prop: 'accent', type: 'select', options: ['yellow', 'red', 'teal', 'navy', 'gray'] },
    { prop: 'steps', type: 'boolean' },
  ],
})

export const Ring = defineComponent<RingProps>({
  Component: RingComponent,
  registry: {
    id: 'ring',
    name: 'Ring',
    category: 'component',
    parent: 'Annotate',
    description: 'A hand-drawn marker ring around a point of an Annotate image.',
    props: [
      { name: 'x', type: 'number', description: 'Centre x in px of the image box' },
      { name: 'y', type: 'number', description: 'Centre y in px of the image box' },
      { name: 'r', type: 'number', default: '100', description: 'Radius' },
      { name: 'rx', type: 'number', description: 'Horizontal radius, for an ellipse' },
      { name: 'ry', type: 'number', description: 'Vertical radius, for an ellipse' },
    ],
    snippet: '<Ring x={700} y={400} r={110} />',
    previewCode: PREVIEW,
    keywords: ['circle', 'ring', 'marker'],
  },
})

export const Scribble = defineComponent<ScribbleProps>({
  Component: ScribbleComponent,
  registry: {
    id: 'scribble',
    name: 'Scribble',
    category: 'component',
    parent: 'Annotate',
    description: 'A handwritten note on an Annotate image, optionally with an arrow to a point.',
    props: [
      { name: 'x', type: 'number', description: 'Left edge in px of the image box' },
      { name: 'y', type: 'number', description: 'Text middle in px of the image box' },
      { name: 'arrowTo', type: '[number, number]', description: 'Point the arrow points at' },
      { name: 'rotate', type: 'number', default: '-5', description: 'Tilt in degrees' },
      { name: 'size', type: 'number', default: '44', description: 'Text size in px' },
    ],
    snippet: '<Scribble x={300} y={600} arrowTo={[650, 450]}>look here</Scribble>',
    previewCode: PREVIEW,
    keywords: ['note', 'handwriting', 'arrow', 'marker'],
  },
})

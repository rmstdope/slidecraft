import { useId, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { resolveEffects, type CornerStyle, type GlowLevel, type Scheme, type ThemeEffects } from '@shared/themes.ts'
import { useTheme } from '../../themes/ThemeContext'
import { useSlideLayout } from './slideLayoutContext'
import { useInThumbnail } from './thumbnailContext'

/**
 * Shared drawing kit for the wired components (SignalFlow, TracedPoints, Gauge, TraceTimeline):
 * the theme's effects, wire colours mixed from the slide accent, a glow filter, node outlines,
 * path geometry and the travelling light. Everything follows the theme; nothing is hard-coded.
 */

export const useThemeEffects = (): Required<ThemeEffects> => resolveEffects(useTheme().spec)

const mix = (color: string, percent: number, other: string) => `color-mix(in srgb, ${color} ${percent}%, ${other})`

export interface WireColors {
  /** The accent itself: arcs, rings, lit nodes. */
  accent: string
  /** A drawn connection. */
  wire: string
  /** The travelling light on a wire. */
  pulse: string
  /** Bright centre of dots and lit nodes. */
  core: string
  /** Secondary lines, ticks, small labels. */
  steel: string
  /** Unlit tracks and future segments. */
  dim: string
  panelTop: string
  panelBottom: string
}

/** Colours for wires on this scheme, mixed from an accent colour (a CSS value). */
export function wireColors(accent: string, scheme: Scheme, glow: GlowLevel): WireColors {
  const dark = scheme === 'dark'
  const core = dark ? mix(accent, 35, '#ffffff') : accent
  return {
    accent,
    wire: dark || glow === 'none' ? accent : mix(accent, 70, 'var(--bg)'),
    pulse: dark ? core : glow === 'none' ? mix(accent, 55, '#000000') : accent,
    core,
    steel: mix(accent, 65, 'var(--muted)'),
    dim: mix(accent, dark ? 24 : 26, 'var(--bg)'),
    panelTop: dark ? mix(accent, 14, 'var(--bg)') : mix(accent, 3, '#ffffff'),
    panelBottom: dark ? mix(accent, 4, 'var(--bg)') : mix(accent, 9, 'var(--bg)'),
  }
}

/** Brushed-metal text (effects.titleFinish "metal"), mixed from the slide accent. */
export function metalTextStyle(scheme: Scheme): CSSProperties {
  const steel = mix('var(--accent)', 60, 'var(--text)')
  const stops =
    scheme === 'dark'
      ? [mix(steel, 8, '#ffffff'), mix(steel, 50, '#ffffff'), steel, mix(steel, 28, '#ffffff')]
      : [mix(steel, 55, '#000000'), mix(steel, 85, '#000000'), mix(steel, 30, '#000000'), steel]
  return {
    backgroundImage: `linear-gradient(180deg, ${stops[0]} 0%, ${stops[1]} 46%, ${stops[2]} 54%, ${stops[3]} 100%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  }
}

export interface WireKit {
  scheme: Scheme
  effects: Required<ThemeEffects>
  colors: WireColors
  /** `url(#…)` for the glow filter, or undefined when the theme has no glow. */
  filter: string | undefined
  filterId: string
  /** A unique id prefix for gradients inside this component's SVG. */
  uid: string
  /** False in thumbnails and with reduced motion: draw the final state, no travelling lights. */
  live: boolean
}

export function useWireKit(accent: string): WireKit {
  const { scheme } = useSlideLayout()
  const effects = useThemeEffects()
  const uid = `w${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const reduced = useReducedMotion()
  const inThumbnail = useInThumbnail()
  const filterId = `${uid}-glow`
  return {
    scheme,
    effects,
    colors: wireColors(accent, scheme, effects.glow),
    filter: effects.glow === 'none' ? undefined : `url(#${filterId})`,
    filterId,
    uid,
    live: !reduced && !inThumbnail,
  }
}

/** The glow as an SVG filter in user space, so horizontal lines (zero-height boxes) glow too. */
export function GlowFilter({ kit, width, height }: { kit: WireKit; width: number; height: number }) {
  const { glow } = kit.effects
  if (glow === 'none') return null
  const region = { x: -200, y: -200, width: width + 400, height: height + 400 }
  if (glow === 'strong' && kit.scheme === 'dark') {
    return (
      <filter id={kit.filterId} filterUnits="userSpaceOnUse" {...region}>
        <feGaussianBlur stdDeviation={7} result="near" />
        <feGaussianBlur stdDeviation={18} in="SourceGraphic" result="far" />
        <feMerge>
          <feMergeNode in="far" />
          <feMergeNode in="near" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    )
  }
  const slope = glow === 'strong' ? 0.45 : kit.scheme === 'dark' ? 0.7 : 0.4
  return (
    <filter id={kit.filterId} filterUnits="userSpaceOnUse" {...region}>
      <feGaussianBlur stdDeviation={glow === 'strong' ? 6 : 5} result="blur" />
      <feComponentTransfer in="blur" result="halo">
        <feFuncA type="linear" slope={slope} />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="halo" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  )
}

/** A node outline: square, rounded or with two cut corners (top left, bottom right). */
export function nodePath(corners: CornerStyle, x: number, y: number, w: number, h: number): string {
  if (corners === 'square') return `M${x},${y} H${x + w} V${y + h} H${x} Z`
  if (corners === 'chamfer') {
    const k = Math.min(28, w / 4, h / 4)
    return `M${x + k},${y} H${x + w} V${y + h - k} L${x + w - k},${y + h} H${x} V${y + k} Z`
  }
  const r = Math.min(18, w / 4, h / 4)
  return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`
}

export type Point = [number, number]

/** A path and its length in px, so a light can travel along it without measuring the DOM. */
export interface Wire {
  d: string
  length: number
}

const dist = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1])

export function polyline(points: Point[]): Wire {
  let length = 0
  for (let i = 1; i < points.length; i++) length += dist(points[i - 1], points[i])
  return { d: points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' '), length }
}

export function cubic(p0: Point, c1: Point, c2: Point, p1: Point): Wire {
  let length = 0
  let prev = p0
  for (let i = 1; i <= 48; i++) {
    const t = i / 48
    const u = 1 - t
    const point: Point = [
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ]
    length += dist(prev, point)
    prev = point
  }
  return { d: `M${p0[0]},${p0[1]} C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p1[0]},${p1[1]}`, length }
}

export type LineShape = 'curved' | 'angled'
export const LINE_SHAPES: readonly LineShape[] = ['curved', 'angled']

/**
 * A connector leaving `from` to the right and arriving at `to` from the left: an S-curve, or a
 * circuit trace with 45° corners. Equal heights give a straight line either way.
 */
export function connector(from: Point, to: Point, shape: LineShape): Wire {
  const [x0, y0] = from
  const [x1, y1] = to
  if (Math.abs(y1 - y0) < 0.5) return polyline([from, to])
  const dx = x1 - x0
  if (shape === 'curved') return cubic(from, [x0 + dx * 0.45, y0], [x1 - dx * 0.5, y1], to)
  const sign = Math.sign(y1 - y0)
  const k = Math.min(40, Math.abs(y1 - y0) / 2, dx / 6)
  const xa = x0 + Math.min(84, dx * 0.3)
  return polyline([from, [xa, y0], [xa + k, y0 + sign * k], [xa + k, y1 - sign * k], [xa + 2 * k, y1], to])
}

/** Seconds for a light to cross a wire: about 300 px a second, within sensible bounds. */
export const travelTime = (length: number): number => Math.min(3.2, Math.max(0.9, length / 300))

interface LightProps {
  wire: Wire
  color: string
  filter?: string
  delay?: number
}

const lightDash = (length: number) => Math.min(60, Math.max(18, length * 0.1))

/** A light that runs along a wire for as long as the slide is shown: work flowing. */
export function Pulse({ wire, color, filter, delay = 0 }: LightProps) {
  const dash = lightDash(wire.length)
  return (
    <motion.path
      d={wire.d}
      fill="none"
      stroke={color}
      strokeWidth={7}
      strokeLinecap="round"
      filter={filter}
      style={{ strokeDasharray: `${dash} ${wire.length + dash}` }}
      initial={{ strokeDashoffset: dash, opacity: 0 }}
      animate={{ strokeDashoffset: -wire.length, opacity: 1 }}
      transition={{ strokeDashoffset: { duration: travelTime(wire.length), ease: 'linear', repeat: Infinity, delay }, opacity: { duration: 0.01, delay } }}
    />
  )
}

/** A light that runs along a wire once, as the thing at its end arrives. */
export function Spark({ wire, color, filter, delay = 0 }: LightProps) {
  const dash = lightDash(wire.length)
  return (
    <motion.path
      d={wire.d}
      fill="none"
      stroke={color}
      strokeWidth={7}
      strokeLinecap="round"
      filter={filter}
      style={{ strokeDasharray: `${dash} ${wire.length + dash}` }}
      initial={{ strokeDashoffset: dash, opacity: 1 }}
      animate={{ strokeDashoffset: -wire.length + dash, opacity: [1, 1, 0] }}
      transition={{ duration: 0.7, ease: 'linear', delay, opacity: { duration: 0.7, times: [0, 0.85, 1], delay } }}
    />
  )
}

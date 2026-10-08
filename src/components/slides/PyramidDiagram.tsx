import { motion } from 'motion/react'
import { accentColors, isAccent, onAccent, type AccentColor } from './accents'
import { defineComponent } from './defineComponent'
import { useAccent } from './slideLayoutContext'
import { captionStyle, fadeRise } from './styles'

export interface PyramidDiagramProps {
  /** Top to bottom. */
  layers: { title: string; sub?: string; meta?: string; accent?: AccentColor }[]
  pointed?: boolean
  inverted?: boolean
  caption?: string
  /** Width of the widest band. */
  width?: number
  className?: string
}

const BAND_H = 118
const BAND_GAP = 12
const GUTTER = 360
const NARROW_CAP = 0.34

/** Width of the pyramid at a depth from 0 (top) to n (bottom). Inverting flips which end is narrow. */
export function pyramidWidthAt(depth: number, count: number, width: number, pointed: boolean, inverted: boolean): number {
  const narrow = pointed ? 0 : NARROW_CAP * width
  const t = inverted ? 1 - depth / count : depth / count
  return narrow + (width - narrow) * t
}

/** Shrink a label until its estimated width fits. */
export function fitFont(text: string, base: number, available: number, factor = 0.55, floor = 15): number {
  const estimate = factor * base * text.length
  return estimate <= available ? base : Math.max(floor, available / (factor * text.length))
}

function PyramidDiagramComponent({ layers, pointed = false, inverted = false, caption, width = 1180, className }: PyramidDiagramProps) {
  const slideAccent = useAccent()
  const n = layers.length
  const totalH = n * BAND_H + (n - 1) * BAND_GAP
  const cx = width / 2
  return (
    <motion.div className={className} {...fadeRise} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <svg width={width + GUTTER} height={totalH} style={{ overflow: 'visible' }} role="img" aria-label={layers.map((l) => l.title).join(', ')}>
        {layers.map((layer, i) => {
          const accent = isAccent(layer.accent) ? layer.accent : slideAccent
          const top = pyramidWidthAt(i, n, width, pointed, inverted)
          const bottom = pyramidWidthAt(i + 1, n, width, pointed, inverted)
          const y = i * (BAND_H + BAND_GAP)
          const mid = y + BAND_H / 2
          const midW = (top + bottom) / 2
          const ink = onAccent(accent)
          return (
            <g key={i}>
              <polygon points={`${cx - top / 2},${y} ${cx + top / 2},${y} ${cx + bottom / 2},${y + BAND_H} ${cx - bottom / 2},${y + BAND_H}`} fill={accentColors[accent]} />
              <text x={cx} y={layer.sub ? mid - 6 : mid + 11} textAnchor="middle" fontSize={fitFont(layer.title, 32, midW - 40)} fontWeight={700} fill={ink} fontFamily="var(--font-body)">{layer.title}</text>
              {layer.sub && <text x={cx} y={mid + 30} textAnchor="middle" fontSize={Math.min(23, fitFont(layer.sub, 23, midW - 40))} opacity={0.78} fill={ink} fontFamily="var(--font-body)">{layer.sub}</text>}
              {layer.meta && <text x={width + 40} y={mid} dy="0.35em" fontSize={24} fill="var(--muted)" fontFamily="var(--font-body)">{layer.meta}</text>}
            </g>
          )
        })}
      </svg>
      {caption && <div style={{ ...captionStyle, width }}>{caption}</div>}
    </motion.div>
  )
}

export const PyramidDiagram = defineComponent<PyramidDiagramProps>({
  Component: PyramidDiagramComponent,
  registry: {
    id: 'pyramid-diagram',
    name: 'PyramidDiagram',
    category: 'component',
    description: 'Stacked tiers that taper — a hierarchy, a maturity model, or a funnel.',
    props: [
      { name: 'layers', type: 'Array<{ title: string; sub?: string; meta?: string; accent?: string }>', description: 'Tiers from top to bottom' },
      { name: 'pointed', type: 'boolean', default: 'false', description: 'Taper to a point' },
      { name: 'inverted', type: 'boolean', default: 'false', description: 'Narrow end at the bottom (a funnel)' },
      { name: 'caption', type: 'string', description: 'Italic caption below' },
      { name: 'width', type: 'number', default: '1180', description: 'Widest band in px' },
    ],
    snippet: '<PyramidDiagram\n  layers={[\n    { title: "End to end", meta: "Few" },\n    { title: "Integration", meta: "Some" },\n    { title: "Unit", meta: "Many" },\n  ]}\n/>',
    previewCode: '<Slide theme="dark">\n  <PyramidDiagram width={900} layers={[{ title: "End to end", meta: "Few" }, { title: "Integration", meta: "Some" }, { title: "Unit", meta: "Many" }]} />\n</Slide>',
    keywords: ['pyramid', 'tiers', 'hierarchy', 'funnel', 'maturity', 'layers', 'test pyramid'],
    useCases: ['A test pyramid', 'A sales funnel', 'A maturity model'],
  },
  toolbar: [
    { prop: 'pointed', type: 'boolean' },
    { prop: 'inverted', type: 'boolean' },
  ],
})

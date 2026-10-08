import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'motion/react'
import { colorValue, type AccentColor } from './accents'
import {
  formatter,
  linearScale,
  nearest,
  niceStep,
  roundDown,
  roundUp,
  thresholdCandidates,
  ticks,
  type ChartFormat,
} from './chartMath'
import { defineComponent } from './defineComponent'
import { fadeRise } from './styles'
import { useInThumbnail } from './thumbnailContext'

type Row = Record<string, unknown>

export interface ChartAxis {
  key: string
  label: string
  /** Tab label; defaults to label. */
  tab?: string
  format?: ChartFormat
  domain?: [number | null, number | null]
  pad?: number
}

export interface ChartSeries {
  id: string
  label?: string
  color?: AccentColor | string
}

export interface ScatterChartProps {
  data: Row[]
  x: ChartAxis | ChartAxis[]
  y: ChartAxis
  seriesKey?: string
  series?: ChartSeries[]
  pointLabel?: string
  start?: string
  fixed?: boolean
  keyboard?: boolean
  detail?: boolean
  legend?: boolean
  exclude?: string[] | ((row: Row) => boolean)
  lines?: boolean
  threshold?: boolean | number
  thresholdLabel?: string
  pointRadius?: number
  width?: number
  height?: number
}

const PALETTE: AccentColor[] = ['teal', 'red', 'navy', 'yellow', 'gray']
const MARK_SPRING = { type: 'spring', stiffness: 120, damping: 20, mass: 1 } as const
const MARGIN = { top: 40, right: 40, bottom: 80, left: 100 }

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined)

interface Point {
  key: string
  series: string
  label?: string
  x: number
  y: number
}

function ScatterChartComponent({
  data,
  x,
  y,
  seriesKey = 'series',
  series,
  pointLabel,
  start,
  fixed = false,
  keyboard = true,
  detail = false,
  legend = false,
  exclude,
  lines = true,
  threshold = false,
  thresholdLabel = 'at or below',
  pointRadius = 9,
  width = 1500,
  height = 600,
}: ScatterChartProps) {
  const axes = Array.isArray(x) ? x : [x]
  const [axisIndex, setAxisIndex] = useState(() => Math.max(0, axes.findIndex((a) => a.key === start)))
  const axis = axes[Math.min(axisIndex, axes.length - 1)]
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [cut, setCut] = useState<number | null>(typeof threshold === 'number' ? threshold : null)
  const inThumbnail = useInThumbnail()
  const svgRef = useRef<SVGSVGElement>(null)

  const seriesList = useMemo<ChartSeries[]>(() => {
    const ids = series?.map((s) => s.id) ?? [...new Set(data.map((row) => String(row[seriesKey] ?? '')))]
    return ids.map((id, i) => ({ id, label: series?.find((s) => s.id === id)?.label ?? id, color: series?.find((s) => s.id === id)?.color ?? PALETTE[i % PALETTE.length] }))
  }, [data, series, seriesKey])
  const visible = seriesList.filter((s) => !hidden.has(s.id))

  const chart = useMemo(() => {
    const drop = typeof exclude === 'function' ? exclude : (() => {
      const set = new Set(exclude ?? [])
      return (row: Row) => set.has(`${row[seriesKey]}:${pointLabel ? row[pointLabel] : ''}`)
    })()
    const bySeries = visible.map((s) => {
      const points: Point[] = []
      data.forEach((row, index) => {
        if (String(row[seriesKey] ?? '') !== s.id || drop(row)) return
        const px = num(row[axis.key])
        const py = num(row[y.key])
        if (px === undefined || py === undefined) return
        const label = pointLabel ? String(row[pointLabel] ?? '') : undefined
        points.push({ key: `${s.id}-${label ?? index}`, series: s.id, label, x: px, y: py })
      })
      points.sort((a, b) => a.x - b.x)
      return { series: s, points }
    })
    const shown = bySeries.flatMap((s) => s.points)
    const xMax = shown.length ? Math.max(...shown.map((p) => p.x)) : 1
    const yLo = shown.length ? Math.min(...shown.map((p) => p.y)) : 0
    const yHi = shown.length ? Math.max(...shown.map((p) => p.y)) : 1
    const xDomain: [number, number] = [axis.domain?.[0] ?? 0, axis.domain?.[1] ?? xMax * (axis.pad ?? 1.15)]
    const yStep = niceStep(Math.max(yHi - yLo, 1))
    const yDomain: [number, number] = [
      y.domain?.[0] ?? Math.max(0, roundDown(yLo - 0.8 * yStep, yStep)),
      y.domain?.[1] ?? roundUp(yHi * (y.pad ?? 1.08), yStep),
    ]
    return { bySeries, shown, xDomain, yDomain, yStep, xStep: niceStep(xDomain[1] - xDomain[0]) }
  }, [data, visible.map((s) => s.id).join('|'), axis, y, seriesKey, pointLabel, exclude])

  const plotW = width - MARGIN.left - MARGIN.right
  const plotH = height - MARGIN.top - MARGIN.bottom
  const sx = linearScale(chart.xDomain, [0, plotW])
  const sy = linearScale(chart.yDomain, [plotH, 0])
  const fx = formatter(axis.format)
  const fy = formatter(y.format)

  // Threshold: snap the cut to the nearest of 121 candidates; count the points at or below it.
  const candidates = useMemo(() => thresholdCandidates(chart.xDomain), [chart.xDomain[0], chart.xDomain[1]])
  const snapped = nearest(candidates, cut ?? (chart.xDomain[0] + chart.xDomain[1]) / 2)
  const count = chart.shown.filter((p) => p.x <= snapped).length

  const showTabs = !fixed && axes.length > 1
  useEffect(() => {
    if (!showTabs || !keyboard || inThumbnail) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)) return
      if (event.key === 'n' || event.key === 'N') setAxisIndex((i) => (i + 1) % axes.length)
      else if (/^[1-9]$/.test(event.key) && Number(event.key) <= axes.length) setAxisIndex(Number(event.key) - 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showTabs, keyboard, inThumbnail, axes.length])

  const dragTo = (clientX: number) => {
    const svg = svgRef.current
    const ctm = svg?.getScreenCTM()
    if (!svg || !ctm) return
    const local = new DOMPoint(clientX, 0).matrixTransform(ctm.inverse())
    const value = chart.xDomain[0] + ((local.x - MARGIN.left) / plotW) * (chart.xDomain[1] - chart.xDomain[0])
    setCut(Math.min(chart.xDomain[1], Math.max(chart.xDomain[0], value)))
  }
  const onHandleDown = (event: ReactPointerEvent<SVGGElement>) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragTo(event.clientX)
  }

  const colorOf = (id: string) => colorValue(seriesList.find((s) => s.id === id)?.color ?? 'gray')
  const yTicks = ticks(chart.yDomain[0], chart.yDomain[1], chart.yStep)
  const xTicks = ticks(chart.xDomain[0], chart.xDomain[1], chart.xStep)

  return (
    <motion.div {...fadeRise} style={{ width, display: 'flex', flexDirection: 'column', gap: 14, color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 22 }}>
      {showTabs && (
        <div role="tablist" data-no-advance style={{ display: 'flex', gap: 12 }}>
          {axes.map((a, i) => (
            <button
              key={a.key}
              type="button"
              role="tab"
              aria-selected={i === axisIndex}
              onClick={(e) => {
                e.stopPropagation()
                setAxisIndex(i)
              }}
              style={{
                padding: '12px 22px',
                borderRadius: 999,
                border: '2px solid var(--muted)',
                background: i === axisIndex ? 'var(--text)' : 'transparent',
                color: i === axisIndex ? 'var(--bg)' : 'var(--muted)',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              {a.tab ?? a.label}
            </button>
          ))}
        </div>
      )}
      <svg ref={svgRef} width={width} height={height} role="img" aria-label={`${y.label} against ${axis.label}`} style={{ overflow: 'visible' }}>
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {yTicks.map((t) => (
            <g key={`y${t}`}>
              <line x1={0} x2={plotW} y1={sy(t)} y2={sy(t)} stroke="var(--muted)" strokeOpacity={0.25} />
              <text x={-14} y={sy(t)} dy="0.35em" textAnchor="end" fontSize={20} fill="var(--text)">{fy(t)}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <g key={`x${t}`}>
              <line x1={sx(t)} x2={sx(t)} y1={0} y2={plotH} stroke="var(--muted)" strokeOpacity={0.25} />
              <text x={sx(t)} y={plotH + 30} textAnchor="middle" fontSize={20} fill="var(--text)">{fx(t)}</text>
            </g>
          ))}
          <text x={plotW / 2} y={plotH + 68} textAnchor="middle" fontSize={22} fill="var(--text)">{axis.label}</text>
          <text transform={`translate(${-72}, ${plotH / 2}) rotate(-90)`} textAnchor="middle" fontSize={22} fill="var(--text)">{y.label}</text>

          {lines &&
            chart.bySeries.map(({ series: s, points }) =>
              points.length >= 2 ? (
                <motion.path
                  key={`line-${s.id}`}
                  initial={false}
                  animate={{ d: `M${points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' L')}` }}
                  transition={MARK_SPRING}
                  fill="none"
                  stroke={colorOf(s.id)}
                  strokeWidth={3}
                  strokeOpacity={0.55}
                />
              ) : null,
            )}

          {chart.bySeries.flatMap(({ points }) =>
            points.map((p) => (
              <motion.circle key={p.key} initial={false} animate={{ cx: sx(p.x), cy: sy(p.y) }} transition={MARK_SPRING} r={pointRadius} fill={colorOf(p.series)} stroke="var(--bg)" strokeWidth={2} />
            )),
          )}

          {detail &&
            chart.bySeries.flatMap(({ series: s, points }) => {
              const leftmost = points[0]
              const highest = points.reduce<Point | undefined>((best, p) => (!best || p.y > best.y ? p : best), undefined)
              return [
                ...points
                  .filter((p) => p.label)
                  .map((p) => (
                    <motion.text
                      key={`label-${p.key}`}
                      initial={false}
                      animate={{ x: sx(p.x) + (p === leftmost ? 14 : 0), y: sy(p.y) + (p === leftmost ? 7 : -22) }}
                      transition={MARK_SPRING}
                      textAnchor={p === leftmost ? 'start' : 'middle'}
                      fontSize={19}
                      fill="var(--muted)"
                    >
                      {p.label}
                    </motion.text>
                  )),
                highest ? (
                  <motion.text key={`series-${s.id}`} initial={false} animate={{ x: sx(highest.x) + 20, y: sy(highest.y) - 14 }} transition={MARK_SPRING} fontSize={30} fontWeight={700} fill={colorOf(s.id)}>
                    {s.label}
                  </motion.text>
                ) : null,
              ]
            })}

          {threshold !== false && (
            <g
              data-no-advance
              role="slider"
              tabIndex={0}
              aria-label={`${axis.label} threshold`}
              aria-valuemin={chart.xDomain[0]}
              aria-valuemax={chart.xDomain[1]}
              aria-valuenow={snapped}
              aria-valuetext={fx(snapped)}
              style={{ cursor: 'ew-resize', outline: 'none' }}
              onPointerDown={onHandleDown}
              onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && dragTo(e.clientX)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                const i = candidates.indexOf(snapped)
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  e.stopPropagation()
                  setCut(candidates[Math.min(candidates.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))])
                }
              }}
            >
              <line x1={sx(snapped)} x2={sx(snapped)} y1={0} y2={plotH} stroke="var(--text)" strokeWidth={2} strokeDasharray="8 8" />
              <rect x={sx(snapped) - 24} y={-24} width={48} height={plotH + 24} fill="transparent" />
              <circle cx={sx(snapped)} cy={-10} r={12} fill="var(--text)" />
            </g>
          )}
        </g>
      </svg>
      {threshold !== false && (
        <div style={{ fontSize: 26 }} aria-live="polite">
          <strong>{count}</strong> of {chart.shown.length} points {thresholdLabel} {fx(snapped)}
        </div>
      )}
      {legend && (
        <div data-no-advance style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {seriesList.map((s) => {
            const off = hidden.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={!off}
                onClick={(e) => {
                  e.stopPropagation()
                  setHidden((h) => {
                    const next = new Set(h)
                    if (next.has(s.id)) next.delete(s.id)
                    else next.add(s.id)
                    return next
                  })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 0, color: 'var(--text)', font: 'inherit', fontSize: 24, opacity: off ? 0.6 : 1, cursor: 'pointer' }}
              >
                <span aria-hidden style={{ width: 20, height: 20, borderRadius: 4, background: off ? 'transparent' : colorValue(s.color ?? 'gray'), border: off ? '2px solid var(--muted)' : undefined }} />
                {s.label}
              </button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

export const ScatterChart = defineComponent<ScatterChartProps>({
  Component: ScatterChartComponent,
  registry: {
    id: 'scatter-chart',
    name: 'ScatterChart',
    category: 'component',
    description: 'Connected scatter plot, one line per series, with tabs that swap the x axis and animate the points.',
    props: [
      { name: 'data', type: 'Array<Record<string, unknown>>', description: 'One row per point' },
      { name: 'x', type: 'ChartAxis | ChartAxis[]', description: 'One axis, or several to tab through: { key, label, tab?, format?, domain?, pad? }' },
      { name: 'y', type: 'ChartAxis', description: 'Vertical axis' },
      { name: 'seriesKey', type: 'string', default: '"series"', description: 'Row field that groups points' },
      { name: 'series', type: 'Array<{ id: string; label?: string; color?: string }>', description: 'Order, labels and colours' },
      { name: 'pointLabel', type: 'string', description: 'Row field written beside points when detail is on' },
      { name: 'start', type: 'string', description: 'Key of the initial x axis' },
      { name: 'fixed', type: 'boolean', default: 'false', description: 'Hide tabs, lock the x axis' },
      { name: 'keyboard', type: 'boolean', default: 'true', description: 'n cycles axes, digits pick one' },
      { name: 'detail', type: 'boolean', default: 'false', description: 'Label every point and line' },
      { name: 'legend', type: 'boolean', default: 'false', description: 'Clickable legend that hides a series' },
      { name: 'exclude', type: 'string[] | ((row) => boolean)', description: 'Drop points ("seriesId:pointLabel")' },
      { name: 'lines', type: 'boolean', default: 'true', description: 'Connect each series in x order' },
      { name: 'threshold', type: 'boolean | number', default: 'false', description: 'Draggable cut-off with a live count' },
      { name: 'thresholdLabel', type: 'string', default: '"at or below"', description: 'Words after the count' },
      { name: 'pointRadius', type: 'number', default: '9', description: 'Dot radius' },
      { name: 'width', type: 'number', default: '1500', description: 'Width in px' },
      { name: 'height', type: 'number', default: '600', description: 'Height in px' },
    ],
    snippet:
      '<ScatterChart\n  detail\n  pointLabel="run"\n  data={[\n    { series: "small", run: "a", cost: 2, tokens: 40, score: 61 },\n    { series: "small", run: "b", cost: 4, tokens: 90, score: 70 },\n    { series: "large", run: "a", cost: 9, tokens: 60, score: 78 },\n    { series: "large", run: "b", cost: 15, tokens: 120, score: 86 },\n  ]}\n  x={[{ key: "cost", label: "Cost", format: "${v}" }, { key: "tokens", label: "Tokens", format: "{v}k" }]}\n  y={{ key: "score", label: "Score", format: "{v}%" }}\n/>',
    previewCode:
      '<Slide theme="dark">\n  <ScatterChart width={1400} height={560} data={[{ series: "small", cost: 2, score: 61 }, { series: "small", cost: 4, score: 70 }, { series: "large", cost: 9, score: 78 }, { series: "large", cost: 15, score: 86 }]} x={{ key: "cost", label: "Cost", format: "${v}" }} y={{ key: "score", label: "Score", format: "{v}%" }} />\n</Slide>',
    keywords: ['chart', 'scatter', 'plot', 'line', 'benchmark', 'data', 'series', 'axis', 'metric'],
    useCases: ['Benchmark results across two metrics', 'A cut-off you drag live'],
  },
  toolbar: [
    { prop: 'detail', type: 'boolean' },
    { prop: 'legend', type: 'boolean' },
    { prop: 'fixed', type: 'boolean' },
    { prop: 'lines', type: 'boolean' },
    { prop: 'threshold', type: 'boolean' },
  ],
})

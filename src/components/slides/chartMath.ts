/** Number helpers for ScatterChart (Part 2 §5.6). Pure, so they are unit-tested. */

/** Integers as-is; otherwise two decimals with trailing zeros stripped. */
export function plainNumber(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)))
}

export type ChartFormat = string | ((v: number) => string)

/** A function, a "{v}" template, or plainNumber. */
export function formatter(format?: ChartFormat): (v: number) => string {
  if (typeof format === 'function') return format
  if (typeof format === 'string') return (v) => format.replaceAll('{v}', plainNumber(v))
  return plainNumber
}

/** A step that gives 5–10 ticks over the span: the first of 1, 2, 5, 10 × magnitude ≥ span / 6. */
export function niceStep(span: number): number {
  const raw = span / 6
  if (!(raw > 0)) return 1
  const mag = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
}

export const roundDown = (v: number, step: number): number => Math.floor(v / step) * step
export const roundUp = (v: number, step: number): number => Math.ceil(v / step) * step

/** Tick values from the first multiple of step at or above lo, up to hi. */
export function ticks(lo: number, hi: number, step: number): number[] {
  const out: number[] = []
  for (let v = roundUp(lo, step); v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)))
  return out
}

export const linearScale = (domain: [number, number], range: [number, number]) => (v: number): number => {
  const [d0, d1] = domain
  const [r0, r1] = range
  return d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}

export const THRESHOLD_CANDIDATES = 121

/** 121 evenly spaced cut positions over the domain: reads as a free drag but stops the count flickering. */
export function thresholdCandidates([lo, hi]: [number, number]): number[] {
  return Array.from({ length: THRESHOLD_CANDIDATES }, (_, i) => lo + ((hi - lo) * i) / (THRESHOLD_CANDIDATES - 1))
}

export function nearest(values: number[], target: number): number {
  return values.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), values[0])
}

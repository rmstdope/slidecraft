import { DESIGN_HEIGHT, DESIGN_WIDTH, type Annotation, type Point } from './types'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** How a 1920×1080 slide sits in a box: uniform scale, centred (letterboxed). */
export function slideFit(box: Pick<Box, 'width' | 'height'>): { scale: number; offsetX: number; offsetY: number } {
  const scale = Math.min(box.width / DESIGN_WIDTH, box.height / DESIGN_HEIGHT)
  return { scale, offsetX: (box.width - DESIGN_WIDTH * scale) / 2, offsetY: (box.height - DESIGN_HEIGHT * scale) / 2 }
}

/** Client point → slide coordinates, unclamped (drawing keeps strokes that leave the slide). */
export function screenToSlide(clientX: number, clientY: number, box: Box): Point {
  const { scale, offsetX, offsetY } = slideFit(box)
  return { x: (clientX - box.left - offsetX) / scale, y: (clientY - box.top - offsetY) / scale }
}

/** Client point → slide coordinates, or null in the letterbox bands (Part 5 §B.4). */
export function clientPointToSlide(clientX: number, clientY: number, box: Box): Point | null {
  const p = screenToSlide(clientX, clientY, box)
  return p.x < 0 || p.y < 0 || p.x > DESIGN_WIDTH || p.y > DESIGN_HEIGHT ? null : p
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const r = (n: number) => Math.round(n * 10) / 10

/** A smoothed SVG path through the points: quadratic segments through the midpoints. */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return ''
  const [first] = points
  let d = `M ${r(first.x)} ${r(first.y)}`
  for (let i = 1; i < points.length - 1; i++) {
    const m = mid(points[i], points[i + 1])
    d += ` Q ${r(points[i].x)} ${r(points[i].y)} ${r(m.x)} ${r(m.y)}`
  }
  const last = points[points.length - 1]
  if (points.length > 1) d += ` L ${r(last.x)} ${r(last.y)}`
  return d
}

export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export const textFontSize = (strokeWidth: number) => strokeWidth * 6

/** Whether the eraser at `p` touches the annotation. */
export function hitTest(a: Annotation, p: Point, threshold: number): boolean {
  const near = (from: Point, to: Point) => distanceToSegment(p, from, to) <= threshold + a.strokeWidth / 2
  switch (a.type) {
    case 'path':
      return a.points.length === 1 ? near(a.points[0], a.points[0]) : a.points.some((pt, i) => i > 0 && near(a.points[i - 1], pt))
    case 'arrow':
      return near(a.start, a.end)
    case 'rectangle': {
      const tl = a.start
      const br = a.end
      const tr = { x: br.x, y: tl.y }
      const bl = { x: tl.x, y: br.y }
      return near(tl, tr) || near(tr, br) || near(br, bl) || near(bl, tl)
    }
    case 'text': {
      const size = textFontSize(a.strokeWidth)
      const width = a.text.length * size * 0.55
      return p.x >= a.start.x - threshold && p.x <= a.start.x + width + threshold && p.y >= a.start.y - size - threshold && p.y <= a.start.y + threshold
    }
  }
}

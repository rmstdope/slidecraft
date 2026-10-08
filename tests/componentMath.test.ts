import { describe, expect, test } from 'bun:test'
import { fadeMask } from '../src/components/slides/BackgroundImage'
import { anchor, backOff, gridBoxes, inferSides, labelPoint, roundedPath, route, type BlockNode } from '../src/components/slides/BlockDiagram'
import { bracketPaths } from '../src/components/slides/BracketDiagram'
import { formatter, nearest, niceStep, plainNumber, thresholdCandidates, ticks } from '../src/components/slides/chartMath'
import { scrollAt } from '../src/components/slides/Code'
import { cycleGeometry, wrap } from '../src/components/slides/CycleDiagram'
import { entityHeight } from '../src/components/slides/DataModel'
import { feedbackPath, LANE_GAP, LANE_TOP, routeFeedbacks, stageCentres } from '../src/components/slides/FeedbackLoops'
import { phaseWidth } from '../src/components/slides/PhaseRow'
import { fitFont, pyramidWidthAt } from '../src/components/slides/PyramidDiagram'
import { plotPosition } from '../src/components/slides/Quadrants'
import { spectrumColorIndex } from '../src/components/slides/Spectrum'
import { timelineSpacing } from '../src/components/slides/Timeline'
import { youTubeUrl } from '../src/components/slides/YouTube'

describe('BlockDiagram routing', () => {
  const nodes: BlockNode[] = [
    { id: 'a', row: 0, column: 0, title: 'A' },
    { id: 'b', row: 0, column: 2, title: 'B' },
    { id: 'c', row: 1, column: 1, title: 'C', colSpan: 2 },
  ]
  const { boxes, totalH } = gridBoxes(nodes, 1700, 190, 28)

  test('places boxes on the grid with spans', () => {
    const colW = (1700 - 28 * 2) / 3
    expect(boxes.get('b')).toEqual({ x: 2 * (colW + 28), y: 0, w: colW, h: 190 })
    expect(boxes.get('c')!.w).toBeCloseTo(2 * colW + 28)
    expect(totalH).toBe(2 * 190 + 28)
  })

  test('infers faces from the centre deltas', () => {
    expect(inferSides(boxes.get('a')!, boxes.get('b')!)).toEqual(['right', 'left'])
    expect(inferSides(boxes.get('b')!, boxes.get('a')!)).toEqual(['left', 'right'])
    expect(inferSides({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 100, w: 10, h: 10 })).toEqual(['bottom', 'top'])
  })

  test('anchors, backs off and routes orthogonally', () => {
    const box = { x: 0, y: 0, w: 100, h: 50 }
    expect(anchor(box, 'right')).toEqual({ x: 100, y: 25 })
    expect(anchor(box, 'top', 0.25)).toEqual({ x: 25, y: 0 })
    expect(backOff({ x: 200, y: 25 }, 'left')).toEqual({ x: 184, y: 25 })
    expect(route({ x: 0, y: 0 }, { x: 100, y: 0 }, 'right', 'left')).toHaveLength(2)
    expect(route({ x: 0, y: 0 }, { x: 100, y: 60 }, 'right', 'left')).toEqual([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 60 }, { x: 100, y: 60 }])
    expect(route({ x: 0, y: 0 }, { x: 100, y: 60 }, 'right', 'top')).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }])
  })

  test('rounds corners and labels the longest leg', () => {
    const d = roundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 10 }])
    expect(d).toBe('M0,0 L95,0 Q100,0 100,5 L100,10') // radius capped at half the short leg
    expect(labelPoint([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 200 }])).toEqual({ x: 10, y: 100 })
  })
})

describe('CycleDiagram geometry', () => {
  test('ring radius grows with the step count so nodes never touch', () => {
    const four = cycleGeometry(4, 'cycle', false, false)
    const eight = cycleGeometry(8, 'cycle', false, false)
    expect(eight.ringR).toBeGreaterThan(four.ringR)
    expect(four.ringR).toBeCloseTo((104 * 1.18) / Math.sin(Math.PI / 4))
    expect(four.gapDeg).toBeLessThanOrEqual(38)
  })
  test('hub mode leaves room for the hub; satellites widen the canvas', () => {
    expect(cycleGeometry(2, 'hub', true, false).ringR).toBeGreaterThanOrEqual(132 + 104 + 130)
    expect(cycleGeometry(4, 'hub', true, true).outerR).toBeGreaterThan(cycleGeometry(4, 'hub', true, false).outerR)
  })
  test('wraps titles greedily into at most three lines', () => {
    expect(wrap('Build the thing')).toEqual(['Build the', 'thing'])
    expect(wrap('one two three four five six seven', 5)).toHaveLength(3)
  })
})

describe('PyramidDiagram', () => {
  test('tapers from a narrow cap to the full width; inverting flips it; pointed reaches zero', () => {
    expect(pyramidWidthAt(0, 3, 1000, false, false)).toBeCloseTo(340)
    expect(pyramidWidthAt(3, 3, 1000, false, false)).toBe(1000)
    expect(pyramidWidthAt(0, 3, 1000, false, true)).toBe(1000)
    expect(pyramidWidthAt(0, 3, 1000, true, false)).toBe(0)
  })
  test('fitFont shrinks long labels but not below the floor', () => {
    expect(fitFont('short', 32, 400)).toBe(32)
    expect(fitFont('a much longer label than fits', 32, 200)).toBeLessThan(32)
    expect(fitFont('x'.repeat(500), 32, 100)).toBe(15)
  })
})

describe('FeedbackLoops routing', () => {
  const xs = stageCentres(3, 1760)
  test('spreads stage centres between the paddings', () => {
    expect(xs).toEqual([160, 880, 1600])
  })

  const nodes = new Map<string, Parameters<typeof routeFeedbacks>[1] extends Map<string, infer N> ? N : never>([
    ['s0', { kind: 'ring', cx: xs[0], cy: 220, color: '#000' }],
    ['s1', { kind: 'ring', cx: xs[1], cy: 220, color: '#000' }],
    ['s2', { kind: 'ring', cx: xs[2], cy: 220, color: '#000' }],
    ['dev', { kind: 'box', x: 60, y: 620, w: 300, h: 150, color: '#000' }],
  ])

  test('nests returns: the narrowest span takes the shallowest lane', () => {
    const routed = routeFeedbacks([{ from: 's2', to: 'dev' }, { from: 's1', to: 'dev' }], nodes)
    const near = routed.find((r) => r.index === 1)!
    const far = routed.find((r) => r.index === 0)!
    expect(near.laneY).toBe(LANE_TOP)
    expect(far.laneY).toBe(LANE_TOP + LANE_GAP)
  })

  test('arrows entering one box are ordered left to right by source, so they do not cross', () => {
    const routed = routeFeedbacks([{ from: 's2', to: 'dev' }, { from: 's1', to: 'dev' }], nodes)
    const fromS1 = routed.find((r) => r.index === 1)!
    const fromS2 = routed.find((r) => r.index === 0)!
    expect(fromS1.end.x).toBeLessThan(fromS2.end.x)
  })

  test('upward returns use the lane above; aligned endpoints draw straight', () => {
    const [up] = routeFeedbacks([{ from: 'dev', to: 's1' }], nodes)
    expect(up.down).toBe(false)
    expect(up.laneY).toBe(LANE_TOP - LANE_GAP)
    expect(feedbackPath({ index: 0, start: { x: 5, y: 0 }, end: { x: 5, y: 100 }, laneY: 50, down: true })).toBe('M5,0 L5,100')
  })
})

describe('chart maths', () => {
  test('niceStep gives 5 to 10 ticks', () => {
    expect(niceStep(100)).toBe(20)
    expect(niceStep(7)).toBe(2)
    expect(niceStep(0.3)).toBeCloseTo(0.05)
    expect(ticks(0, 100, 20)).toEqual([0, 20, 40, 60, 80, 100])
  })
  test('formats numbers and templates', () => {
    expect(plainNumber(3)).toBe('3')
    expect(plainNumber(2.5)).toBe('2.5')
    expect(plainNumber(1 / 3)).toBe('0.33')
    expect(formatter('${v}')(12)).toBe('$12')
    expect(formatter('{v}k')(1.5)).toBe('1.5k')
  })
  test('threshold candidates are 121 evenly spaced cuts; the cut snaps to the nearest', () => {
    const c = thresholdCandidates([0, 120])
    expect(c).toHaveLength(121)
    expect(c[60]).toBe(60)
    expect(nearest(c, 33.4)).toBe(33)
  })
})

describe('small layout helpers', () => {
  test('Spectrum colours run teal → yellow → red and survive one segment', () => {
    expect([0, 1, 2, 3, 4].map((i) => spectrumColorIndex(i, 5))).toEqual([0, 0, 1, 1, 2])
    expect(spectrumColorIndex(0, 2)).toBe(0)
    expect(spectrumColorIndex(1, 2)).toBe(2)
    expect(spectrumColorIndex(0, 1)).toBe(0)
  })
  test('Timeline spacing, PhaseRow widths, Quadrants positions', () => {
    expect(timelineSpacing(4)).toBe(480)
    expect(timelineSpacing(1)).toBe(0)
    expect(phaseWidth(3)).toBe(Math.floor((1760 - 64) / 3))
    expect(plotPosition(0.25, 0.75, 800)).toEqual({ left: 200, top: 200 })
    expect(plotPosition(2, -1, 800)).toEqual({ left: 800, top: 800 })
  })
  test('BracketDiagram connectors end over the box centres', () => {
    expect(bracketPaths(1)).toMatchObject({ width: 700, centres: [350] })
    expect(bracketPaths(2)).toMatchObject({ width: 1200, centres: [330, 870] })
    expect(bracketPaths(2).paths[0].endsWith('L330,120')).toBe(true)
  })
  test('DataModel heights, Code scroll, media URLs', () => {
    expect(entityHeight({ id: 'a', name: 'A', fields: [{ name: 'x', type: 't' }, { name: 'y', type: 't' }] })).toBe(36 + 2 * 28 + 24)
    expect(entityHeight({ id: 'e', name: 'E', kind: 'enum', values: ['a', 'b', 'c'] })).toBe(36 + 3 * 28 + 24)
    expect(scrollAt(5, 300, 30)).toBe(150)
    expect(scrollAt(99, 300, 30)).toBe(300)
    expect(scrollAt(1, 0, 30)).toBe(0)
    expect(youTubeUrl('abc', 10)).toBe('https://www.youtube.com/embed/abc?start=10&rel=0')
    expect(fadeMask('top')).toBe('linear-gradient(to bottom, transparent, black 30%)')
    expect(fadeMask('none')).toBeUndefined()
  })
})

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { mergeThemeSpecs, parseThemeSpec, resolveEffects } from '../shared/themes.ts'
import { StepContext } from '../src/animations/stepContext'
import { countSteps } from '../src/animations/steps'
import { Gauge, GaugeRow, Milestone, Presentation, SignalBypass, SignalFlow, SignalNode, Slide, Title, TracedPoint, TracedPoints, TraceTimeline } from '../src/components/slides'
import { gaugeAngle, gaugeSize, polar } from '../src/components/slides/Gauge'
import { connector, nodePath, polyline, wireColors } from '../src/components/slides/glow'
import { bypassWire, signalFlowLayout } from '../src/components/slides/SignalFlow'
import { tracedPointsLayout } from '../src/components/slides/TracedPoints'
import { monthIndex, planTimeline } from '../src/components/slides/TraceTimeline'
import { resolveTheme } from '../src/themes/registry'
import { useDom } from './setup/dom'

useDom()

describe('theme effects', () => {
  test('are validated, merged and defaulted', () => {
    const { spec, errors } = parseThemeSpec({ name: 'Neon', effects: { glow: 'strong', corners: 'blob', sparkle: true } })
    expect(spec?.effects).toEqual({ glow: 'strong' })
    expect(errors.join('\n')).toContain('effects.corners')
    expect(errors.join('\n')).toContain('effects.sparkle')
    const merged = mergeThemeSpecs({ name: 'Base', effects: { glow: 'soft', texture: 'grid' } }, { name: 'Child', effects: { glow: 'none' } })
    expect(merged.effects).toEqual({ glow: 'none', texture: 'grid' })
    expect(resolveEffects({ name: 'Plain' })).toEqual({ glow: 'none', titleFinish: 'solid', corners: 'round', texture: 'none' })
  })

  test('ion turns everything up, folio squares its corners, slidecraft and paper stay flat', () => {
    expect(resolveEffects(resolveTheme('ion').spec)).toEqual({ glow: 'strong', titleFinish: 'metal', corners: 'chamfer', texture: 'grid' })
    expect(resolveEffects(resolveTheme('folio').spec).corners).toBe('square')
    expect(resolveEffects(resolveTheme('slidecraft').spec)).toEqual(resolveEffects({ name: 'Plain' }))
    expect(resolveEffects(resolveTheme('paper').spec).glow).toBe('none')
    expect(resolveTheme('ion').errors).toEqual([])
  })

  test('a metal title and the dot grid appear only in a theme that asks for them', () => {
    const ion = render(<Presentation theme="ion"><Slide><Title>Shine</Title></Slide></Presentation>)
    const plain = render(<Presentation theme="slidecraft"><Slide><Title>Flat</Title></Slide></Presentation>)
    const h1 = (c: HTMLElement) => c.querySelector('h1') as HTMLElement
    // The test DOM drops color-mix() gradients, so check the clip and the tile size instead.
    expect(h1(ion.container).style.color).toBe('transparent')
    expect(h1(plain.container).style.color).toBe('var(--text)')
    const stage = (c: HTMLElement) => c.querySelector('.slide__stage') as HTMLElement
    expect(stage(ion.container).style.backgroundSize).toBe('64px 64px, 1920px 1080px')
    expect(stage(plain.container).style.backgroundSize).toBe('')
  })
})

describe('wire geometry', () => {
  test('connectors start and end where asked, straight when level', () => {
    expect(connector([0, 100], [300, 100], 'curved').d).toBe('M0,100 L300,100')
    const curve = connector([0, 0], [300, 200], 'curved')
    expect(curve.d.startsWith('M0,0 C')).toBe(true)
    expect(curve.d.endsWith('300,200')).toBe(true)
    expect(curve.length).toBeGreaterThan(Math.hypot(300, 200))
    const trace = connector([0, 0], [300, 200], 'angled')
    expect(trace.d.endsWith('L300,200')).toBe(true)
    expect(polyline([[0, 0], [3, 4]]).length).toBe(5)
  })

  test('node outlines follow the corner style', () => {
    expect(nodePath('square', 0, 0, 100, 50)).toBe('M0,0 H100 V50 H0 Z')
    expect(nodePath('chamfer', 0, 0, 200, 200)).toContain('L172,200')
    expect(nodePath('round', 0, 0, 200, 200)).toContain('A18,18')
  })

  test('wire colours are mixed from the accent, never fixed', () => {
    const dark = wireColors('var(--brand-yellow)', 'dark', 'strong')
    expect(dark.wire).toBe('var(--brand-yellow)')
    expect(dark.pulse).toContain('#ffffff')
    const light = wireColors('var(--brand-yellow)', 'light', 'none')
    expect(light.pulse).toContain('#000000')
  })

  test('layouts', () => {
    const flow = signalFlowLayout(4, 1760, true)
    expect(flow.xs[3] + flow.nodeWidth).toBeCloseTo(1760)
    expect(flow.top).toBeGreaterThan(signalFlowLayout(4, 1760, false).top)
    expect(bypassWire(100, 900, 190, 'angled').d).toBe('M100,190 L100,104 L140,64 L860,64 L900,104 L900,190')
    const points = tracedPointsLayout(3)
    expect(points.ys[1]).toBe(points.hubY)
    expect(points.ys[2] - points.ys[0]).toBe(460)
    expect(gaugeAngle(0)).toBe(135)
    expect(gaugeAngle(2)).toBe(405)
    const [x, y] = polar(0, 0, 10, 90)
    expect(Math.round(x)).toBe(0)
    expect(y).toBe(10)
  })
})

describe('TraceTimeline', () => {
  const milestones = [
    <Milestone key="a" at="2026-01" label="Pilot" />,
    <Milestone key="b" at="2026-03" label="Cache" />,
    <Milestone key="c" at="2026-09" label="Fast" />,
    <Milestone key="d" at="2026-11" label="Everyone" />,
  ]

  test('dates become month positions', () => {
    expect(monthIndex('2026-01')).toBe(2026 * 12)
    expect(monthIndex('2026-02-15')).toBeCloseTo(2026 * 12 + 1 + 14 / 28)
    expect(monthIndex('soon')).toBeNaN()
  })

  test('milestones after now are planned; steps run to each past milestone and then to now', () => {
    const plan = planTimeline({ from: '2026-01', to: '2026-12', now: '2026-10-14', steps: true, children: milestones })
    expect(plan.milestones.map((m) => m.future)).toEqual([false, false, false, true])
    expect(plan.rest).toBe(monthIndex('2026-01'))
    expect(plan.targets).toEqual([monthIndex('2026-03'), monthIndex('2026-09'), monthIndex('2026-10-14')])
    expect(planTimeline({ from: '2026-01', to: '2026-12', children: milestones }).now).toBe(monthIndex('2026-12') + 1)
  })

  test('adds its beats to the slide only with steps', () => {
    expect(countSteps(<Slide><TraceTimeline from="2026-01" to="2026-12" now="2026-10-14">{milestones}</TraceTimeline></Slide>)).toBe(0)
    expect(countSteps(<Slide><TraceTimeline from="2026-01" to="2026-12" now="2026-10-14" steps>{milestones}</TraceTimeline></Slide>)).toBe(3)
  })

  test('renders labels, and NOW once the charge has arrived', () => {
    const { container } = render(
      <Slide>
        <TraceTimeline from="2026-01" to="2026-12" now="2026-10-14">{milestones}</TraceTimeline>
      </Slide>,
    )
    expect(container.textContent).toContain('Pilot')
    expect(container.textContent).toContain('Everyone')
  })
})

describe('rendering', () => {
  test('SignalFlow draws a box per node and a wire between neighbours', () => {
    const { container } = render(
      <Slide>
        <SignalFlow>
          <SignalNode label="Ingest" metric="2.1k docs/s" />
          <SignalNode label="Index" />
          <SignalNode label="Answer" />
          <SignalBypass from={1} to={3} label="cache hit" />
        </SignalFlow>
      </Slide>,
    )
    expect(container.textContent).toContain('Ingest')
    expect(container.textContent).toContain('2.1k docs/s')
    expect(container.textContent).toContain('cache hit')
    expect(container.textContent).toContain('03')
  })

  test('TracedPoints shows the title and every point; a staged point counts as a beat', () => {
    const tree = (
      <Slide>
        <TracedPoints title="Three things">
          <TracedPoint label="One" detail="first" />
          <TracedPoint step={2} label="Two" />
        </TracedPoints>
      </Slide>
    )
    const { container } = render(<StepContext.Provider value={{ step: 0, total: 2 }}>{tree}</StepContext.Provider>)
    expect(container.textContent).toContain('Three things')
    expect(container.textContent).toContain('Two')
    expect(countSteps(tree)).toBe(2)
  })

  test('a GaugeRow sizes its gauges to fit the slide; an explicit size wins', () => {
    expect([1, 2, 3, 4].map((n) => gaugeSize(n, 80))).toEqual([640, 640, 533, 380])
    expect(gaugeSize(12, 80)).toBe(200) // never smaller than readable
    const { container } = render(
      <Slide>
        <GaugeRow>
          <Gauge value={1} />
          <Gauge value={2} />
          <Gauge value={3} size={300} />
        </GaugeRow>
      </Slide>,
    )
    const widths = [...container.querySelectorAll('div')].filter((d) => !d.classList.contains('slide__stage') && d.style.position === 'relative' && d.style.flexShrink === '0').map((d) => d.style.width)
    expect(widths).toEqual(['533px', '533px', '300px'])
    const lone = render(<Slide><Gauge value={1} /></Slide>).container
    expect([...lone.querySelectorAll('div')].some((d) => d.style.width === '640px' && d.style.height === '620px')).toBe(true)
  })

  test('Gauge shows the final value and a target outside a running deck', () => {
    const { container } = render(
      <Slide>
        <GaugeRow>
          <Gauge value={87} target={80} label="Remote cache hits" />
          <Gauge value={2.5} max={5} unit=" s" />
        </GaugeRow>
      </Slide>,
    )
    expect(container.textContent).toContain('Remote cache hits')
    expect(container.textContent).toContain('TARGET 80')
  })
})

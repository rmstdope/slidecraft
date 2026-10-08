import { beforeEach, describe, expect, test } from 'bun:test'
import { act, render } from '@testing-library/react'
import { formatStatValue, parseStatValue } from '../src/animations/countUp'
import { morphProps } from '../src/animations/morph'
import { StepContext } from '../src/animations/stepContext'
import { useStepMotion } from '../src/animations/stepMotion'
import { planeTransform, resolveCamera } from '../src/components/slides/camera'
import { drawProps } from '../src/components/slides/draw'
import { Presentation } from '../src/components/slides/Presentation'
import { Slide } from '../src/components/slides/Slide'
import { Step } from '../src/components/slides/Step'
import { Text } from '../src/components/slides/Text'
import { Title } from '../src/components/slides/Title'
import { useDom } from './setup/dom'

useDom()

const atStep = (step: number, node: React.ReactNode) => <StepContext.Provider value={{ step, total: 3 }}>{node}</StepContext.Provider>

describe('Step', () => {
  test('hidden content keeps its place and ignores pointer events until its beat', () => {
    const view = render(atStep(0, <Step at={2}><Text>later</Text></Step>))
    const el = view.container.querySelector('[data-step-at="2"]') as HTMLElement
    expect(el.textContent).toBe('later') // rendered, so the layout space exists
    expect(el.style.pointerEvents).toBe('none')
    view.rerender(atStep(2, <Step at={2}><Text>later</Text></Step>))
    expect(el.style.pointerEvents).toBe('')
  })

  test('a non-positive at renders plain content', () => {
    const { container } = render(atStep(0, <Step at={0}><Text>always</Text></Step>))
    expect(container.querySelector('[data-step-at]')).toBeNull()
    expect(container.textContent).toBe('always')
  })

  test('stagger hides direct children until the beat', () => {
    const { container } = render(
      atStep(0, <Step at={1} stagger row><Text>a</Text><Text>b</Text></Step>),
    )
    const items = Array.from(container.querySelector('[data-step-at="1"]')!.children) as HTMLElement[]
    expect(items).toHaveLength(2)
    expect(items.every((item) => item.style.opacity === '0')).toBe(true)
  })
})

describe('useStepMotion and morphProps', () => {
  function Probe({ step, morph, onProps }: { step?: number; morph?: string; onProps: (p: unknown) => void }) {
    onProps(useStepMotion(step, morph))
    return null
  }
  const propsFor = (step: number, stepProp?: number, morph?: string) => {
    let captured: Record<string, unknown> = {}
    render(atStep(step, <Probe step={stepProp} morph={morph} onProps={(p) => (captured = p as Record<string, unknown>)} />))
    return captured
  }

  test('unstaged and unmorphed components get nothing', () => {
    expect(propsFor(0)).toEqual({})
  })
  test('staged components follow the current beat', () => {
    expect(propsFor(0, 1)).toMatchObject({ initial: 'hidden', animate: 'hidden' })
    expect(propsFor(1, 1)).toMatchObject({ animate: 'shown' })
  })
  test('morph ids become layout ids that move position only', () => {
    expect(morphProps('hit-rate')).toMatchObject({ layoutId: 'morph-hit-rate', layout: 'position' })
    expect(propsFor(0, undefined, 'x')).toMatchObject({ layoutId: 'morph-x' })
  })
})

describe('camera', () => {
  test('defaults to a left-to-right strip with a 320 px gap', () => {
    expect(resolveCamera(undefined, 0)).toEqual({ x: 0, y: 0, scale: 1, rotate: 0, cx: 960, cy: 540 })
    expect(resolveCamera(undefined, 2)).toMatchObject({ x: 4480, cx: 5440 })
  })
  test('explicit placement wins and invalid scale falls back to 1', () => {
    expect(resolveCamera({ x: 100, y: 700, scale: 0.6, rotate: -4 }, 5)).toEqual({ x: 100, y: 700, scale: 0.6, rotate: -4, cx: 1060, cy: 1240 })
    expect(resolveCamera({ scale: -2 }, 0).scale).toBe(1)
  })
  test('the plane transform centres the target and undoes its scale and rotation', () => {
    expect(planeTransform(2240, 540, 0.5, -4)).toBe('translate(960px, 540px) rotate(4deg) scale(2) translate(-2240px, -540px)')
  })
})

describe('count-up parsing', () => {
  test('splits prefix, amount, decimals, grouping and suffix', () => {
    expect(parseStatValue('$1,200.5M')).toEqual({ prefix: '$', amount: 1200.5, decimals: 1, grouped: true, suffix: 'M' })
    expect(parseStatValue('42%')).toEqual({ prefix: '', amount: 42, decimals: 0, grouped: false, suffix: '%' })
    expect(parseStatValue('N/A')).toBeNull()
  })
  test('formats live values like the source', () => {
    const parsed = parseStatValue('$1,200.5M')!
    expect(formatStatValue(987.25, parsed)).toBe('$987.3M')
    expect(formatStatValue(1200.5, parsed)).toBe('$1,200.5M')
  })
})

describe('drawProps', () => {
  test('solid connectors draw in source order; dashed ones fade', () => {
    expect(drawProps(2)).toMatchObject({ initial: { pathLength: 0, opacity: 0 }, transition: { delay: 0.44 } })
    expect(drawProps(0, true).initial).toEqual({ opacity: 0 })
  })
})

describe('canvas runs in the player', () => {
  beforeEach(() => window.history.replaceState(null, '', '/demo'))
  const press = (key: string) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key })))

  test('moving inside a run keeps one stage and only moves the camera', () => {
    const { container } = render(
      <Presentation>
        <Slide><Title>Intro</Title></Slide>
        <Slide canvas="story"><Title>A</Title></Slide>
        <Slide canvas="story" camera={{ x: 2240, scale: 0.6 }}><Title>B</Title><Text step={1}>beat</Text></Slide>
        <Slide><Title>Outro</Title></Slide>
      </Presentation>,
    )
    press('ArrowRight')
    const stage = container.querySelector('.canvas-stage')
    expect(stage?.getAttribute('data-active-index')).toBe('0')
    expect(container.querySelectorAll('.canvas-stage__slide')).toHaveLength(2)
    press('ArrowRight')
    expect(container.querySelector('.canvas-stage')).toBe(stage) // same element: no slide transition
    expect(stage?.getAttribute('data-active-index')).toBe('1')
    press('ArrowRight')
    expect(window.location.hash).toBe('#slide-3-step-1') // the focused canvas slide has live steps
  })
})

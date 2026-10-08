import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { ALL_STEPS, countSteps, MAX_STEPS, readStep } from '../src/animations/steps'
import { analyzeDeck } from '../src/components/slides/analyzeDeck'
import {
  advance,
  formatSlideHash,
  goToSlide,
  INITIAL_NAV,
  nextSlide,
  parseSlideHash,
  prevSlide,
  retreat,
} from '../src/components/slides/navigation'
import { Notes } from '../src/components/slides/Notes'
import { Slide } from '../src/components/slides/Slide'
import { Text } from '../src/components/slides/Text'
import { Title } from '../src/components/slides/Title'

function Step({ children }: { at: number; children?: ReactNode }) {
  return <>{children}</>
}
Step.displayName = 'Step'
function Diagram(_: { nodes: { label: string; step?: number }[] }) {
  return null
}

describe('steps', () => {
  test('readStep accepts only finite positive numbers', () => {
    expect(readStep(2.7)).toBe(2)
    expect(readStep(0)).toBeUndefined()
    expect(readStep(-1)).toBeUndefined()
    expect(readStep('3')).toBeUndefined()
    expect(readStep(ALL_STEPS)).toBeUndefined()
  })

  test('countSteps reads step props, Step at, and step on plain objects in array props', () => {
    expect(countSteps(<Slide><Title>a</Title></Slide>)).toBe(0)
    expect(countSteps(<Slide><Text>a</Text><Step at={2}><Text>b</Text></Step></Slide>)).toBe(2)
    expect(countSteps(<Slide><Diagram nodes={[{ label: 'a' }, { label: 'b', step: 4 }]} /></Slide>)).toBe(4)
    // the highest beat, not the number of distinct beats
    expect(countSteps(<Slide><Text>x</Text><Step at={3}><Text>y</Text></Step></Slide>)).toBe(3)
  })

  test('countSteps is capped', () => {
    expect(countSteps(<Slide><Step at={9999}>x</Step></Slide>)).toBe(MAX_STEPS)
  })
})

describe('analyzeDeck', () => {
  const deck = analyzeDeck([
    <Slide key="1"><Title>One</Title><Notes>say one</Notes></Slide>,
    <Slide key="2" hidden><Title>Hidden</Title></Slide>,
    <Slide key="3" canvas="map"><Step at={2}>x</Step></Slide>,
    <Slide key="4" canvas="map"><Title>Four</Title></Slide>,
    <Slide key="5" canvas="other"><Title>Five</Title></Slide>,
  ])

  test('drops hidden slides and counts steps per slide', () => {
    expect(deck.slides).toHaveLength(4)
    expect(deck.stepCounts).toEqual([0, 2, 0, 0])
  })
  test('extracts notes from the Notes child', () => {
    expect(deck.notes[0]).toBe('say one')
    expect(deck.notes[1]).toBeUndefined()
  })
  test('groups consecutive slides on the same canvas into runs', () => {
    expect(deck.canvasRuns).toEqual([
      { canvas: undefined, indices: [0] },
      { canvas: 'map', indices: [1, 2] },
      { canvas: 'other', indices: [3] },
    ])
    expect(deck.runOfSlide).toEqual([0, 1, 1, 2])
  })
})

describe('navigation', () => {
  const steps = [0, 2, 1]

  test('advance walks beats before leaving the slide', () => {
    let s = goToSlide(INITIAL_NAV, 1, steps)
    expect(s).toEqual({ current: 1, step: 0, direction: 1 })
    s = advance(s, steps)
    s = advance(s, steps)
    expect(s).toMatchObject({ current: 1, step: 2 })
    s = advance(s, steps)
    expect(s).toEqual({ current: 2, step: 0, direction: 1 })
  })

  test('retreat unwinds beats and lands on the previous slide fully built', () => {
    let s = { current: 2, step: 0, direction: 1 }
    s = retreat(s, steps)
    expect(s).toEqual({ current: 1, step: 2, direction: -1 })
    s = retreat(s, steps)
    expect(s).toMatchObject({ current: 1, step: 1 })
  })

  test('nextSlide skips remaining beats; edges are no-ops', () => {
    expect(nextSlide({ current: 1, step: 1, direction: 1 }, steps)).toEqual({ current: 2, step: 0, direction: 1 })
    const last = { current: 2, step: 1, direction: 1 }
    expect(advance(last, steps)).toBe(last)
    expect(prevSlide(INITIAL_NAV)).toBe(INITIAL_NAV)
    expect(retreat(INITIAL_NAV, steps)).toBe(INITIAL_NAV)
  })

  test('goToSlide clamps and can land fully built', () => {
    expect(goToSlide(INITIAL_NAV, 99, steps)).toMatchObject({ current: 2, step: 0 })
    expect(goToSlide({ current: 2, step: 0, direction: 1 }, 1, steps, true)).toEqual({ current: 1, step: 2, direction: -1 })
  })

  test('hash round-trip and clamping', () => {
    expect(formatSlideHash(0, 0)).toBe('#slide-1')
    expect(formatSlideHash(1, 2)).toBe('#slide-2-step-2')
    expect(parseSlideHash('#slide-2-step-2', steps)).toEqual({ current: 1, step: 2 })
    expect(parseSlideHash('#slide-9-step-7', steps)).toEqual({ current: 2, step: 1 })
    expect(parseSlideHash('#slide-0', steps)).toEqual({ current: 0, step: 0 })
    expect(parseSlideHash('#intro', steps)).toBeNull()
  })
})

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { countSteps } from '../src/animations/steps'
import { Annotate, Chapter, LowerThird, NumberPunch, Punchline, Ring, Scribble, Slide } from '../src/components/slides'
import { arrowPath, ringPath } from '../src/components/slides/Annotate'
import { odometerStrings, percentChange } from '../src/components/slides/NumberPunch'
import { punchlineWords } from '../src/components/slides/Punchline'
import { ThumbnailContext } from '../src/components/slides/thumbnailContext'
import { useDom } from './setup/dom'

useDom()

describe('pure helpers', () => {
  test('Punchline keeps the highlighted phrase as one piece', () => {
    expect(punchlineWords('Builds got 41% faster', '41%')).toEqual([
      { text: 'Builds', marked: false },
      { text: 'got', marked: false },
      { text: '41%', marked: true },
      { text: 'faster', marked: false },
    ])
    expect(punchlineWords('Ship it every day', 'every DAY').map((p) => p.text)).toEqual(['Ship', 'it', 'every day'])
    expect(punchlineWords('No match here', 'zebra').every((p) => !p.marked)).toBe(true)
  })

  test('NumberPunch pads both numbers to one width and computes the change', () => {
    expect(odometerStrings(38, 9)).toEqual(['38', '09'])
    expect(odometerStrings(4.2, 12)).toEqual(['04.2', '12.0'])
    expect(percentChange(38, 9)).toBe('−76%')
    expect(percentChange(50, 56)).toBe('+12%')
    expect(percentChange(0, 5)).toBe('')
  })

  test('marks start where asked and end at their target', () => {
    expect(ringPath(500, 400, 100, 100).startsWith('M415,310 C')).toBe(true)
    const arrow = arrowPath([100, 100], [400, 300])
    expect(arrow.startsWith('M100,100 Q')).toBe(true)
    expect(arrow).toContain(' 400,300 M400,300 L')
  })
})

describe('steps', () => {
  test('each component adds beats only with steps', () => {
    const cases = [
      [<Punchline highlight="41%" sub="sub">Builds got 41% faster</Punchline>, <Punchline steps highlight="41%" sub="sub">Builds got 41% faster</Punchline>, 2],
      [<LowerThird name="A" role="B" quote="C" />, <LowerThird steps name="A" role="B" quote="C" />, 2],
      [<Chapter number={2} title="T" />, <Chapter steps number={2} title="T" />, 1],
      [<NumberPunch from={38} to={9} />, <NumberPunch steps from={38} to={9} />, 1],
      [
        <Annotate src="/a.png" zoom={{ x: 1, y: 1, scale: 2 }}><Ring x={1} y={1} /><Scribble x={1} y={1}>n</Scribble></Annotate>,
        <Annotate steps src="/a.png" zoom={{ x: 1, y: 1, scale: 2 }}><Ring x={1} y={1} /><Scribble x={1} y={1}>n</Scribble></Annotate>,
        3,
      ],
    ] as const
    for (const [plain, stepped, beats] of cases) {
      expect(countSteps(<Slide>{plain}</Slide>)).toBe(0)
      expect(countSteps(<Slide>{stepped}</Slide>)).toBe(beats)
    }
  })
})

describe('rendering the end state outside a running deck', () => {
  test('Punchline, LowerThird and Chapter show all their text', () => {
    const { container } = render(
      <Slide>
        <Punchline highlight="41%" sub="after one change">Builds got 41% faster</Punchline>
        <LowerThird name="Jordan Lee" role="Platform lead" quote="We stopped rebuilding." />
        <Chapter number={2} of={4} title="Where the time went" />
      </Slide>,
    )
    for (const text of ['Builds', '41%', 'after one change', 'Jordan Lee', 'Platform lead', 'We stopped rebuilding.', 'Where the time went', 'Chapter 2 of 4', '02 / 04']) expect(container.textContent).toContain(text)
  })

  test('NumberPunch starts on the old number live, and a thumbnail shows the new one with its sticker', () => {
    const live = render(<Slide><NumberPunch from={38} to={9} unit="min" /></Slide>).container
    expect(live.querySelector('[aria-label="38 min"]')).not.toBeNull()
    const { container } = render(
      <ThumbnailContext.Provider value>
        <Slide><NumberPunch from={38} to={9} unit="min" before="in June" delta /></Slide>
      </ThumbnailContext.Provider>,
    )
    expect(container.querySelector('[aria-label="9 min"]')).not.toBeNull()
    expect(container.textContent).toContain('−76%')
    expect(container.textContent).toContain('in June')
  })

  test('Annotate draws its rings and arrows and shows its notes', () => {
    const { container } = render(
      <Slide>
        <Annotate src="/hero.svg" zoom={{ x: 700, y: 400, scale: 1.5 }}>
          <Ring x={700} y={400} r={120} />
          <Scribble x={200} y={600} arrowTo={[600, 450]}>look here</Scribble>
        </Annotate>
      </Slide>,
    )
    expect(container.querySelectorAll('svg path')).toHaveLength(2)
    expect(container.textContent).toContain('look here')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/hero.svg')
  })
})

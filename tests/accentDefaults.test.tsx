import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Accent, ComparisonLayout, DataModel, DefinitionLayout, SplitBackground, Highlight, IconRow, ProgressBar, Quadrants, Slide, Text, Timeline } from '../src/components/slides'
import { themedGradientStops } from '../src/components/slides/Accent'
import { useDom } from './setup/dom'

useDom()

const onRedSlide = (node: React.ReactNode) => render(<Slide accent="red">{node}</Slide>).container

describe('components without a colour take the slide accent', () => {
  test('Timeline events', () => {
    const c = onRedSlide(<Timeline events={[{ date: 'Jan', title: 'Start' }, { date: 'Mar', title: 'End', color: 'teal' }]} />)
    const dates = [...c.querySelectorAll('div')].filter((d) => d.textContent === 'Jan' || d.textContent === 'Mar') as HTMLElement[]
    expect(dates[0].style.color).toBe('var(--brand-red)')
    expect(dates[1].style.color).toBe('var(--accent-teal)')
  })

  test('ProgressBar segments', () => {
    // The test DOM drops color-mix() fills, so check the label ink, which follows the resolved accent.
    const ink = (accent: 'yellow' | 'red') => (render(<Slide accent={accent}><ProgressBar segments={[{ label: 'Done', flex: 1 }]} /></Slide>).container.querySelector('span') as HTMLElement).style.color
    expect(ink('yellow')).toBe('var(--dark-bg)')
    expect(ink('red')).toBe('#ffffff')
  })

  test('DataModel entities', () => {
    const c = onRedSlide(<DataModel entities={[{ id: 'a', name: 'A' }, { id: 'b', name: 'B', color: 'navy' }]} />)
    const fills = [...c.querySelectorAll('rect')].map((r) => r.getAttribute('fill'))
    expect(fills).toContain('var(--brand-red)')
    expect(fills).toContain('var(--accent-navy)')
    expect(fills).not.toContain('var(--accent-teal)')
  })

  test('Quadrants items', () => {
    const c = onRedSlide(<Quadrants xAxis={{ label: 'X' }} yAxis={{ label: 'Y' }} items={[{ label: 'Item', x: 0.5, y: 0.5 }]} />)
    expect(c.innerHTML).toContain('background: var(--brand-red)')
    expect(c.innerHTML).not.toContain('background: var(--brand-yellow)')
  })

  test('IconRow highlights', () => {
    const c = onRedSlide(<IconRow items={[{ icon: 'a', highlight: true }]} />)
    expect(c.innerHTML).toContain('border-color: var(--brand-red)')
    const teal = render(<Slide accent="red"><IconRow accent="teal" items={[{ icon: 'a', highlight: true }]} /></Slide>).container
    expect(teal.innerHTML).toContain('border-color: var(--accent-teal)')
  })

  test('Highlight text', () => {
    const c = onRedSlide(<Text>A <Highlight>word</Highlight> and <Highlight color="teal">another</Highlight> and <Highlight color="#123456">a third</Highlight></Text>)
    const spans = [...c.querySelectorAll('span')].filter((s) => ['word', 'another', 'a third'].includes(s.textContent ?? '')) as HTMLElement[]
    expect(spans.map((s) => s.style.color)).toEqual(['var(--accent)', 'var(--accent-teal)', '#123456'])
  })

  test('Accent: plain is the slide accent, a colour wins, accent gradients follow the theme', () => {
    const c = onRedSlide(<Text><Accent>plain</Accent> <Accent color="teal">teal</Accent> <Accent gradient="sunset">fixed</Accent></Text>)
    const span = (text: string) => [...c.querySelectorAll('span')].find((s) => s.textContent === text) as HTMLElement
    expect(span('plain').style.color).toBe('var(--accent)')
    expect(span('teal').style.color).toBe('var(--accent-teal)')
    expect(span('fixed').style.background).toContain('#f59e0b')
    expect(themedGradientStops('var(--accent)', 'dark')).toEqual(['color-mix(in srgb, var(--accent) 55%, #ffffff)', 'var(--accent)'])
    expect(themedGradientStops('var(--accent)', 'light')[0]).toBe('var(--accent)')
  })
})

describe('full-slide layouts use the slide colours, not fixed pastels', () => {
  const html = (node: React.ReactNode) => (render(<Slide scheme="dark" accent="red" background="transparent">{node}</Slide>).container.querySelector('.slide__stage') as HTMLElement).innerHTML // the root carries the theme's own tokens

  test('no fixed light colours by default; explicit colours still win', () => {
    const layouts = [
      <SplitBackground key="s" />,
      <ComparisonLayout key="c" leftHeader={{ label: 'A', title: 'Build' }} rightHeader={{ title: 'Buy' }} centerTitle="Trade-offs" />,
      <DefinitionLayout key="d" title="Term" subtitle="Meaning" />,
    ]
    for (const layout of layouts) {
      const out = html(layout)
      for (const fixed of ['#ffffff', '#faf6ee', '#dff3e8', '#1a1a1a', '#8a8f98', '#3a3a3a']) expect(out).not.toContain(fixed)
      expect(out).toContain('var(--bg)')
    }
    expect(html(<SplitBackground topColor="#123456" />)).toContain('#123456')
  })
})

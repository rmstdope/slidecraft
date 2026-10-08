import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render } from '@testing-library/react'
import { StepContext } from '../src/animations/stepContext'
import { Card, Callout, List, ListItem, PersonCard, ScatterChart, Slide, Stat, Title } from '../src/components/slides'
import { useDom } from './setup/dom'

useDom()

describe('accent inheritance', () => {
  test('a Card without an accent takes the slide accent; an explicit one wins', () => {
    const { container } = render(
      <Slide accent="teal">
        <Card title="Inherits">a</Card>
        <Card title="Explicit" accent="red">b</Card>
        <Callout label="Note">c</Callout>
      </Slide>,
    )
    const titles = Array.from(container.querySelectorAll('h3')) as HTMLElement[]
    expect(titles[0].style.color).toBe('var(--accent-teal)')
    expect(titles[1].style.color).toBe('var(--brand-red)')
    expect(container.textContent).toContain('Note')
  })
})

describe('List', () => {
  test('a staged list keeps its items mounted (layout stays put) and gates them by beat', () => {
    const view = render(
      <StepContext.Provider value={{ step: 0, total: 1 }}>
        <List step={1}>
          <ListItem>one</ListItem>
          <ListItem>two</ListItem>
        </List>
      </StepContext.Provider>,
    )
    expect(view.container.querySelectorAll('li')).toHaveLength(2)
  })
})

describe('Stat and PersonCard', () => {
  test('non-numeric stat values render verbatim', () => {
    const { container } = render(<Stat value="N/A" label="Score" />)
    expect(container.textContent).toContain('N/A')
  })
  test('a person without a photo shows initials', () => {
    const { container } = render(<PersonCard name="Jane Doe" role="Engineer" />)
    expect(container.textContent).toContain('JD')
    expect(container.querySelector('img')).toBeNull()
  })
})

describe('ScatterChart', () => {
  const data = [
    { series: 'a', x: 1, y: 10 },
    { series: 'a', x: 3, y: 20 },
    { series: 'b', x: 5, y: 30 },
    { series: 'b', x: 9, y: 40 },
  ]

  test('the threshold readout counts points at or below the cut', () => {
    const { container } = render(<ScatterChart data={data} x={{ key: 'x', label: 'X' }} y={{ key: 'y', label: 'Y' }} threshold={4} />)
    expect(container.textContent).toContain('2 of 4 points at or below')
    expect(container.querySelectorAll('circle[r="9"]')).toHaveLength(4)
  })

  test('the legend hides a series and the threshold follows', () => {
    const { container, getByRole } = render(<ScatterChart data={data} x={{ key: 'x', label: 'X' }} y={{ key: 'y', label: 'Y' }} threshold={4} legend />)
    act(() => void fireEvent.click(getByRole('button', { name: 'a' })))
    expect(container.querySelectorAll('circle[r="9"]')).toHaveLength(2)
    expect(container.textContent).toContain('0 of 2 points')
  })

  test('tabs switch the x axis, and so does the n key', () => {
    const { getAllByRole } = render(
      <ScatterChart data={data.map((d) => ({ ...d, z: d.x * 10 }))} x={[{ key: 'x', label: 'X' }, { key: 'z', label: 'Z' }]} y={{ key: 'y', label: 'Y' }} />,
    )
    const tabs = getAllByRole('tab')
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })))
    expect(getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true')
  })
})

describe('folio theme frames', () => {
  for (const frame of ['title', 'section', 'content'] as const) {
    test(`the ${frame} frame draws its art and the light logo unless it hides it`, () => {
      const { container } = render(<Slide theme="folio" frame={frame}><Title>T</Title></Slide>)
      expect(container.querySelector('.slide__frame')?.getAttribute('src')).toContain(`${frame}.svg`)
      expect(container.querySelector('img.slide__logo')?.getAttribute('src')).toBe(frame === 'section' ? undefined : '/logo-on-light.svg')
    })
  }
})

describe('overview', () => {
  test('cells never nest buttons, even around slides that contain buttons', async () => {
    const { Presentation } = await import('../src/components/slides')
    window.history.replaceState(null, '', '/demo')
    const { container } = render(
      <Presentation>
        <Slide>
          <ScatterChart data={[{ series: 'a', x: 1, z: 2, y: 1 }]} x={[{ key: 'x', label: 'X' }, { key: 'z', label: 'Z' }]} y={{ key: 'y', label: 'Y' }} />
        </Slide>
      </Presentation>,
    )
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' })))
    expect(container.querySelectorAll('.overview__cell')).toHaveLength(1)
    expect(container.querySelectorAll('button button')).toHaveLength(0)
  })
})

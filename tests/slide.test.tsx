import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { onAccent, tint } from '../src/components/slides/accents'
import { gradientFor } from '../src/components/slides/gradients'
import { Slide, splitHeaderBody } from '../src/components/slides/Slide'
import { Subtitle } from '../src/components/slides/Subtitle'
import { Text } from '../src/components/slides/Text'
import { Title, fitTitleSize } from '../src/components/slides/Title'
import { useDom } from './setup/dom'

useDom()

const root = (container: HTMLElement) => container.querySelector('.slide') as HTMLElement

describe('Slide', () => {
  test('applies scheme and accent classes', () => {
    const { container } = render(<Slide scheme="light" accent="teal"><Title>Hi</Title></Slide>)
    expect(root(container).className).toContain('scheme-light')
    expect(root(container).className).toContain('accent-teal')
  })

  test('invalid enum values fall back to their defaults', () => {
    // @ts-expect-error deliberately invalid values, as typed by an author mid-edit
    const { container } = render(<Slide scheme="purple" accent="pink" gradient="rainbow" layout="grid"><Title>Hi</Title></Slide>)
    expect(root(container).className).toContain('scheme-dark')
    expect(root(container).className).toContain('accent-yellow')
    expect(container.querySelector('.slide__header')).toBeNull()
  })

  test('a theme frame forces its scheme and layout, drops gradients and draws its own logo', () => {
    const { container } = render(
      <Slide theme="folio" scheme="dark" gradient="radial">
        <Subtitle>Eyebrow</Subtitle>
        <Title>Assertion</Title>
        <Text>Body</Text>
      </Slide>,
    )
    expect(root(container).className).toContain('scheme-light')
    expect(root(container).getAttribute('data-frame')).toBe('content')
    expect(root(container).style.backgroundImage).toBe('')
    expect(container.querySelector('.slide__header')).not.toBeNull()
    expect(container.querySelector('.slide__header-bar')).not.toBeNull()
    expect(container.querySelector('.slide__frame')?.getAttribute('src')).toContain('content.svg')
    expect((container.querySelector('.slide__logo') as HTMLElement).style.right).toBe('120px')
  })

  test('document layout splits the leading Subtitle and Title into the header band', () => {
    const { container } = render(
      <Slide layout="document">
        <Subtitle>Eyebrow</Subtitle>
        <Title>Assertion</Title>
        <Text>Body</Text>
      </Slide>,
    )
    const header = container.querySelector('.slide__header')!
    expect(header.textContent).toBe('EyebrowAssertion')
    expect(container.querySelector('.slide__footer-rule')).not.toBeNull()
  })

  test('picks the logo for the theme', () => {
    const dark = render(<Slide><Title>a</Title></Slide>)
    expect(dark.container.querySelector('img')?.getAttribute('src')).toBe('/logo-on-dark.svg')
    dark.unmount()
    const light = render(<Slide scheme="light"><Title>a</Title></Slide>)
    expect(light.container.querySelector('img')?.getAttribute('src')).toBe('/logo-on-light.svg')
  })
})

describe('splitHeaderBody', () => {
  test('only the leading run of Title/Subtitle is header', () => {
    const { header, body } = splitHeaderBody([
      <Subtitle key="s">S</Subtitle>,
      <Title key="t">T</Title>,
      <Text key="x">X</Text>,
      <Title key="t2">Later</Title>,
    ])
    expect(header).toHaveLength(2)
    expect(body).toHaveLength(2)
  })
})

describe('gradients and accents', () => {
  test('light gradients tint the slide accent through color-mix', () => {
    const value = gradientFor('light', 'spotlight')!
    expect(value).toContain('color-mix(in srgb, var(--accent) 22%, transparent)')
    expect(gradientFor('dark', 'none')).toBeUndefined()
  })
  test('tint and onAccent follow the theme variables', () => {
    expect(tint('red', 0.5)).toBe('color-mix(in srgb, var(--brand-red) 50%, transparent)')
    expect(tint('gray', 0.125)).toBe('color-mix(in srgb, var(--accent-gray) 12.5%, transparent)')
    expect(onAccent('yellow')).toBe('var(--ink)')
    expect(onAccent('navy')).toBe('var(--on-navy, #ffffff)')
    expect(onAccent('teal')).toBe('#ffffff')
  })
})

describe('fitTitleSize', () => {
  /** A fake element whose rendered height follows a simple wrap model: 1000px line, 0.5em per char. */
  const fakeTitle = (chars: number) => {
    const style = { fontSize: '' }
    return {
      style,
      get offsetHeight() {
        const size = Number.parseFloat(style.fontSize)
        const lines = Math.ceil((chars * size * 0.5) / 1000)
        return lines * size * 1.1
      },
    } as unknown as HTMLElement
  }

  test('returns the largest size that keeps within maxLines and leaves the DOM at it', () => {
    const el = fakeTitle(30) // 30 chars: 88px → 1320px → 2 lines; fits at the ceiling
    expect(fitTitleSize(el, 48, 88, 2)).toBe(88)
    const long = fakeTitle(60) // needs size ≤ 66 for two lines of 1000px
    expect(fitTitleSize(long, 48, 88, 2)).toBe(66)
    expect(long.style.fontSize).toBe('66px')
  })

  test('falls back to the floor when nothing fits', () => {
    expect(fitTitleSize(fakeTitle(400), 48, 88, 2)).toBe(48)
  })
})

describe('auto-fit measurement', () => {
  test('removes the measuring class again and leaves no transform when nothing overflows', () => {
    const { container } = render(
      <Slide layout="document">
        <Title>T</Title>
        <Text>Body</Text>
      </Slide>,
    )
    expect(container.querySelector('.is-measuring')).toBeNull()
    const body = container.querySelector('.slide__header')!.nextElementSibling!.firstElementChild as HTMLElement
    expect(body.style.transform).toBe('')
  })
})

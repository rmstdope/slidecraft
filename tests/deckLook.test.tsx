import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Presentation, Slide, Title } from '../src/components/slides'
import { resolveTheme } from '../src/themes/registry'
import { resolveSlideLook } from '../src/themes/resolveSlideLook'
import { useDom } from './setup/dom'

useDom()

describe('deck-wide scheme and accent', () => {
  const slidecraft = resolveTheme('slidecraft')

  test('slide props win over the deck, the deck wins over the theme', () => {
    expect(resolveSlideLook({}, slidecraft)).toMatchObject({ scheme: 'dark', accent: 'yellow' })
    expect(resolveSlideLook({}, slidecraft, { scheme: 'light', accent: 'teal' })).toMatchObject({ scheme: 'light', accent: 'teal' })
    expect(resolveSlideLook({ scheme: 'dark', accent: 'red' }, slidecraft, { scheme: 'light', accent: 'teal' })).toMatchObject({ scheme: 'dark', accent: 'red' })
  })

  test('typos fall through to the theme, and theme limits and frames still apply', () => {
    expect(resolveSlideLook({}, slidecraft, { scheme: 'sepia', accent: 'pink' })).toMatchObject({ scheme: 'dark', accent: 'yellow' })
    const folio = resolveTheme('folio')
    expect(resolveSlideLook({ frame: 'none' }, folio, { scheme: 'dark' }).scheme).toBe('light') // folio is light only
  })

  test('<Presentation scheme accent> reaches slides that do not set their own', () => {
    const { container } = render(
      <Presentation scheme="light" accent="teal">
        <Slide>
          <Title>Inherits</Title>
        </Slide>
      </Presentation>,
    )
    const slide = container.querySelector('.slide') as HTMLElement
    expect(slide.className).toContain('scheme-light')
    expect(slide.className).toContain('accent-teal')
  })
})

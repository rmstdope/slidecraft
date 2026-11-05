import { beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render } from '@testing-library/react'
import { SlideThumbnail } from '../src/components/editor/SlideThumbnail'
import { Presentation } from '../src/components/slides/Presentation'
import { Slide } from '../src/components/slides/Slide'
import { Title } from '../src/components/slides/Title'
import { DeckContext, assetResolverFor } from '../src/components/slides/deckContext'
import { useDom } from './setup/dom'

useDom()

/** Stand-in for a component that reveals itself on a build step. */
function Beat(_: { step: number }) {
  return null
}

const deck = () => (
  <Presentation>
    <Slide><Title>One</Title></Slide>
    <Slide scheme="light"><Title>Two</Title><Beat step={2} /></Slide>
    <Slide hidden><Title>Hidden</Title></Slide>
    <Slide><Title>Three</Title></Slide>
  </Presentation>
)

const press = (key: string, init: KeyboardEventInit = {}) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init })))

beforeEach(() => window.history.replaceState(null, '', '/demo'))

describe('Presentation', () => {
  test('arrow keys walk beats, then slides, and the hash follows', () => {
    render(deck())
    expect(window.location.hash).toBe('#slide-1')
    press('ArrowRight')
    expect(window.location.hash).toBe('#slide-2')
    press('ArrowRight')
    press('ArrowRight')
    expect(window.location.hash).toBe('#slide-2-step-2')
    press('ArrowRight')
    expect(window.location.hash).toBe('#slide-3') // the hidden slide has no index
    press('ArrowLeft')
    expect(window.location.hash).toBe('#slide-2-step-2') // lands fully built
    press('ArrowDown')
    expect(window.location.hash).toBe('#slide-3')
    press('Home')
    expect(window.location.hash).toBe('#slide-1')
    press('End')
    expect(window.location.hash).toBe('#slide-3')
  })

  test('starts at the slide named by the hash', () => {
    window.history.replaceState(null, '', '/demo#slide-2-step-1')
    const { container } = render(deck())
    expect(window.location.hash).toBe('#slide-2-step-1')
    expect(container.querySelector('.progress__counter')?.textContent).toBe('2 / 3 · step 1 / 2')
  })

  test('click advances, right click retreats, controls do not advance', () => {
    const { container } = render(deck())
    const root = container.querySelector('.presentation')!
    fireEvent.click(root)
    expect(window.location.hash).toBe('#slide-2')
    fireEvent.contextMenu(root)
    expect(window.location.hash).toBe('#slide-1')
    fireEvent.click(container.querySelector('.presentation__controls button')!)
    expect(window.location.hash).toBe('#slide-1')
  })

  test('progress pills jump to a slide and flip colours on light slides', () => {
    const { container } = render(deck())
    const pills = container.querySelectorAll('.progress__pill')
    expect(pills).toHaveLength(3)
    fireEvent.click(pills[1])
    expect(window.location.hash).toBe('#slide-2')
    expect(container.querySelector('.progress')?.className).toContain('progress--light')
  })

  test('overview opens with M, moves focus with arrows and opens a slide with Enter', () => {
    const { container } = render(deck())
    press('m')
    expect(container.querySelector('.overview')).not.toBeNull()
    expect(container.querySelectorAll('.overview__cell')).toHaveLength(3)
    press('ArrowRight')
    press('ArrowRight')
    press('Enter')
    expect(window.location.hash).toBe('#slide-3')
  })

  test('G toggles the guides as state and mirrors them in the URL', () => {
    const { container } = render(deck())
    press('g')
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('guides')
    expect(container.querySelector('.guides-frame')).not.toBeNull()
    press('f')
    expect(container.querySelector('.presentation__controls')?.textContent).toContain('Actual Mode')
    press('g')
    expect(window.location.search).toBe('')
  })

  test('the Guides button beside Fullscreen toggles the guides', () => {
    const { getByRole, container } = render(deck())
    const toggle = getByRole('button', { name: 'Guides' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('guides')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.guides-frame')).not.toBeNull()
    expect(window.location.hash).toBe('#slide-1')
    fireEvent.click(toggle)
    expect(window.location.search).toBe('')
    expect(container.querySelector('.guides-frame')).toBeNull()
  })

  test('an old ?mode=dev link opens with the guides on', () => {
    window.history.replaceState(null, '', '/?mode=dev')
    const { container } = render(deck())
    expect(container.querySelector('.guides-frame')).not.toBeNull()
    expect(new URLSearchParams(window.location.search).get('mode')).toBe('guides')
  })

  test('Esc goes to the vault home page and E edits the current slide', () => {
    const ref = { source: 'examples', path: 'motion' }
    const withDeck = () => (
      <DeckContext.Provider value={{ deck: ref, resolveAsset: assetResolverFor(ref) }}>{deck()}</DeckContext.Provider>
    )
    const first = render(withDeck())
    press('ArrowDown')
    press('e')
    expect(window.location.pathname).toBe('/v/examples/edit/motion')
    expect(window.location.search).toBe('?slide=2')
    first.unmount()

    window.history.replaceState(null, '', '/demo')
    render(withDeck())
    press('Escape')
    expect(window.location.pathname).toBe('/v/examples/')
  })

  test('Cmd+K opens the command palette and ? the shortcuts modal', () => {
    const { getByRole } = render(deck())
    press('k', { metaKey: true })
    expect(getByRole('dialog', { name: 'Command palette' })).toBeDefined()
    expect(document.body.textContent).toContain('Go to Slide 3')
  })

  test('? opens the shortcuts modal for the current mode', () => {
    const { getByRole } = render(deck())
    press('?')
    expect(getByRole('dialog', { name: 'Keyboard shortcuts' }).textContent).toContain('Presentation Mode')
  })

  test('?pdf renders static sections with the total slide count', () => {
    window.history.replaceState(null, '', '/demo?pdf=1&slide=2')
    const { container } = render(deck())
    const root = container.querySelector('[data-slidecraft-pdf-export="true"]')!
    expect(root.getAttribute('data-slide-count')).toBe('3')
    expect(root.querySelectorAll('section')).toHaveLength(1)
    expect(root.textContent).toBe('Two')
  })

  test('inside a thumbnail a deck renders only its first slide', () => {
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 384, height: 216, top: 0, left: 0, right: 384, bottom: 216, x: 0, y: 0 }),
    })
    const { container } = render(<div style={{ position: 'relative' }}><SlideThumbnail>{deck()}</SlideThumbnail></div>)
    expect(container.querySelector('.presentation')).toBeNull()
    expect(container.textContent).toBe('One')
    expect(container.querySelector('[data-slide-thumbnail]')?.getAttribute('style')).toContain('scale(0.2)')
  })
})

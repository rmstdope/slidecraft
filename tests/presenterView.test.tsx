import { beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render } from '@testing-library/react'
import { Notes } from '../src/components/slides/Notes'
import { Presentation } from '../src/components/slides/Presentation'
import { Slide } from '../src/components/slides/Slide'
import { Title } from '../src/components/slides/Title'
import { serializeHistories, addAnnotation } from '../src/drawing/history'
import { useDom } from './setup/dom'

useDom()

function Beat(_: { step: number }) {
  return null
}

const deck = () => (
  <Presentation>
    <Slide><Title>One</Title><Notes>Open with the <strong>question</strong>.</Notes></Slide>
    <Slide><Title>Two</Title><Beat step={1} /></Slide>
    <Slide><Title>Three</Title></Slide>
  </Presentation>
)

const press = (key: string, init: KeyboardEventInit = {}) => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init })))

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/demo')
})

describe('presenter view', () => {
  test('shows the notes, the next slide, position and step, and walks with the keys', () => {
    window.history.replaceState(null, '', '/demo?presenter=true')
    const { container } = render(deck())
    expect(container.querySelector('.presenter__note-body')?.textContent).toBe('Open with the question.')
    expect(container.querySelector('.presenter__next-frame')).not.toBeNull()
    expect(container.querySelector('.presenter__position')?.textContent).toBe('1 / 3')
    press('ArrowRight')
    expect(container.querySelector('.presenter__position')?.textContent).toBe('2 / 3step 0 / 1')
    expect(container.querySelector('.presenter__no-notes')).not.toBeNull()
    press('ArrowRight')
    expect(container.querySelector('.presenter__position')?.textContent).toBe('2 / 3step 1 / 1')
    press('End')
    expect(container.querySelector('.presenter__end')?.textContent).toBe('End of presentation')
    expect((container.querySelector('.presenter__controls .is-primary') as HTMLButtonElement).disabled).toBe(true)
    expect(window.location.hash).toBe('#slide-3')
  })

  test('R starts the timer and keeps its start in storage; R again resets it', () => {
    window.history.replaceState(null, '', '/demo?presenter=true')
    const { container } = render(deck())
    press('r')
    expect(container.querySelector('.presenter__time.is-running')).not.toBeNull()
    expect(Object.keys(localStorage).some((k) => k.startsWith('slidecraft-timer-'))).toBe(true)
    press('r')
    expect(container.querySelector('.presenter__time.is-running')).toBeNull()
    expect(Object.keys(localStorage).some((k) => k.startsWith('slidecraft-timer-'))).toBe(false)
  })
})

describe('draw mode in the audience window', () => {
  test('A opens the toolbar; clicks on the canvas do not advance; Esc leaves draw mode first', () => {
    const { container } = render(deck())
    press('a')
    expect(container.querySelector('.drawing-toolbar')).not.toBeNull()
    fireEvent.click(container.querySelector('.drawing-canvas')!)
    expect(window.location.hash).toBe('#slide-1')
    press('3')
    expect(container.querySelector('.drawing-toolbar button[aria-label="Arrow"]')?.className).toContain('is-active')
    press('Escape')
    expect(container.querySelector('.drawing-toolbar')).toBeNull()
    expect(window.location.pathname).toBe('/demo') // Esc did not also leave for the editor
  })

  test('saved annotations show on their slide without draw mode', () => {
    const stroke = { id: 's1', type: 'path' as const, color: '#fff', strokeWidth: 4, opacity: 1, points: [{ x: 0, y: 0 }, { x: 50, y: 50 }] }
    localStorage.setItem('slidecraft-annotations-/demo', serializeHistories(addAnnotation({}, 1, stroke)))
    const { container } = render(deck())
    expect(container.querySelector('.drawing-canvas path')).toBeNull()
    press('ArrowDown')
    expect(container.querySelector('.drawing-canvas path')).not.toBeNull()
  })
})

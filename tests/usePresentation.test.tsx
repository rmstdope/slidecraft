import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { usePresentation } from '../src/editor/usePresentation'
import { useDom } from './setup/dom'

useDom()

const DECK = { source: 'examples', path: 'fake' }
const SOURCE = "import { Presentation, Slide, Title } from '@components'\n\n<Presentation>\n\n<Slide>\n  <Title>One</Title>\n</Slide>\n\n<Slide>\n  <Title>Two</Title>\n</Slide>\n\n</Presentation>\n"

/** A fake deck API: GET returns `disk`; a PUT waits until the test calls `finishSave()`. */
let disk = ''
let pendingSave: (() => void) | null = null
const finishSave = () => act(async () => pendingSave?.())
const realFetch = globalThis.fetch

beforeEach(() => {
  disk = SOURCE
  pendingSave = null
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const { content } = JSON.parse(String(init.body)) as { content: string }
      await new Promise<void>((resolve) => (pendingSave = resolve))
      disk = content
      return new Response(JSON.stringify({ success: true }))
    }
    return new Response(JSON.stringify({ content: disk, readOnly: false }))
  }) as typeof fetch
})
afterEach(() => {
  globalThis.fetch = realFetch
})

async function open() {
  const hook = renderHook(() => usePresentation(DECK))
  await waitFor(() => expect(hook.result.current.state.model).not.toBeNull())
  return hook
}

describe('usePresentation', () => {
  test('an edit made while a save is in flight stays unsaved, and a reload keeps it', async () => {
    const { result } = await open()
    act(() => result.current.actions.updateSelectedSlide('<Slide>\n  <Title>One!</Title>\n</Slide>'))
    let saved: Promise<boolean>
    act(() => void (saved = result.current.actions.save()))
    act(() => result.current.actions.updateSelectedSlide('<Slide>\n  <Title>One!!</Title>\n</Slide>'))
    await finishSave()
    expect(await saved!).toBe(true)
    expect(result.current.state.isDirty).toBe(true)
    await act(() => result.current.actions.reload())
    expect(result.current.selected?.text).toContain('One!!')
  })

  test('a reload of unchanged content keeps the model (the echo of a save)', async () => {
    const { result } = await open()
    const model = result.current.state.model
    await act(() => result.current.actions.reload())
    expect(result.current.state.model).toBe(model)
    disk = SOURCE.replace('Two', 'Deux')
    await act(() => result.current.actions.reload())
    expect(result.current.state.model).not.toBe(model)
    expect(result.current.state.model?.slides[1].text).toContain('Deux')
  })

  test('saving a fix in whole-file mode returns to slides', async () => {
    disk = SOURCE.replace('<Slide>\n  <Title>Two', '<Slide\n  <Title>Two')
    const { result } = renderHook(() => usePresentation(DECK))
    await waitFor(() => expect(result.current.state.raw).not.toBeNull())
    act(() => result.current.actions.updateRaw(SOURCE))
    let saved: Promise<boolean>
    act(() => void (saved = result.current.actions.save()))
    await finishSave()
    expect(await saved!).toBe(true)
    await act(() => result.current.actions.reload()) // the echo of that save
    expect(result.current.state.model?.slides).toHaveLength(2)
  })

  test('unsavedSlides lists only slides changed since the last save, and diskChanged spots other writers', async () => {
    const { result } = await open()
    expect(result.current.actions.unsavedSlides()).toEqual([])
    act(() => result.current.actions.updateSelectedSlide('<Slide>\n  <Title>Edited</Title>\n</Slide>'))
    expect(result.current.actions.unsavedSlides()).toEqual(['<Slide>\n  <Title>Edited</Title>\n</Slide>'])
    expect(await result.current.actions.diskChanged()).toBe(false)
    disk = 'written by someone else'
    expect(await result.current.actions.diskChanged()).toBe(true)
  })
})
